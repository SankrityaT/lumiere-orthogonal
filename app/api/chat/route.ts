import { NextRequest } from "next/server";

export const runtime = "edge";
export const maxDuration = 60;

/* ----------------------------------------------------------------------- *
 *  Lumière backend — orchestrates Gemini 2.5 Flash (with thinking) + an
 *  agentic web_search tool loop powered by Tavily.
 *
 *  BYOK: keys arrive in headers from the browser, are used once per request,
 *  and never logged or persisted server-side.
 * ----------------------------------------------------------------------- */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

const MAX_TOOL_CALLS = 5; // hard cap on web searches per turn

const SYSTEM_PROMPT = `You are Lumière, a research-grade editorial AI assistant. Your job is to produce magazine-quality answers grounded in real sources when the question requires it.

RESEARCH PROTOCOL (mandatory for any question involving current information, comparisons, named products, recent events, prices, papers, benchmarks, or specific facts you cannot verify from training data):

1. PLAN: Briefly identify the distinct sub-topics or angles needed. Verbalize this plan so it surfaces in your thinking.

2. SEARCH WIDELY: Use the web_search tool MULTIPLE TIMES — issue a SEPARATE query for each distinct angle.
   - Comparison of N items → N separate searches, one per item.
   - "What's new in X" → 2-3 searches covering different facets.
   - Single-fact lookup → 1 search is fine.
   - Aim for 2-5 searches when the question is research-flavored. A single search is not enough for comparisons.

3. WRITE: Synthesize across all sources. Cross-reference claims. Do not parrot any single source.

WHEN NOT TO SEARCH:
- Pure math, logic, code with no library/version specifics, general well-known concepts, or opinion questions.
- For these, answer directly without calling web_search.

CITATIONS (strict format):
- Use inline citations IMMEDIATELY after the clause they support: \`[1]\` for one source, \`[1,2]\` for multiple (NO SPACES, NO PARENS, NO superscript syntax).
- Number sources in the order they appeared across ALL your web_search calls, starting at 1.
- Every factual claim drawn from a search MUST carry a citation.
- Do NOT add a "Sources:" footer or reference list. The UI renders sources separately.

FORMATTING (editorial article style):
- ## Section heading for each major topic
- **Bold** for key terms; *italic* sparingly for emphasis
- Bullet lists (-) for comparisons and enumerations
- Fenced code blocks (\`\`\`ts) for any code; inline \`code\` for short identifiers
- > Blockquote once, for a single pivotal insight (optional)

VOICE:
- Confident, considered, concise. Open with substance — no "Certainly!", no "I'd be happy to". When asked for an opinion, give one.
- Aim for ~300-500 words for research answers, ~80-150 for direct questions.`;

const WEB_SEARCH_TOOL = {
  name: "web_search",
  description:
    "Search the web for current information. Returns up to 6 results per call with titles, URLs, and content snippets. May be called multiple times per response.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "A focused, specific search query (3-10 words).",
      },
    },
    required: ["query"],
  },
};

// ------------- types -------------

interface ClientAttachment {
  name: string;
  mimeType: string;
  base64: string; // data URI body only (no prefix)
}

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: ClientAttachment[];
}

interface Source {
  id: number;
  domain: string;
  title: string;
  url: string;
  snippet: string;
  faviconColor: string;
  faviconLetter: string;
}

// ------------- helpers -------------

const FAVICON_PALETTE = [
  "#d97757",
  "#10a37f",
  "#4285f4",
  "#7c3aed",
  "#fa4616",
  "#e8b5a0",
  "#6b8e6b",
  "#c4a373",
];

function makeSource(result: { url: string; title?: string; content?: string }, id: number): Source {
  let domain = "source";
  try {
    domain = new URL(result.url).hostname.replace(/^www\./, "");
  } catch {}
  return {
    id,
    domain,
    title: result.title || domain,
    url: result.url,
    snippet: (result.content || "").trim().slice(0, 220),
    faviconColor: FAVICON_PALETTE[(id - 1) % FAVICON_PALETTE.length],
    faviconLetter: (domain[0] || "?").toUpperCase(),
  };
}

async function tavilySearch(query: string, key: string): Promise<Array<{ url: string; title?: string; content?: string }>> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 6,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403)
        throw new Error("Tavily key rejected. Check your Tavily API key in Settings.");
      if (res.status === 429) throw new Error("Tavily rate limit hit. Wait a moment and retry.");
      throw new Error(`Tavily ${res.status}: ${text.slice(0, 160)}`);
    }
    const data = (await res.json()) as { results?: Array<{ url: string; title?: string; content?: string }> };
    return data.results || [];
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tavily search timed out after 15s.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function friendlyGeminiError(status: number, body: string): string {
  if (status === 400) {
    if (body.includes("API_KEY_INVALID") || body.includes("API key not valid"))
      return "Gemini key invalid. Check your key in Settings.";
    if (body.includes("quota") || body.includes("Quota"))
      return "Gemini quota exhausted on this key. Try again later or use a different key.";
    return `Gemini rejected the request (400): ${body.slice(0, 160)}`;
  }
  if (status === 401 || status === 403) return "Gemini key rejected. Check your key in Settings.";
  if (status === 429) return "Gemini rate limit hit. Wait a few seconds and retry.";
  if (status === 503 || status === 502) return "Gemini is temporarily unavailable. Retry shortly.";
  return `Gemini ${status}: ${body.slice(0, 160)}`;
}

// Async generator that yields parsed Gemini SSE JSON chunks.
async function* parseGeminiSSE(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield JSON.parse(payload);
      } catch {
        // ignore parse errors on partial chunks
      }
    }
  }
}

function emit(controller: ReadableStreamDefaultController, event: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
}

