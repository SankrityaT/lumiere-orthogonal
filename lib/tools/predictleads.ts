import type { ToolModule, ExecCtx, ToolResult, ToolCallTrace } from "./_types";

type SignalKind = "financing" | "jobs" | "news";

interface SignalsArgs {
  domain?: string;
  kinds?: SignalKind[];
  limit?: number;
  verbose?: boolean;
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
          verbose: {
            type: "boolean",
            default: false,
            description:
              "Return full event objects instead of the top-3-per-kind summary. Use when the user asks for detail like 'list ALL recent jobs', deal participants, news bodies. Trades context bloat for completeness.",
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

    // Normalize each. PredictLeads returns JSON:API shape — news article URLs
    // live in the top-level `included` array referenced from each event's
    // `relationships.most_relevant_source.data.id`. Resolve the join here so
    // the card can render flat clickable links without knowing JSON:API.
    const normalized: Record<SignalKind, unknown[]> = { financing: [], jobs: [], news: [] };
    for (const o of out) {
      if (!o.result.ok) continue;
      const data = o.result.data as { data?: unknown[]; included?: unknown[] } | unknown[];
      const items = Array.isArray(data) ? data : data?.data ?? [];
      const included = Array.isArray(data) ? [] : ((data?.included as unknown[]) ?? []);

      // Build id → news_article URL/title map
      const articleById = new Map<string, { url?: string; title?: string }>();
      for (const inc of included) {
        const incObj = inc as { id?: string; type?: string; attributes?: { url?: string; title?: string } };
        if (incObj.type === "news_article" && incObj.id) {
          articleById.set(incObj.id, {
            url: incObj.attributes?.url,
            title: incObj.attributes?.title,
          });
        }
      }

      // For news events, inject source_url + article_title into attributes
      // For financing events, source_urls[] is already present in attributes
      const enriched = (items as Array<Record<string, unknown>>).slice(0, limit).map((item) => {
        if (o.kind !== "news") return item;
        const rels = item.relationships as Record<string, { data?: { id?: string } }> | undefined;
        const articleId = rels?.most_relevant_source?.data?.id;
        if (!articleId) return item;
        const article = articleById.get(articleId);
        if (!article?.url) return item;
        const attrs = (item.attributes as Record<string, unknown>) ?? {};
        return {
          ...item,
          attributes: { ...attrs, source_url: article.url, article_title: article.title },
        };
      });

      normalized[o.kind] = enriched;
    }

    const llmContent = JSON.stringify({
      domain: args.domain,
      counts: {
        financing: normalized.financing.length,
        jobs: normalized.jobs.length,
        news: normalized.news.length,
      },
      // L1 default: top 3 per kind, summarized (~500 tokens).
      // Verbose: full event arrays with all fields (~3-5k tokens).
      sample: args.verbose
        ? {
            financing: normalized.financing,
            jobs: normalized.jobs,
            news: normalized.news,
          }
        : {
            financing: normalized.financing.slice(0, 3),
            jobs: normalized.jobs.slice(0, 3),
            news: normalized.news.slice(0, 3),
          },
      verbose: !!args.verbose,
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
