# Orthogonal Chat

A chat app where the assistant has live access to Orthogonal's unified API catalog (55+ providers behind one key). The agent picks the right tool for each turn — Apollo for prospecting, ContactOut for enrichment, PredictLeads for funding/jobs/news, Tavily for the web, AgentMail for outreach (draft + user-confirmed send), plus two escape-hatch tools that cover the remaining 50.

Built for the Orthogonal take-home. Stack: Next.js 16 App Router · React 19 · TypeScript · OpenAI tool-calling (gpt-5-mini, streaming) · `/v1/run` direct against `api.orth.sh` · Neon Postgres (Drizzle) · Upstash Redis · Tailwind · framer-motion.

---

## Running locally

```bash
npm install
cp .env.example .env.local       # fill in OPENAI_API_KEY + ORTHOGONAL_API_KEY at minimum
npm run dev
```

`DATABASE_URL` and `UPSTASH_REDIS_REST_*` are optional — the app degrades gracefully. Without them, conversations live in localStorage, the response cache and rate-limit / circuit breaker / draft store fall back to in-process Maps. The full architecture is exercised in both modes.

If you have a Neon database:

```bash
npm run db:generate   # regenerate SQL from lib/db/schema.ts
npm run db:push       # or `npm run db:migrate` against DATABASE_URL
```

---

## 1. Approach

The brief asks for a chat with real Orthogonal data + thoughtful answers to five things:
context bloat, persistence, system design, concurrency, resilience. I treated those as the rubric.

**Scope chosen deliberately.** Orthogonal exposes 55 verified APIs. Wiring all of them sloppily would have shown poor judgment. I picked 5 dedicated tools that map cleanly to the GTM-chat demo arc the brief implies — *find → enrich → signal → search → outreach* — and added 2 escape-hatch tools so the agent can still reach the other 50:

| Tool | Provider | What it does |
|---|---|---|
| `apollo_search_people` | Apollo | People search with optional contact enrichment for top N |
| `enrich_contact` | ContactOut | Single-person enrichment (email/phone/role) by LinkedIn / email / name |
| `company_signals` | PredictLeads | Parallel fetch of funding events + job openings + news for a domain |
| `web_search` | Tavily | Live web search with citations rendered as inline `[1]` chips |
| `send_email` | AgentMail | **Draft + user-confirm** flow. Tool never sends; user clicks Send in the UI; capped at 3 sends/session; subject auto-prefixed with `[DEMO]`; footer auto-appended |
| `orth_discover` | Orthogonal `/v1/search` | Natural-language search across the full catalog |
| `orth_call` | Orthogonal `/v1/run` | Direct passthrough to any provider after `orth_discover` surfaces it |

The chat is built around **the brief's hardest question**: "how does your app handle the context window filling up?" My answer is built into the UI: two stacked bars in the header, with real `o200k_base` tokenization on both sides.

- **`ctx` bar** — what we actually send to OpenAI after sliding-window trimming + tool-result summarization.
- **`naive` bar** — what a chatbot without compaction *would have* sent (full untouched history, every raw tool blob). When this exceeds the model's context limit, the bar turns red and a marker shows the overflow in tokens.

When compaction fires, an inline italic notice in the chat says "*summarized 6 tool results — sent 31k tokens. Without compaction we'd be at 98k tokens (76% of limit).*" Or, when the dual-track shows we crossed the line: "*…we would have crashed at this message.*"

Both numbers are computed with the same encoder (`js-tiktoken` `o200k_base`, what GPT-5 actually uses). No estimation. The UI is the proof.

---

## 2. System design

### Architecture

```
                              ┌─────────────────────────────────────┐
                              │           Browser (chat UI)         │
                              │  conversations.ts → localStorage     │
                              └────────────┬─────────────┬──────────┘
                                  POST /api/chat    POST /api/chat/confirm-send
                                       │                 │
                              ╔════════ Vercel Fluid Compute (Node 24) ════════╗
                              ║                                                ║
            ┌─────────────────╨───────┐                ┌───────────────────────╨──┐
            │  app/api/chat/route.ts  │                │ confirm-send/route.ts    │
            │  • signed cookie → uid  │                │ verify draft + cap      │
            │  • rate-limit (Upstash) │                │  → Orthogonal AgentMail │
            │  • budget messages      │                └─────────────────────────┘
            │  • OpenAI tool loop     │
            │  • dispatch tool exec   │
            │  • emit NDJSON stream   │
            └────────┬────────────────┘
                     │
                     │ each tool call goes through guardedCall():
                     │
      ┌──────────────▼──────────────┐ ┌─────────────────────┐
      │  lib/circuit-breaker.ts     │ │ lib/cache.ts        │
      │  per-provider, 5 fail / 60s │ │ sha256(api+path+q)  │
      │  open → fail-fast           │ │ tiered TTL          │
      └──────────────┬──────────────┘ │ + in-flight coalesce│
                     │                └─────────┬───────────┘
                     ▼                          │
      ┌──────────────────────────────┐          │ cache miss
      │  lib/orthogonal.ts           │ ◄────────┘
      │  POST api.orth.sh/v1/run     │
      │  5s timeout · 1 retry/jitter │
      └──────────────┬───────────────┘
                     ▼
      ┌──────────────────────────────┐
      │ Orthogonal · 55 providers    │
      │ Apollo  ContactOut  Tavily   │
      │ PredictLeads  AgentMail  …   │
      └──────────────────────────────┘

   Persistence (lazy, only when DATABASE_URL set):
      users · conversations · messages · tool_calls
      (every guarded call persists provider, path, args, response,
       price_cents, cached_from_id, latency_ms)
```

