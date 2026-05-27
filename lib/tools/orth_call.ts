import type { ToolModule, ExecCtx, ToolResult, ToolCallTrace } from "./_types";

interface OrthCallArgs {
  api?: string;
  path?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  method?: "DELETE" | "PATCH";
}

const LLM_RESPONSE_CHAR_CAP = 4000;

/**
 * Escape hatch #2: direct passthrough to Orthogonal's /v1/run for any of
 * the 55+ providers the dedicated tools don't cover. The LLM uses this
 * after `orth_discover` surfaces a matching api+path.
 */
const orth_call: ToolModule = {
  cardKind: "generic",
  providerLabel: "Orthogonal /v1/run",
  def: {
    type: "function",
    function: {
      name: "orth_call",
      description:
        "Execute any API on the Orthogonal platform by provider slug + path. Use ONLY after orth_discover surfaces a suitable api. The response is shown raw to the user (capped at 4000 chars in your view).",
      parameters: {
        type: "object",
        properties: {
          api: { type: "string", description: "Orthogonal provider slug (e.g. 'tomba', 'aviato')." },
          path: { type: "string", description: "Upstream endpoint path with any URL params already interpolated (e.g. /v3/companies/stripe.com/news_events). Do NOT append query strings here — the catalog validates the path exactly. Put query params in the `query` object instead." },
          query: {
            type: "object",
            description: "Query-string parameters for GET endpoints.",
            additionalProperties: true,
          },
          body: {
            type: "object",
            description: "JSON body for POST/PUT/PATCH endpoints.",
            additionalProperties: true,
          },
          method: {
            type: "string",
            enum: ["DELETE", "PATCH"],
            description: "Only needed for DELETE/PATCH upstream verbs (rare).",
          },
        },
        required: ["api", "path"],
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as OrthCallArgs;
    if (!args.api || !args.path) {
      return {
        llmContent: JSON.stringify({ error: "api and path are required" }),
        cardPayload: { error: "missing api or path" },
        priceCents: 0,
        calls: [],
        error: "missing api or path",
      };
    }

    // Defensive: the model sometimes encodes query params into the path
    // string (e.g. "/v3/companies/x/foo?verbose=true") instead of using the
    // query argument. Orthogonal's catalog validates the path EXACTLY against
    // registered endpoints — a trailing "?qs" produces a 404 like
    // "Endpoint ... not found in API <slug>". Split it apart here so the call
    // still works regardless of which shape the model picked.
    let path = args.path;
    let query: Record<string, unknown> | undefined = args.query;
    const qIdx = path.indexOf("?");
    if (qIdx >= 0) {
      const search = new URLSearchParams(path.slice(qIdx + 1));
      path = path.slice(0, qIdx);
      const merged: Record<string, unknown> = { ...(query ?? {}) };
      for (const [k, v] of search.entries()) {
        if (!(k in merged)) merged[k] = v;
      }
      query = merged;
    }

    const calls: ToolCallTrace[] = [];
    let r = await ctx.call({
      api: args.api,
      path,
      query,
      body: args.body,
      method: args.method,
      cacheTier: "default",
    });
    calls.push({ callId: r.callId, api: args.api, path, args: { query, body: args.body }, result: r });

    // Defensive: a 422 on a discovered endpoint usually means the model guessed
    // the wrong query param name. Different providers use different names for
    // "the website you want me to look up" — Tomba wants `domain`, Hunter wants
    // `domain`, BuiltWith wants `url`, some want `website`. If our first call
    // had one of those keys and 422'd, retry once swapping aliases instead of
    // dying. Bounded to one extra hop so we don't burn calls in a loop.
    const PARAM_ALIASES: Record<string, string[]> = {
      url: ["domain", "website"],
      domain: ["url", "website"],
      website: ["url", "domain"],
    };
    if (!r.ok && /\b422\b/.test(r.error ?? "") && query) {
      const keyToSwap = Object.keys(query).find((k) => k in PARAM_ALIASES);
      if (keyToSwap) {
        for (const altName of PARAM_ALIASES[keyToSwap]) {
          if (altName in query) continue;
          const altQuery: Record<string, unknown> = { ...query };
          altQuery[altName] = altQuery[keyToSwap];
          delete altQuery[keyToSwap];
          const retry = await ctx.call({
            api: args.api,
            path,
            query: altQuery,
            body: args.body,
            method: args.method,
            cacheTier: "default",
          });
          calls.push({
            callId: retry.callId,
            api: args.api,
            path,
            args: { query: altQuery, body: args.body, _retryFor: r.error },
            result: retry,
          });
          if (retry.ok) {
            r = retry;
            query = altQuery;
            break;
          }
        }
      }
    }

    if (!r.ok) {
      return {
        llmContent: JSON.stringify({ error: r.error }),
        cardPayload: { api: args.api, path: args.path, error: r.error },
        priceCents: 0,
        calls,
        error: r.error,
      };
    }

    const raw = JSON.stringify(r.data);
    const capped = raw.length > LLM_RESPONSE_CHAR_CAP ? raw.slice(0, LLM_RESPONSE_CHAR_CAP) + "...(truncated)" : raw;

    return {
      llmContent: capped,
      cardPayload: { api: args.api, path: args.path, data: r.data },
      priceCents: r.priceCents,
      calls,
    };
  },
};

export default orth_call;
