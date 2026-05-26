import type { ToolModule, ExecCtx, ToolResult, ToolCallTrace } from "./_types";

interface WebSearchArgs {
  query?: string;
  max_results?: number;
  topic?: "general" | "news";
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

const web_search: ToolModule = {
  cardKind: "web-results",
  providerLabel: "Tavily",
  def: {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web (via Tavily on Orthogonal) and return the top results with titles, URLs, and snippets. Use when the user asks about current events, recent announcements, or any fact you can't verify from training data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Specific, focused search query (3-12 words).",
          },
          max_results: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            default: 5,
            description: "How many results to return (1-10).",
          },
          topic: {
            type: "string",
            enum: ["general", "news"],
            default: "general",
            description: "Use 'news' for time-sensitive queries (better recency ranking).",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as WebSearchArgs;
    if (!args.query) {
      return {
        llmContent: JSON.stringify({ error: "query is required" }),
        cardPayload: { error: "query is required" },
        priceCents: 0,
        calls: [],
        error: "query is required",
      };
    }
    const calls: ToolCallTrace[] = [];
    const body: Record<string, unknown> = {
      query: args.query,
      max_results: Math.min(10, Math.max(1, args.max_results ?? 5)),
      search_depth: "basic",
    };
    if (args.topic) body.topic = args.topic;

    const r = await ctx.call({
      api: "tavily",
      path: "/search",
      body,
      cacheTier: "signal",
    });
    calls.push({ callId: r.callId, api: "tavily", path: "/search", args: body, result: r });

    if (!r.ok) {
      return {
        llmContent: JSON.stringify({ error: r.error }),
        cardPayload: { error: r.error, query: args.query },
        priceCents: 0,
        calls,
        error: r.error,
      };
    }

    const data = r.data as { results?: TavilyResult[] };
    const results = (data.results ?? []).map((item, i) => {
      let domain = "source";
      try {
        domain = new URL(item.url ?? "https://x").hostname.replace(/^www\./, "");
      } catch {}
      return {
        id: i + 1,
        title: item.title ?? domain,
        url: item.url ?? "",
        snippet: (item.content ?? "").slice(0, 240),
        domain,
      };
    });

    const llmContent = JSON.stringify({
      query: args.query,
      results: results.map((r) => ({ id: r.id, title: r.title, url: r.url, snippet: r.snippet })),
    });

    return {
      llmContent,
      cardPayload: { query: args.query, results },
      priceCents: r.priceCents,
      calls,
    };
  },
};

export default web_search;
