import type { ToolModule, ExecCtx, ToolResult, ToolCallTrace } from "./_types";

interface ApolloSearchArgs {
  q_keywords?: string;
  person_titles?: string[];
  person_seniorities?: string[];
  organization_locations?: string[];
  person_locations?: string[];
  max_results?: number;
  enrich_top?: number;
}

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  email?: string;
  phone?: string;
  organization?: { name?: string; primary_domain?: string };
}

const apollo: ToolModule = {
  cardKind: "apollo-people",
  providerLabel: "Apollo",
  def: {
    type: "function",
    function: {
      name: "apollo_search_people",
      description:
        "Search Apollo's database of 210M+ contacts for people matching role/seniority/location/keyword filters. Optionally enriches the top N results with email + phone via people/match. Use for prospecting and GTM lookup questions like 'find people at Stripe in engineering'.",
      parameters: {
        type: "object",
        properties: {
          q_keywords: {
            type: "string",
            description: "Free-text keyword filter (e.g. company name, technology, theme).",
          },
          person_titles: {
            type: "array",
            items: { type: "string" },
            description: "Job titles to match (e.g. ['software engineer', 'staff engineer']).",
          },
          person_seniorities: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "owner",
                "founder",
                "c_suite",
                "partner",
                "vp",
                "head",
                "director",
                "manager",
                "senior",
                "entry",
                "intern",
              ],
            },
            description: "Seniority levels.",
          },
          organization_locations: {
            type: "array",
            items: { type: "string" },
            description: "City / state / country where the company is based.",
          },
          person_locations: {
            type: "array",
            items: { type: "string" },
            description: "City / state / country where the person lives.",
          },
          max_results: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            default: 10,
            description: "Max people to return (1-25).",
          },
          enrich_top: {
            type: "integer",
            minimum: 0,
            maximum: 5,
            default: 0,
            description:
              "How many top results to enrich with email + phone via Apollo people/match. Each enrichment is a separate billed call — keep low (0-3).",
          },
        },
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as ApolloSearchArgs;
    const calls: ToolCallTrace[] = [];

    // 1) Search
    const searchBody: Record<string, unknown> = {
      per_page: Math.min(25, Math.max(1, args.max_results ?? 10)),
      page: 1,
    };
    if (args.q_keywords) searchBody.q_keywords = args.q_keywords;
    if (args.person_titles?.length) searchBody.person_titles = args.person_titles;
    if (args.person_seniorities?.length) searchBody.person_seniorities = args.person_seniorities;
    if (args.organization_locations?.length) searchBody.organization_locations = args.organization_locations;
    if (args.person_locations?.length) searchBody.person_locations = args.person_locations;

    const searchRes = await ctx.call({
      api: "apollo",
      path: "/api/v1/mixed_people/api_search",
      body: searchBody,
      cacheTier: "default",
    });
    calls.push({
      callId: searchRes.callId,
      api: "apollo",
      path: "/api/v1/mixed_people/api_search",
      args: searchBody,
      result: searchRes,
    });

    if (!searchRes.ok) {
      return {
        llmContent: JSON.stringify({ error: searchRes.error }),
        cardPayload: { people: [], error: searchRes.error },
        priceCents: 0,
        calls,
        error: searchRes.error,
      };
    }

    const data = searchRes.data as { people?: ApolloPerson[]; contacts?: ApolloPerson[] };
    const rawPeople = data.people ?? data.contacts ?? [];
    const limited = rawPeople.slice(0, args.max_results ?? 10);

    // 2) Optional enrichment of top N (parallel)
    const enrichN = Math.min(args.enrich_top ?? 0, 5, limited.length);
    let enriched: Record<number, ApolloPerson> = {};
    if (enrichN > 0) {
      const enrichResults = await Promise.all(
        limited.slice(0, enrichN).map(async (p, idx) => {
          const matchBody: Record<string, unknown> = {
            reveal_personal_emails: false,
            reveal_phone_number: false,
          };
          if (p.linkedin_url) {
            matchBody.linkedin_url = p.linkedin_url;
          } else {
            matchBody.first_name = p.first_name;
            matchBody.last_name = p.last_name;
            matchBody.organization_name = p.organization?.name;
            matchBody.domain = p.organization?.primary_domain;
          }
          const r = await ctx.call({
            api: "apollo",
            path: "/api/v1/people/match",
            body: matchBody,
            cacheTier: "enrichment",
          });
          calls.push({ callId: r.callId, api: "apollo", path: "/api/v1/people/match", args: matchBody, result: r });
          if (r.ok && r.data) {
            const matched = (r.data as { person?: ApolloPerson }).person ?? (r.data as ApolloPerson);
            return { idx, person: matched };
          }
          return null;
        }),
      );
      for (const e of enrichResults) {
        if (e) enriched[e.idx] = e.person;
      }
    }

    // Normalize a compact array for both LLM and UI
    const normalized = limited.map((p, idx) => {
      const enrich = enriched[idx] ?? {};
      return {
        name: enrich.name ?? p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        title: enrich.title ?? p.title,
        company: enrich.organization?.name ?? p.organization?.name,
        domain: enrich.organization?.primary_domain ?? p.organization?.primary_domain,
        location: [p.city, p.state, p.country].filter(Boolean).join(", "),
        linkedin: enrich.linkedin_url ?? p.linkedin_url,
        email: enrich.email,
        phone: enrich.phone,
        enriched: idx < enrichN,
      };
    });

    const totalCost = calls.reduce((acc, c) => acc + c.result.priceCents, 0);

    const llmContent = JSON.stringify({
      total_found: rawPeople.length,
      returned: normalized.length,
      enriched_count: enrichN,
      people: normalized.map((p) => ({
        name: p.name,
        title: p.title,
        company: p.company,
        location: p.location,
        email: p.email,
        phone: p.phone,
      })),
    });

    return {
      llmContent,
      cardPayload: { people: normalized, total_found: rawPeople.length, enriched_count: enrichN },
      priceCents: totalCost,
      calls,
    };
  },
};

export default apollo;
