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
    // /v1/search returns { success: true, apis: [...] } — keep top 6 for both LLM + UI
    const data = r.data as { apis?: Array<{ slug: string; name: string; description?: string; endpoints?: unknown[] }> };
    const apis = (data.apis ?? []).slice(0, 6).map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description?.slice(0, 200),
      endpoint_count: a.endpoints?.length ?? 0,
    }));

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
