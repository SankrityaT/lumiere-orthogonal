import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { openai, MODEL, MODEL_MAX_TOKENS } from "@/lib/openai";
import { TOOLS, TOOL_DEFS, guardedCall, type ExecCtx } from "@/lib/tools";
import { budgetMessages, type BudgetedMessage } from "@/lib/context";
import { getOrCreateUser } from "@/lib/cookies";
import { checkRate } from "@/lib/rate-limit";
import { saveDraft } from "@/lib/draft-store";
import { hasDb, db, conversations, messages as messagesTable, toolCalls as toolCallsTable, users } from "@/lib/db";

export const maxDuration = 120;
export const runtime = "nodejs";

/* ----------------------------- system prompt ----------------------------- */

const SYSTEM_PROMPT = `You are Orthogonal Chat — an assistant with live access to Orthogonal's unified API catalog (https://api.orth.sh, 55+ providers behind one auth).

You have 7 tools:

  • apollo_search_people — find people at companies by role/seniority/location/keyword (Apollo, 210M contacts). Optionally enrich top results for contact info.
  • enrich_contact       — look up a specific person's email/phone/role (ContactOut).
  • company_signals      — fetch funding rounds, job openings, and news for a domain (PredictLeads).
  • web_search           — search the live web (Tavily). Use for current events, news, time-sensitive facts.
  • send_email           — prepare a draft email (subject + body). YOU DO NOT PICK THE RECIPIENT. The UI shows a draft card with an editable "To:" field that the USER fills in. Pass suggested_recipients only if the user explicitly named addresses; otherwise omit it. The email never sends until the user clicks Send, and the server enforces a recipient allowlist on top of that.
  • orth_discover        — natural-language search across Orthogonal's full catalog. Use when the 5 above don't fit.
  • orth_call            — direct passthrough to any of the 55+ providers. Use after orth_discover surfaces a slug+path.

PRINCIPLES

• When a question needs live data, call a tool. Don't guess.
• Call tools in PARALLEL when you can (e.g. enrich 3 people at once).
• Tool results are rendered inline as rich cards. You should REFERENCE results in your prose — do not regurgitate the full JSON. The user sees the card; you provide commentary, insight, and next steps.
• Cite web_search results with [1], [2] inline.
• If a tool fails or returns nothing, say so plainly and offer the user a concrete next step.
• If company_signals returns 0 news items for a company the user asked about news for, AUTOMATICALLY follow up with a web_search for the company's recent news (query like "<domain> recent news <year>") so the user isn't left empty-handed. Don't ask permission — just do it in the same turn.
• Keep responses tight: 100-400 words for research, shorter for direct lookups.
• Call each tool AT MOST ONCE per user turn unless the second call uses substantially different args (different domain, different person, different query). NEVER re-call a tool with the same or near-identical args — the cached response will just come back. If the first result is enough to answer, ANSWER.
• Default tool results are field-projected for context efficiency (Apollo: 7 fields per person; ContactOut: 8-field envelope; PredictLeads: top 3 per kind). Only flip verbose: true if the USER explicitly asks for a field that isn't in the defaults (employment history, education, skills, full work history, deal participants, news bodies). Never use verbose preemptively or as a "thin answer" retry — answer from what you have.
• Never call send_email more than once for the same email — wait for user confirmation.
• Never put a recipient email address in the send_email tool args. You don't pick who it goes to; the user does. Don't address the body to a specific person by name unless the user has already named them, because you don't know who will receive the draft.
• If a previous send failed because the recipient was blocked, suggest the user choose someone on the allowlist (their own address, anything @orthogonal.com / @orthogonal.sh / @example.com) — don't retry with another guessed address.
• Open with substance. No "Certainly!" / "I'd be happy to."

AVAILABLE PROVIDERS (the 5 named tools above are wrapped for ergonomics; for anything else, call orth_call with the slug + path):

  GTM core
  • apollo            people + company search (210M contacts, 30M companies)
  • contactout        verified emails + phones by linkedin url
  • predictleads      financing events, job openings, news per company
  • peopledatalabs    deep person enrichment (alt to contactout)
  • coresignal        employee data + company intelligence
  • crustdata         private company financials + benchmarks

  Email + outreach
  • agentmail         programmatic inboxes (drafts + sends)
  • hunter            email finder + verifier by domain
  • tomba             email finder + verifier (alt to hunter)

  Web + search
  • tavily            keyword web search (already wired as web_search)
  • exa               semantic web search
  • linkup            realtime web search w/ synthesis
  • serper            google SERP results
  • perplexity        LLM-summarized web answers
  • andi              answer engine

  Scraping
  • scrapegraphai     ai-driven structured scrape
  • olostep           cheap general scrape
  • captaindata       scraping orchestrator

  Investors + funding
  • aviato            investor + startup data
  • fundable          funding round signals
  • fiber             venture data

  Identity + verification
  • didit             identity verification
  • nyne              person enrichment + interests
  • happenstance      relationship intelligence

  Plus: company-enrich, context-dev, edges, influencers-club, notte, ocean-io, openfunnel, openmart, precip, riveter, scrape-creators, seltz, sixtyfour, tako, voygr, baseten, and others. Use orth_discover to find any not listed here.`;

