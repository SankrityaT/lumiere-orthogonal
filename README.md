# Orthogonal Chat

Take-home submission. A web chat where the assistant calls Orthogonal's unified API catalog as tools and renders results inline.

Stack: Next.js 16 (App Router) + React 19, TypeScript, Tailwind, framer-motion, OpenAI tool-calling, Orthogonal `/v1/run`, Neon Postgres, Upstash Redis. Deploys to Vercel.

## Status

This is commit 1 of 2: scaffolding rip. The chat shell is wired (sidebar, conversation list, message streaming protocol, typography) but `/api/chat` is a stub that echoes a placeholder response — no LLM or Orthogonal calls yet. Commit 2 lands the real backend.

## Running locally

```bash
npm install
npm run dev
```

Env (`.env.local`):

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
ORTHOGONAL_API_KEY=
DATABASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## What's coming in commit 2

- `lib/orthogonal.ts` — thin `/v1/run` wrapper (skipping `@orth/sdk` because its `RunResponse.price: string` type doesn't match the wire's `priceCents: number`)
- 7 tools: `apollo_search_people`, `enrich_contact`, `company_signals`, `web_search`, `send_email` (draft+confirm, hardcoded inbox), plus `orth_discover` + `orth_call` as escape hatches for the other 50 providers
- Server-side context budgeting (hard cap on tokens sent to OpenAI, oldest pairs dropped first, old tool results summarized)
- Neon Postgres persistence (`users`, `conversations`, `messages`, `tool_calls`) keyed by signed httpOnly cookie
- Upstash Redis: response cache keyed by `sha256(api+path+query)` with tiered TTLs, 30s in-flight coalescing, per-session rate limit
- Per-provider circuit breaker, 5s timeout + 1 retry with jitter on 5xx/429
- Live context meter and cost meter in the header

## README sections to write

- **Approach** — what was built, the demo arc, the 7-tool surface
- **System design** — architecture diagram, schema, caching tiers, concurrency story, scaling at 100 / 10k / 1M users
- **What I'd do with more time** — AgentMail polish, pgvector semantic memory, real auth, multi-tenant workspaces, model routing, eval harness, more provider cards, export
