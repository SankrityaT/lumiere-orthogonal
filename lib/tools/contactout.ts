import type { ToolModule, ExecCtx, ToolResult, ToolCallTrace } from "./_types";

interface EnrichArgs {
  linkedin_url?: string;
  email?: string;
  full_name?: string;
  company?: string;
  company_domain?: string;
  include_phone?: boolean;
}

const contactout: ToolModule = {
  cardKind: "contact-enrich",
  providerLabel: "ContactOut",
  def: {
    type: "function",
    function: {
      name: "enrich_contact",
      description:
        "Look up a specific person's contact details (email, phone, LinkedIn, current role) via ContactOut. Pass any ONE of: linkedin_url, email, or (full_name + company). Use when the user gives you a specific person to enrich.",
      parameters: {
        type: "object",
        properties: {
          linkedin_url: {
            type: "string",
            description: "Full LinkedIn profile URL (preferred — richest enrichment).",
          },
          email: {
            type: "string",
            description: "Work or personal email address.",
          },
          full_name: {
            type: "string",
            description: "Person's full name. Pair with `company` for name-based lookup.",
          },
          company: {
            type: "string",
            description: "Company name. Pair with `full_name`.",
          },
          company_domain: {
            type: "string",
            description: "Company domain (e.g. stripe.com) to disambiguate name lookups.",
          },
          include_phone: {
            type: "boolean",
            default: false,
            description: "Whether to attempt phone-number enrichment (costs more).",
          },
        },
        additionalProperties: false,
      },
    },
  },

  async execute(rawArgs, ctx: ExecCtx): Promise<ToolResult> {
    const args = rawArgs as EnrichArgs;
    const calls: ToolCallTrace[] = [];

    let result: ToolCallTrace["result"];
    let endpointTag: string;

    if (args.linkedin_url) {
      endpointTag = "/v1/linkedin/enrich";
      const query: Record<string, unknown> = { profile: args.linkedin_url, profile_only: !args.include_phone };
      result = await ctx.call({ api: "contactout", path: endpointTag, query, cacheTier: "enrichment" });
      calls.push({ callId: result.callId, api: "contactout", path: endpointTag, args: query, result });
    } else if (args.email) {
      endpointTag = "/v1/email/enrich";
      const query = { email: args.email };
      result = await ctx.call({ api: "contactout", path: endpointTag, query, cacheTier: "enrichment" });
      calls.push({ callId: result.callId, api: "contactout", path: endpointTag, args: query, result });
    } else if (args.full_name) {
      endpointTag = "/v1/people/enrich";
      const body: Record<string, unknown> = { full_name: args.full_name };
      if (args.company) body.company = [args.company];
      if (args.company_domain) body.company_domain = args.company_domain;
      result = await ctx.call({ api: "contactout", path: endpointTag, body, cacheTier: "enrichment" });
      calls.push({ callId: result.callId, api: "contactout", path: endpointTag, args: body, result });
    } else {
      return {
        llmContent: JSON.stringify({ error: "Pass linkedin_url OR email OR (full_name + company)." }),
        cardPayload: { error: "missing identifier" },
        priceCents: 0,
        calls,
        error: "missing identifier",
      };
    }

    if (!result.ok) {
      return {
        llmContent: JSON.stringify({ error: result.error }),
        cardPayload: { error: result.error, endpoint: endpointTag },
        priceCents: 0,
        calls,
        error: result.error,
      };
    }

    // ContactOut response shapes vary by endpoint. Normalize to a common envelope.
    const raw = result.data as Record<string, unknown>;
    const profile =
      (raw.profile as Record<string, unknown>) ??
      (raw.data as Record<string, unknown>) ??
      raw;

    const normalized = {
      name: (profile.full_name as string) ?? (profile.name as string) ?? args.full_name,
      title: (profile.title as string) ?? (profile.job_title as string) ?? (profile.headline as string),
      company:
        ((profile.company as Record<string, unknown>)?.name as string) ??
        (profile.company_name as string) ??
        args.company,
      location:
        (profile.location as string) ??
        ((profile.location as Record<string, unknown>)?.name as string),
      linkedin: (profile.linkedin_url as string) ?? (profile.linkedin as string) ?? args.linkedin_url,
      emails: (profile.emails as string[]) ?? (profile.email ? [profile.email as string] : []),
      phones: (profile.phones as string[]) ?? (profile.phone ? [profile.phone as string] : []),
      role_history: (profile.work_experience as unknown[]) ?? (profile.experience as unknown[]) ?? [],
    };

    return {
      llmContent: JSON.stringify(normalized),
      cardPayload: normalized,
      priceCents: result.priceCents,
      calls,
    };
  },
};

export default contactout;
