import { orth } from "../orthogonal";
import type { ToolModule, ExecCtx, ToolResult } from "./_types";

interface DiscoverArgs {
  query?: string;
}

/**
 * Escape hatch #1: natural-language search across Orthogonal's full catalog
 * of 55+ APIs. Use when the four built-in tools don't cover the request.
 * The LLM can then call `orth_call` with the discovered api+path.
 */
const orth_discover: ToolModule = {
  cardKind: "discover",
  providerLabel: "Orthogonal /v1/search",
  def: {
    type: "function",
    function: {
      name: "orth_discover",
      description:
        "Search Orthogonal's catalog of 55+ APIs by natural language. Returns matching provider slugs and endpoint descriptions. Use when none of the dedicated tools (apollo_search_people, enrich_contact, company_signals, web_search, send_email) fit the user's request — then follow up with orth_call.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language description of what you want to do (e.g. 'verify an email address', 'fetch tech stack of a website').",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, _ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as DiscoverArgs;
    if (!args.query) {
      return {
        llmContent: JSON.stringify({ error: "query is required" }),
        cardPayload: { error: "query is required" },
        priceCents: 0,
        calls: [],
        error: "query is required",
      };
    }
    const r = await orth().search(args.query);
    if (!r.success) {
      return {
        llmContent: JSON.stringify({ error: r.error }),
        cardPayload: { error: r.error },
        priceCents: 0,
        calls: [],
        error: r.error,
      };
    }
    // /v1/search returns { success: true, results: [{ slug, name, endpoints: [{ path, method, ... }] }] }
    // Keep top 6 for both LLM + UI. There's no api-level description field, so
    // synthesize one from the first 2 endpoint paths.
    type SearchEndpoint = { path?: string; method?: string; description?: string };
    type SearchHit = { slug: string; name: string; endpoints?: SearchEndpoint[] };
    const data = r.data as { results?: SearchHit[]; apis?: SearchHit[] };
    const hits = data.results ?? data.apis ?? [];
    const apis = hits.slice(0, 6).map((a) => {
      const eps = a.endpoints ?? [];
      const preview = eps
        .slice(0, 2)
        .map((e) => `${(e.method ?? "GET").toUpperCase()} ${e.path ?? ""}`.trim())
        .filter(Boolean)
        .join(" · ");
      return {
        slug: a.slug,
        name: a.name,
        description: preview || undefined,
        endpoint_count: eps.length,
      };
    });

    const llmContent = JSON.stringify({
      query: args.query,
      matched_apis: apis,
      note: "To execute one, call `orth_call` with the slug as `api` and the desired endpoint path.",
    });

    return {
      llmContent,
      cardPayload: { query: args.query, matches: apis },
      priceCents: 0,
      calls: [],
    };
  },
};

export default orth_discover;
