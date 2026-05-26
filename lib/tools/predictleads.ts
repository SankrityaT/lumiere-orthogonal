import type { ToolModule, ExecCtx, ToolResult, ToolCallTrace } from "./_types";

type SignalKind = "financing" | "jobs" | "news";

interface SignalsArgs {
  domain?: string;
  kinds?: SignalKind[];
  limit?: number;
}

const PATH_BY_KIND: Record<SignalKind, string> = {
  financing: "financing_events",
  jobs: "job_openings",
  news: "news_events",
};

const company_signals: ToolModule = {
  cardKind: "company-signals",
  providerLabel: "PredictLeads",
  def: {
    type: "function",
    function: {
      name: "company_signals",
      description:
        "Fetch fresh signals for a specific company via PredictLeads: financing events (funding rounds), job openings, and news. Use when the user asks about a specific company's recent activity, hiring, or funding.",
      parameters: {
        type: "object",
        properties: {
          domain: {
            type: "string",
            description: "Company domain (e.g. stripe.com). REQUIRED.",
          },
          kinds: {
            type: "array",
            items: { type: "string", enum: ["financing", "jobs", "news"] },
            default: ["financing", "jobs", "news"],
            description: "Which signal types to pull. Default = all three.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            default: 5,
            description: "Max items per signal type (1-25).",
          },
        },
        required: ["domain"],
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as SignalsArgs;
    if (!args.domain) {
      return {
        llmContent: JSON.stringify({ error: "domain is required" }),
        cardPayload: { error: "domain is required" },
        priceCents: 0,
        calls: [],
        error: "domain is required",
      };
    }
    const kinds: SignalKind[] = args.kinds?.length ? args.kinds : ["financing", "jobs", "news"];
    const limit = Math.min(25, Math.max(1, args.limit ?? 5));
    const calls: ToolCallTrace[] = [];

    // Parallel per-kind calls.
    // Orthogonal /v1/run validates query params as STRINGS (catalog says
    // `limit: integer` but the runtime validator rejects numbers with
    // "Expected string, received number"). Coerce here.
    const out = await Promise.all(
      kinds.map(async (kind) => {
        const path = `/v3/companies/${encodeURIComponent(args.domain!)}/${PATH_BY_KIND[kind]}`;
        const query: Record<string, unknown> = { limit: String(limit) };
        if (kind === "jobs") query.active_only = "true";
        const r = await ctx.call({
          api: "predictleads",
          path,
          query,
          cacheTier: "signal",
        });
        calls.push({ callId: r.callId, api: "predictleads", path, args: query, result: r });
        return { kind, result: r };
      }),
    );

    const totalCost = calls.reduce((acc, c) => acc + c.result.priceCents, 0);
    const errors = out.filter((o) => !o.result.ok).map((o) => `${o.kind}: ${o.result.error}`);

    // Normalize each
    const normalized: Record<SignalKind, unknown[]> = { financing: [], jobs: [], news: [] };
    for (const o of out) {
      if (!o.result.ok) continue;
      const data = o.result.data as { data?: unknown[] } | unknown[];
      const items = Array.isArray(data) ? data : data?.data ?? [];
      normalized[o.kind] = items.slice(0, limit);
    }

    const llmContent = JSON.stringify({
      domain: args.domain,
      counts: {
        financing: normalized.financing.length,
        jobs: normalized.jobs.length,
        news: normalized.news.length,
      },
      // Cap LLM-facing payload — full data goes to UI card only
      sample: {
        financing: normalized.financing.slice(0, 3),
        jobs: normalized.jobs.slice(0, 3),
        news: normalized.news.slice(0, 3),
      },
      errors: errors.length ? errors : undefined,
    });

    return {
      llmContent,
      cardPayload: { domain: args.domain, signals: normalized, errors },
      priceCents: totalCost,
      calls,
      error: errors.length === kinds.length ? errors.join("; ") : undefined,
    };
  },
};

export default company_signals;