/* ------------------------------ event helpers ----------------------------- */

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages?: ClientMessage[];
  conversationId?: string;
}

function emit(controller: ReadableStreamDefaultController, event: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
}

/* -------------------------------- handler -------------------------------- */

export async function POST(req: NextRequest) {
  // 1. Resolve anonymous user from signed cookie
  const user = getOrCreateUser(req);

  // 2. Rate limit per session
  const rl = await checkRate(user.uid);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: rl.reason }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...(user.cookieHeader ? { "Set-Cookie": user.cookieHeader } : {}),
      },
    });
  }

  // 3. Parse body
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }
  const inputMsgs = body.messages ?? [];
  if (inputMsgs.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
  }
  const conversationId = body.conversationId || `c-${randomUUID()}`;

  // 4. Build the message array. System prompt at index 0, then the client's history.
  const initialMsgs: BudgetedMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...inputMsgs.map<BudgetedMessage>((m) => ({ role: m.role, content: m.content })),
  ];

  // 5. Async persistence side-channel. Tool calls accumulated for batch write at end.
  interface PersistedCall {
    callId: string;
    toolName: string;
    provider: string;
    path: string;
    args: unknown;
    response: unknown;
    error: string | null;
    priceCents: number;
    cachedFromId: string | null;
    latencyMs: number;
  }
  const persistedCalls: PersistedCall[] = [];
  const assistantMessageId = `m-${randomUUID()}`;
  let finalAssistantContent = "";
  const finalToolPayload: Array<Record<string, unknown>> = [];

  // 6. Stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => emit(controller, e);
      let totalCostCents = 0;
      let msgs = initialMsgs;
      const MAX_ITER = 6;

      // Build the ExecCtx that tools use
      const ctx: ExecCtx = {
        conversationId,
        call: guardedCall,
        saveDraft: (payload) =>
          saveDraft({ ...payload, conversationId, userId: user.uid }),
      };

      // Cumulative OpenAI token usage across all iters of the agentic loop.
      // cached_tokens = how many of our prompt's input tokens hit OpenAI's
      // automatic prompt-prefix cache (50% discount on those tokens).
      let turnCachedPromptTokens = 0;
      let turnPromptTokens = 0;
      let turnCompletionTokens = 0;

      // Track tool invocations within this turn to short-circuit duplicates.
      // Key = name + sorted-args-hash. If the model fires the exact same call
      // twice (e.g. "retry verbose" loops, redundant enrichment), we skip the
      // upstream + return a one-liner so the agent stops trying.
      const calledThisTurn = new Set<string>();
      function fingerprint(name: string, args: Record<string, unknown>): string {
        try {
          const keys = Object.keys(args).sort();
          const norm: Record<string, unknown> = {};
          for (const k of keys) norm[k] = args[k];
          return `${name}::${JSON.stringify(norm)}`;
        } catch {
          return `${name}::?`;
        }
      }

      try {
        for (let iter = 0; iter < MAX_ITER; iter++) {
          // (a) Budget the messages (real tokenization, dual track)
          const budget = budgetMessages(msgs);

          // (b) Emit context_update — actual + naive + cost
          send({
            type: "context_update",
            actual_tokens: budget.actualTokens,
            naive_tokens: budget.naiveTokens,
            model_max: MODEL_MAX_TOKENS,
            price_cents: totalCostCents,
            naive_overflow: budget.naiveOverflowTokens,
          });

          // (c) If we compacted, surface it inline so the user sees it
          if (budget.droppedCount > 0 || budget.summarizedCount > 0) {
            send({
              type: "compaction",
              dropped_count: budget.droppedCount,
              summarized_count: budget.summarizedCount,
              actual_tokens: budget.actualTokens,
              naive_tokens: budget.naiveTokens,
              model_max: MODEL_MAX_TOKENS,
              would_have_crashed: budget.wouldHaveCrashed,
              naive_overflow_tokens: budget.naiveOverflowTokens,
            });
          }

          send({ type: "state", value: iter === 0 ? "thinking" : "synthesizing" });

          // (d) Call OpenAI with streaming + tools.
          // include_usage:true gives us the usage object on the final chunk,
          // which contains prompt_tokens_details.cached_tokens — OpenAI's
          // automatic prompt-prefix cache hit count. Our prompt is structured
          // static-first (system + TOOL_DEFS, both stable) → dynamic-last
          // (user msg), which is the cache-optimal shape per OpenAI's docs.
          const completion = await openai().chat.completions.create({
            model: MODEL,
            messages: budget.messages.map(stripInternalFields) as unknown as ChatCompletionMessageParam[],
            tools: TOOL_DEFS as ChatCompletionTool[],
            tool_choice: "auto",
            parallel_tool_calls: true,
            stream: true,
            stream_options: { include_usage: true },
          });

          // (e) Accumulate streamed deltas
          interface AccTool {
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }
          const accTextParts: string[] = [];
          const accTools: AccTool[] = [];
          let writingStarted = false;
          let finishReason: string | null = null;

          for await (const chunk of completion) {
            // Final usage chunk: no choices, but has chunk.usage with the
            // prompt_tokens_details.cached_tokens we care about.
            if (chunk.usage) {
              const cached = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
              const promptTokens = chunk.usage.prompt_tokens ?? 0;
              const completionTokens = chunk.usage.completion_tokens ?? 0;
              if (cached > 0) {
                send({
                  type: "openai_cache_hit",
                  cached_tokens: cached,
                  prompt_tokens: promptTokens,
                  completion_tokens: completionTokens,
                });
              }
              turnCachedPromptTokens += cached;
              turnPromptTokens += promptTokens;
              turnCompletionTokens += completionTokens;
              continue;
            }
            const choice = chunk.choices[0];
            if (!choice) continue;
            const delta = choice.delta;
            if (delta?.content) {
              if (!writingStarted) {
                send({ type: "state", value: "writing" });
                send({ type: "state", value: null });
                writingStarted = true;
              }
              accTextParts.push(delta.content);
              send({ type: "text_delta", text: delta.content });
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!accTools[idx]) accTools[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
                if (tc.id) accTools[idx].id = tc.id;
                if (tc.function?.name) accTools[idx].function.name += tc.function.name;
                if (tc.function?.arguments) accTools[idx].function.arguments += tc.function.arguments;
              }
            }
            if (choice.finish_reason) finishReason = choice.finish_reason;
          }

          const accumulatedText = accTextParts.join("");
          finalAssistantContent += accumulatedText;

          // (f) Push assistant turn into msgs for next iteration
          const assistantMsg: BudgetedMessage = {
            role: "assistant",
            content: accumulatedText,
          };
          if (accTools.length > 0) {
            assistantMsg.tool_calls = accTools;
          }
          msgs = [...msgs, assistantMsg];

          // (g) Done if no tool calls
          if (finishReason !== "tool_calls" || accTools.length === 0) {
            break;
          }

          // (h) Execute tool calls in parallel
          const executed = await Promise.all(
            accTools.map(async (tc) => {
              const tool = TOOLS[tc.function.name];
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
              } catch {
                /* keep empty */
              }

              if (!tool) {
                send({
                  type: "tool_call_error",
                  tool_call_id: tc.id,
                  tool_name: tc.function.name,
                  error: `Unknown tool: ${tc.function.name}`,
                });
                return {
                  tc,
                  llmContent: JSON.stringify({ error: `Unknown tool ${tc.function.name}` }),
                };
              }

              // Dedup: same tool + same args fired earlier this turn? short-circuit.
              const fp = fingerprint(tc.function.name, parsedArgs);
              if (calledThisTurn.has(fp)) {
                send({
                  type: "tool_call_error",
                  tool_call_id: tc.id,
                  tool_name: tc.function.name,
                  error: "duplicate call in this turn — use the prior result.",
                });
                return {
                  tc,
                  llmContent: JSON.stringify({
                    error:
                      "You already called this tool with identical arguments in this turn. Use the prior result; do not re-call.",
                  }),
                };
              }
              calledThisTurn.add(fp);

              // Emit tool_call_start so UI can render a "running" card
              send({
                type: "tool_call_start",
                tool_call_id: tc.id,
                tool_name: tc.function.name,
                card_kind: tool.cardKind,
                provider: tool.providerLabel,
                args: parsedArgs,
              });
              send({
                type: "state",
                value: "searching",
                query: `${tool.providerLabel} · ${tc.function.name}`,
              });

              const result = await tool.execute(parsedArgs, ctx);
              totalCostCents += result.priceCents;

              // Persist per-call traces for batch DB write
              for (const c of result.calls) {
                persistedCalls.push({
                  callId: c.callId,
                  toolName: tc.function.name,
                  provider: c.api,
                  path: c.path,
                  args: c.args,
                  response: c.result.ok ? c.result.data : null,
                  error: c.result.ok ? null : c.result.error ?? "unknown",
                  priceCents: c.result.priceCents,
                  cachedFromId: c.result.cachedFromId ?? null,
                  latencyMs: c.result.latencyMs,
                });
              }

              // Emit the result event for the UI card
              const cached = result.calls.some((c) => c.result.cached);
              send({
                type: "tool_call_result",
                tool_call_id: tc.id,
                tool_name: tc.function.name,
                card_kind: tool.cardKind,
                provider: tool.providerLabel,
                args: parsedArgs,
                payload: result.cardPayload,
                price_cents: result.priceCents,
                cached,
                error: result.error,
              });

              // Update cost running total
              send({
                type: "context_update",
                actual_tokens: budget.actualTokens,
                naive_tokens: budget.naiveTokens,
                model_max: MODEL_MAX_TOKENS,
                price_cents: totalCostCents,
                naive_overflow: budget.naiveOverflowTokens,
              });

              // Stash for the final persisted tool_payload on the assistant message
              finalToolPayload.push({
                id: tc.id,
                name: tc.function.name,
                cardKind: tool.cardKind,
                provider: tool.providerLabel,
                args: parsedArgs,
                payload: result.cardPayload,
                priceCents: result.priceCents,
                cached,
                error: result.error,
              });

              return {
                tc,
                llmContent: result.llmContent,
              };
            }),
          );

          // (i) Append tool result messages for the next OpenAI iteration
          for (const { tc, llmContent } of executed) {
            msgs = [
              ...msgs,
              {
                role: "tool",
                tool_call_id: tc.id,
                name: tc.function.name,
                content: llmContent,
              } as BudgetedMessage,
            ];
          }
        }

        send({
          type: "done",
          price_cents: totalCostCents,
          openai_usage: {
            prompt_tokens: turnPromptTokens,
            cached_prompt_tokens: turnCachedPromptTokens,
            completion_tokens: turnCompletionTokens,
            cache_hit_pct: turnPromptTokens > 0 ? Math.round((turnCachedPromptTokens / turnPromptTokens) * 1000) / 10 : 0,
          },
        });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
        controller.close();
      }

      // Persist after stream close. Wrapped in waitUntil so Vercel keeps the
      // function alive until the writes finish; otherwise the serverless
      // runtime kills us right after the stream closes and the writes never
      // land in Neon (silent data loss).
      waitUntil(
        persistTurn({
          userId: user.uid,
          conversationId,
          assistantMessageId,
          userContent: inputMsgs[inputMsgs.length - 1]?.content ?? "",
          assistantContent: finalAssistantContent,
          toolPayload: finalToolPayload,
          toolCalls: persistedCalls,
        }).catch((e) => console.error("[persist] failed:", e)),
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      ...(user.cookieHeader ? { "Set-Cookie": user.cookieHeader } : {}),
    },
  });
}

