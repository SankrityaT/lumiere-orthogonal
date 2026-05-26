import { NextRequest } from "next/server";

export const maxDuration = 60;

/* ----------------------------------------------------------------------- *
 *  STUB — commit 1 of 2.
 *
 *  This route preserves the NDJSON streaming contract that lib/chat-client
 *  expects (state → text_delta → done), so the entire UI shell renders
 *  end-to-end. Commit 2 replaces this with the real OpenAI tool-calling
 *  loop against Orthogonal's /v1/run, plus context budgeting, caching,
 *  circuit breakers, and persistence.
 * ----------------------------------------------------------------------- */

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

function emit(controller: ReadableStreamDefaultController, event: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  let body: { messages?: ClientMessage[] };
  try {
    body = (await req.json()) as { messages?: ClientMessage[] };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const stub = `**Backend stub.**

The chat shell is wired and the streaming protocol is live, but \`/api/chat\` is a placeholder in commit 1. The real backend (OpenAI tool-calling + Orthogonal \`/v1/run\` + context budgeting + Postgres + Redis) lands in commit 2.

You asked: *"${lastUser.slice(0, 200)}${lastUser.length > 200 ? "…" : ""}"*

Once commit 2 ships, this turn would route through 7 tools (\`apollo_search_people\`, \`enrich_contact\`, \`company_signals\`, \`web_search\`, \`send_email\`, plus \`orth_discover\` and \`orth_call\` as escape hatches) and stream live results inline.`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => emit(controller, e);
      try {
        send({ type: "state", value: "thinking" });
        await sleep(300);
        send({ type: "state", value: "writing" });
        send({ type: "state", value: null });

        // Word-by-word for a real-looking stream
        const tokens = stub.split(/(\s+)/);
        for (const t of tokens) {
          if (!t) continue;
          send({ type: "text_delta", text: t });
          await sleep(8);
        }
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