### Databases — why two

The brief asks for "database(s)" — plural. I use both and they do different work:

- **Postgres (Neon serverless via Drizzle)** is the durable system of record. Schema is 4 tables: `users`, `conversations`, `messages`, `tool_calls`. Conversations + messages survive across devices and reloads. The `tool_calls` table is where the cost / cache-hit / per-provider analytics live — one row per guarded call with `price_cents`, `cached_from_id`, `latency_ms`. A single `GROUP BY provider, date(created_at)` answers "what's our hit rate per provider this week, and what's our cost-per-user-turn?"
- **Upstash Redis** is the volatile coordination layer. It holds the response cache (with tiered TTLs), the per-user rate-limit counter, and the per-user send-count for the email confirm flow. Hot, ephemeral, key/value. Pgsql is the wrong tool for "shared 5-minute TTL state across 12 cold serverless instances."

Both are **lazy and graceful**: if `DATABASE_URL` is empty, conversations stay client-only (localStorage in the browser) and the take-home demo still works. If Upstash creds are empty, every Redis-backed module falls back to a process-local Map. The architecture exists in both modes; production turns on the persistent backends with a single env flip.

### Caching tiers

The brief asks "how would you handle multiple users hitting the **same** APIs concurrently?" Two layers, both keyed by `sha256(provider + path + sortedQuery)` so identical payloads dedupe regardless of who's asking:

1. **In-flight coalescing (in-process, 30s).** If two requests hit the same cache key within 30s, the second one *awaits* the first's promise instead of firing a duplicate upstream call. This is the answer to "two users asking 'tell me about Stripe' within the same second."
2. **Response cache (Redis, tiered TTL).**
   - **24h** for enrichments (`apollo people/match`, `contactout enrich`, `tomba combined/find`) — stable data.
   - **1h** default.
   - **5min** for news / financing / web search — high churn.

Cache hits return `priceCents: 0` and surface a `cached` badge in the UI tool card. In the DB they get a `cached_from_id` pointing at the original call so analytics distinguish "real call" from "served from cache."

### Resilience — what happens when an API is slow or down

Per Orthogonal call:
1. **Circuit-breaker gate** — per-provider state. 5 consecutive failures → open for 60s. While open, calls fail-fast with a synthetic degraded response so the agent can adapt ("Apollo is unavailable") instead of waiting through every timeout.
2. **5s timeout** — Orthogonal calls abort at 5s with `AbortController`.
3. **1 retry with jitter** — on HTTP 5xx or 429, sleep 150–350ms, retry once.
4. **Per-tool isolation** — if Apollo dies, web_search still works in the same turn. Parallel tool calls don't share fate.

**UX side.** When a tool errors, the tool card renders muted with the error reason inline + a **Retry** button (re-fires the last user message). The rest of the assistant turn continues — one bad call doesn't blow up the whole response. The streaming protocol is NDJSON, so partial results render as they arrive; the user sees thinking → tool 1 succeeds → tool 2 fails (with retry) → text response continues to stream.

### Concurrency story

- **Per-user rate limit**: 20 requests / 60s sliding window via `@upstash/ratelimit` keyed on the cookie uid.
- **Per-user send cap**: max 3 emails / 24h via Redis `INCR` + `EXPIRE`. AgentMail won't burn the demo budget.
- **Stateless route**: every `/api/chat` request is fully self-contained. The Neon driver and Redis client are HTTP-based and pool-free, so cold-starting under load doesn't compound.
- **Fluid Compute on Vercel** reuses function instances across concurrent requests, which makes the in-process coalescing layer (above) actually load-bearing — a hot instance sees adjacent users on the same key.

### Scaling — what changes at 100 / 10k / 1M users