/* ------------------------------ helpers ------------------------------ */

function stripInternalFields(m: BudgetedMessage): Record<string, unknown> {
  const out: Record<string, unknown> = { role: m.role, content: m.content };
  if (m.name) out.name = m.name;
  if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
  if (m.tool_calls) out.tool_calls = m.tool_calls;
  return out;
}

interface PersistArgs {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  userContent: string;
  assistantContent: string;
  toolPayload: Array<Record<string, unknown>>;
  toolCalls: Array<{
    callId: string;
    toolName: string;
    provider: string;
    path: string;
    args: unknown;
    response: unknown;
    error: string | null;
    priceCents: number;
    cachedFromId: string | null;
    latencyMs: number;
  }>;
}

async function persistTurn(args: PersistArgs): Promise<void> {
  if (!hasDb()) return;
  const d = db()!;
  const now = new Date();

  // Upsert user
  await d.insert(users).values({ id: args.userId }).onConflictDoNothing();

  // Upsert conversation (always bumps updated_at)
  await d
    .insert(conversations)
    .values({
      id: args.conversationId,
      userId: args.userId,
      title: deriveTitle(args.userContent),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: conversations.id,
      set: { updatedAt: now },
    });

  // User message
  const userMessageId = `m-${randomUUID()}`;
  await d.insert(messagesTable).values({
    id: userMessageId,
    conversationId: args.conversationId,
    role: "user",
    content: args.userContent,
    tokenCount: 0,
  });

  // Assistant message with structured tool payload
  await d.insert(messagesTable).values({
    id: args.assistantMessageId,
    conversationId: args.conversationId,
    role: "assistant",
    content: args.assistantContent,
    toolPayload: args.toolPayload.length ? args.toolPayload : null,
    tokenCount: 0,
  });

  // tool_calls rows (one per guarded call)
  if (args.toolCalls.length > 0) {
    await d.insert(toolCallsTable).values(
      args.toolCalls.map((c) => ({
        id: c.callId,
        conversationId: args.conversationId,
        messageId: args.assistantMessageId,
        toolName: c.toolName,
        provider: c.provider,
        path: c.path,
        args: c.args as Record<string, unknown>,
        response: c.response,
        error: c.error,
        priceCents: c.priceCents,
        cachedFromId: c.cachedFromId,
        latencyMs: c.latencyMs,
      })),
    );
  }
}

function deriveTitle(t: string): string {
  const s = t.trim().replace(/\s+/g, " ");
  if (!s) return "New conversation";
  return s.length > 56 ? `${s.slice(0, 56)}…` : s;
}
