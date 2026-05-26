import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { encodingForModel } from "js-tiktoken";
import { hasDb, db, conversations, messages, toolCalls } from "@/lib/db";
import { getOrCreateUser } from "@/lib/cookies";

export const runtime = "nodejs";

/* GET /api/context-stats?conversationId=...
 *
 * Verify-the-claim endpoint. Returns the actual token math comparing what we
 * sent to the LLM (compacted via L1 tool-level summarization) vs what a naive
 * chatbot would have sent (full raw Orthogonal responses). Use this to back
 * the "we cut input cost ~90%" claim with real numbers from real calls. */

const INPUT_PRICE_PER_M_USD = 0.25; // gpt-5-mini input
const OUTPUT_PRICE_PER_M_USD = 2.0; // gpt-5-mini output
const MODEL_MAX_TOKENS = parseInt(process.env.MODEL_MAX_TOKENS || "128000", 10);

let enc: ReturnType<typeof encodingForModel> | null = null;
function tokens(s: string): number {
  if (!enc) enc = encodingForModel("gpt-4o"); // shares o200k_base with gpt-5
  return enc.encode(s).length;
}
function jsonTokens(v: unknown): number {
  if (v == null) return 0;
  return tokens(typeof v === "string" ? v : JSON.stringify(v));
}

export async function GET(req: NextRequest) {
  const user = getOrCreateUser(req);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user.cookieHeader) headers["Set-Cookie"] = user.cookieHeader;

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return new Response(
      JSON.stringify({ error: "conversationId query param required" }),
      { status: 400, headers },
    );
  }
  if (!hasDb()) {
    return new Response(
      JSON.stringify({ error: "DATABASE_URL not configured — context-stats requires Neon" }),
      { status: 503, headers },
    );
  }

  const d = db()!;

  // Verify the conversation belongs to this cookie-user
  const [convo] = await d
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.uid)))
    .limit(1);
  if (!convo) {
    return new Response(JSON.stringify({ error: "conversation not found" }), {
      status: 404,
      headers,
    });
  }

  // Pull all tool_calls + messages for this conversation
  const [tcRows, msgRows] = await Promise.all([
    d.select().from(toolCalls).where(eq(toolCalls.conversationId, conversationId)),
    d.select().from(messages).where(eq(messages.conversationId, conversationId)),
  ]);

  // Sum raw response tokens across all tool_calls (one row per Orthogonal call).
  let totalRaw = 0;
  const perTool: Array<{
    provider: string;
    path: string;
    cached: boolean;
    priceCents: number;
    rawTokens: number;
  }> = [];
  for (const tc of tcRows) {
    const rawT = jsonTokens(tc.response);
    totalRaw += rawT;
    perTool.push({
      provider: tc.provider,
      path: tc.path,
      cached: !!tc.cachedFromId,
      priceCents: tc.priceCents,
      rawTokens: rawT,
    });
  }

  // Sum compacted-payload tokens across all assistant messages' tool_payload
  // arrays. This is exactly what the LLM saw in subsequent turns. The id
  // schemas don't line up 1:1 with tool_calls.id (openai tool_call_id vs
  // orthogonal uuid), so we aggregate instead of trying to per-call match.
  let totalCompacted = 0;
  for (const m of msgRows) {
    if (m.role !== "assistant" || !Array.isArray(m.toolPayload)) continue;
    for (const entry of m.toolPayload as Array<Record<string, unknown>>) {
      totalCompacted += jsonTokens(entry.payload ?? entry);
    }
  }

  // History tokens (user + assistant messages, no tool payloads)
  let historyTokens = 0;
  for (const m of msgRows) {
    if (m.role === "user" || m.role === "assistant") {
      historyTokens += tokens(m.content || "");
    }
  }

  // Naive = raw tool responses + history. Compacted = compacted tool payloads + history.
  const naiveInputTokens = totalRaw + historyTokens;
  const compactedInputTokens = totalCompacted + historyTokens;
  const savedTokens = naiveInputTokens - compactedInputTokens;
  const naiveInputCostUsd = (naiveInputTokens * INPUT_PRICE_PER_M_USD) / 1_000_000;
  const compactedInputCostUsd = (compactedInputTokens * INPUT_PRICE_PER_M_USD) / 1_000_000;
  const savedInputCostUsd = naiveInputCostUsd - compactedInputCostUsd;
  const reductionPercent = naiveInputTokens > 0 ? (savedTokens / naiveInputTokens) * 100 : 0;
  const wouldHaveCrashed = naiveInputTokens > MODEL_MAX_TOKENS;

  // Sum of orthogonal call costs
  const orthCostCents = tcRows.reduce((s, r) => s + r.priceCents, 0);

  return new Response(
    JSON.stringify(
      {
        ok: true,
        conversation: {
          id: convo.id,
          title: convo.title,
          turns: msgRows.length,
        },
        verification: {
          model: "gpt-5-mini",
          model_max_tokens: MODEL_MAX_TOKENS,
          input_price_per_m_usd: INPUT_PRICE_PER_M_USD,
          output_price_per_m_usd: OUTPUT_PRICE_PER_M_USD,
        },
        totals: {
          history_tokens: historyTokens,
          raw_tool_tokens: totalRaw,
          compacted_tool_tokens: totalCompacted,
          naive_input_tokens: naiveInputTokens,
          compacted_input_tokens: compactedInputTokens,
          saved_tokens: savedTokens,
          reduction_percent: Math.round(reductionPercent * 10) / 10,
          naive_input_cost_usd: Number(naiveInputCostUsd.toFixed(6)),
          compacted_input_cost_usd: Number(compactedInputCostUsd.toFixed(6)),
          saved_input_cost_usd: Number(savedInputCostUsd.toFixed(6)),
          orthogonal_call_cost_cents: orthCostCents,
          would_have_crashed_naive: wouldHaveCrashed,
        },
        tools: perTool,
      },
      null,
      2,
    ),
    { headers },
  );
}