| Bottleneck | Today | 100 users | 10k users | 1M users |
|---|---|---|---|---|
| `/api/chat` cost | Per-turn OpenAI + Orthogonal calls | Same | Same | Same — pay-as-you-go |
| Postgres reads | None for chat path (writes only) | Fine | Fine — `(user_id, updated_at)` index covers sidebar | Read replica for sidebar; partition `messages` by month |
| Postgres writes | One conversation upsert + N tool_calls/turn | Fine | Fine — Neon scales | Batch tool_calls writes; consider event log → ClickHouse |
| Redis | Cache + rate-limit + drafts | Upstash free tier | Paid tier ($10/mo) | Per-region Upstash with read-through; promote breaker state from process to Redis |
| Circuit breaker | In-process Map (per-instance) | Acceptable | Move to Redis (shared state) | Already in Redis |
| Send cap | Redis INCR per user | Fine | Fine | Fine |
| Drafts | Redis with 1h TTL | Fine | Fine | Fine |
| Tool execution | Promise.all in route | Fine | Fine | Pull expensive tools (deep enrich, web crawl) into Vercel Queues for durable, retried, out-of-band execution |
| AgentMail inboxes | One shared `[DEMO]` inbox | Per-tenant inbox | Pool of inboxes | Spin per-account inboxes on signup, scheduled cleanup |

The two real architectural moves between today and 10k users: **(1) promote the circuit breaker from in-process state to Redis** so all warm instances share it, **(2) move long-running tools (deep research, agent loops) to Vercel Queues** so `/api/chat` stays under 60s. Everything else is index/quota tuning.

---

## 3. What I'd do with more time

- **Eval harness.** Replay top user prompts against a fixed model + tool snapshot, score with an LLM judge, gate deploys on regressions. Right now I tested by using the chat — the brief's "as you build *and use* your chat" line is exactly the right method but a real product needs automated coverage.
- **pgvector semantic memory.** For long-running conversations, embed the last N summarized turns and retrieve the most relevant 3 instead of always keeping the most recent. Sliding-window is the dumb-fast answer; vector retrieval is the right answer for hour-long sessions.
- **Real auth.** Anonymous cookie + signed HMAC is fine for the take-home. For a real product, swap to Clerk (native Vercel Marketplace integration) so conversations follow the user across devices.
- **Multi-tenant workspaces.** Schema is single-user. The change is one `workspace_id` column on every table + a middleware that derives workspace from subdomain.
- **Live cost-per-turn breakdown.** The header shows total cost. The README's `tool_calls` table can answer per-provider cost; expose it in the UI ("this turn used Apollo 3x for $0.04, ContactOut 1x for $0.02").
- **More provider cards.** Right now `orth_call` falls back to a generic JSON dropdown for the other 50 providers. Production would add typed cards for at least Tomba (email verification), Hunter, Fundable, OpenFunnel, and Coresignal.
- **Tool-call streaming progress.** Apollo enrich-top-5 takes ~3s; the card sits in "calling Apollo…" state the whole time. Could stream per-person enrichment updates so people pop in one-by-one.
- **AgentMail polish.** Per-user inbox creation, inbox switcher in settings, draft history, reply threading. Today's send is one-shot with a single shared inbox.
- **Model routing via OpenRouter or the Vercel AI Gateway.** Currently hard-coded to `gpt-5-mini`. The gateway would let us fall back to Claude or Gemini on rate limits without code changes.
- **CSV / Notion export.** Sales people want to dump an Apollo search to a sheet. Two endpoints + one button.

---

## File tour

```
lib/
  orthogonal.ts          thin /v1/run wrapper — typed correctly (priceCents:number, requestId)
  openai.ts              client + tiktoken o200k_base counter
  context.ts             dual-track budgeter (actual + naive + crash detection)
  cache.ts               sha256-keyed two-layer cache (Redis + in-flight coalesce)
  circuit-breaker.ts     per-provider state machine
  rate-limit.ts          @upstash/ratelimit, graceful no-op fallback
  cookies.ts             signed HMAC anonymous user cookie
  draft-store.ts         pending-email store for confirm-send flow
  redis.ts / db/         lazy clients, graceful fallback
  tools/
    _runtime.ts          guardedCall — gate → cache → timeout → retry → record
    _types.ts            tool module interface
    apollo.ts ... orth_call.ts   one file per tool + registry

app/
  api/chat/route.ts                 the loop — OpenAI streaming, tool dispatch, NDJSON
  api/chat/confirm-send/route.ts    user-clicked email send
  api/conversations/route.ts        list user's conversations (DB-backed, lazy)
  api/conversations/[id]/route.ts   single conversation with message history
  chat/page.tsx                     shell + state
  page.tsx                          landing

components/
  ChatArea.tsx           live two-bar context meter, cost meter, event handlers
  AIMessage.tsx          renders tool cards + compaction notices + streaming text
  CompactionNotice.tsx   inline italic "we trimmed N messages, naive count was Xk"
  tool-cards/index.tsx   provider-specific cards: Apollo people, contact, signals, web, draft, discover, generic
  ...

drizzle/
  0000_*.sql             initial schema migration
```

---

Built with Claude Code. Brief acknowledged, scope locked twice, executed in 2 commits.