// ------------- handler -------------

export async function POST(req: NextRequest) {
  const llmKey = req.headers.get("x-llm-key");
  const searchKey = req.headers.get("x-search-key");

  if (!llmKey) {
    return new Response(JSON.stringify({ error: "Missing x-llm-key header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages?: ClientMessage[]; enableWeb?: boolean };
  try {
    body = (await req.json()) as { messages?: ClientMessage[]; enableWeb?: boolean };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const messages = body.messages || [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
  }
  const enableWeb = body.enableWeb !== false && !!searchKey;

  // Convert to Gemini "contents" format.
  const contents: Array<Record<string, unknown>> = messages.map((m) => {
    const parts: Array<Record<string, unknown>> = [];
    if (m.attachments?.length) {
      for (const a of m.attachments) {
        parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } });
      }
    }
    if (m.content) parts.push({ text: m.content });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

  const stream = new ReadableStream({
    async start(controller) {
      const allSources: Source[] = [];
      let nextSourceId = 1;
      let toolCallCount = 0;

      const send = (e: Record<string, unknown>) => emit(controller, e);

      try {
        send({ type: "state", value: "thinking" });

        // Agentic loop: keep calling Gemini until it stops requesting tool calls.
        for (let step = 0; step < MAX_TOOL_CALLS + 1; step++) {
          const request: Record<string, unknown> = {
            contents,
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: {
              temperature: 0.7,
              thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
            },
          };
          if (enableWeb) {
            request.tools = [{ functionDeclarations: [WEB_SEARCH_TOOL] }];
          }

          const geminiCtrl = new AbortController();
          const geminiTimeout = setTimeout(() => geminiCtrl.abort(), 45000);
          let geminiRes: Response;
          try {
            geminiRes = await fetch(`${GEMINI_URL}&key=${llmKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(request),
              signal: geminiCtrl.signal,
            });
          } catch (err) {
            clearTimeout(geminiTimeout);
            const msg =
              err instanceof Error && err.name === "AbortError"
                ? "Gemini timed out after 45s. Try a shorter prompt."
                : err instanceof Error
                  ? err.message
                  : String(err);
            send({ type: "error", message: msg });
            break;
          }
          clearTimeout(geminiTimeout);

          if (!geminiRes.ok || !geminiRes.body) {
            const errText = await geminiRes.text().catch(() => "");
            send({ type: "error", message: friendlyGeminiError(geminiRes.status, errText) });
            break;
          }

          // Accumulate the model's parts so we can append them to history if it
          // issues a tool call (then loop again with the tool result).
          const modelParts: Array<Record<string, unknown>> = [];
          let pendingFunctionCall: { name: string; args?: Record<string, unknown> } | null = null;
          let writingStarted = false;
          let reasoningEmittedThisStep = false;

          for await (const chunk of parseGeminiSSE(geminiRes.body)) {
            const candidate = (chunk as { candidates?: Array<Record<string, unknown>> }).candidates?.[0];
            if (!candidate) continue;
            const content = candidate.content as { parts?: Array<Record<string, unknown>> } | undefined;
            const parts = content?.parts || [];
            for (const part of parts) {
              if ((part as { thought?: boolean }).thought) {
                const text = (part as { text?: string }).text || "";
                if (text) {
                  if (!reasoningEmittedThisStep) {
                    reasoningEmittedThisStep = true;
                  }
                  send({ type: "reasoning_delta", text });
                  modelParts.push(part);
                }
              } else if ((part as { functionCall?: unknown }).functionCall) {
                pendingFunctionCall = (part as { functionCall: { name: string; args?: Record<string, unknown> } })
                  .functionCall;
                modelParts.push(part);
              } else if ((part as { text?: string }).text) {
                const text = (part as { text: string }).text;
                if (!writingStarted) {
                  send({ type: "state", value: "writing" });
                  send({ type: "state", value: null });
                  writingStarted = true;
                }
                send({ type: "text_delta", text });
                modelParts.push(part);
              }
            }
          }

          // Append the model's response to history.
          if (modelParts.length > 0) {
            contents.push({ role: "model", parts: modelParts });
          }

          // If the model requested a tool call, run it and loop.
          if (
            pendingFunctionCall &&
            pendingFunctionCall.name === "web_search" &&
            enableWeb &&
            searchKey &&
            toolCallCount < MAX_TOOL_CALLS
          ) {
            toolCallCount++;
            const query = ((pendingFunctionCall.args as { query?: string })?.query || "").trim();

            send({ type: "state", value: "searching", query });
            send({ type: "tool_start", query });

            try {
              const results = await tavilySearch(query, searchKey);
              const newSources = results.map((r) => makeSource(r, nextSourceId++));
              allSources.push(...newSources);

              send({ type: "sources", items: allSources });
              send({ type: "state", value: "reading", count: allSources.length });

              // Send the tool result back to the model.
              // Gemini's REST API expects role "user" for function responses,
              // and the response object should be JSON-serializable nested data
              // the model can read like a tool return value.
              contents.push({
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name: "web_search",
                      response: {
                        query,
                        result_count: newSources.length,
                        results: newSources.length
                          ? newSources.map((s) => ({
                              id: s.id,
                              title: s.title,
                              url: s.url,
                              snippet: s.snippet,
                            }))
                          : [{ note: "No results found. Try a different query or answer from training data." }],
                      },
                    },
                  },
                ],
              });

              send({ type: "state", value: "synthesizing" });
              continue; // loop back to call Gemini again with the tool result
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              send({ type: "error", message: msg });
              break;
            }
          }

          // No more tool calls — we're done.
          break;
        }

        send({ type: "done", sources: allSources, toolCalls: toolCallCount });
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
