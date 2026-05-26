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
          path: { type: "string", description: "Upstream endpoint path with any params already interpolated." },
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

    const calls: ToolCallTrace[] = [];
    const r = await ctx.call({
      api: args.api,
      path: args.path,
      query: args.query,
      body: args.body,
      method: args.method,
      cacheTier: "default",
    });
    calls.push({ callId: r.callId, api: args.api, path: args.path, args: { query: args.query, body: args.body }, result: r });

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
