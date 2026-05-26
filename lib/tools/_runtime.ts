import { randomUUID } from "node:crypto";
import { orth } from "../orthogonal";
import { canCall, recordSuccess, recordFailure } from "../circuit-breaker";
import { cacheKey, withCache, type CacheTier } from "../cache";
import type { GuardedCallResult } from "./_types";

interface MakeCallOpts {
  api: string;
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  method?: "DELETE" | "PATCH";
  cacheTier?: CacheTier;
  timeoutMs?: number;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * One call through every guard: circuit breaker → cache (with in-flight
 * coalescing) → 5s timeout → 1 retry with jitter on 5xx/429 → record
 * success/failure for the breaker.
 *
 * Always returns a `callId` (generated even on cache hits — the route uses
 * it as the tool_calls row primary key).
 */
export async function guardedCall(opts: MakeCallOpts): Promise<GuardedCallResult> {
  const callId = randomUUID();
  const startedAt = Date.now();

  // 1. circuit gate
  const gate = canCall(opts.api);
  if (!gate.ok) {
    return {
      ok: false,
      error: gate.reason,
      priceCents: 0,
      cached: false,
      latencyMs: 0,
      callId,
    };
  }

  // 2. cache key
  const key = cacheKey(opts.api, opts.path, opts.query, opts.body);
  const timeoutMs = opts.timeoutMs ?? 5_000;

  try {
    const wrapped = await withCache<{ data: unknown; priceCents: number }>(
      key,
      opts.cacheTier ?? "default",
      async () => {
        // 1st attempt
        let r = await orth().run({
          api: opts.api,
          path: opts.path,
          query: opts.query,
          body: opts.body,
          method: opts.method,
          timeoutMs,
        });
        // retry once on 5xx / 429 with jitter
        if (!r.success && (r.status >= 500 || r.status === 429)) {
          await sleep(150 + Math.random() * 200);
          r = await orth().run({
            api: opts.api,
            path: opts.path,
            query: opts.query,
            body: opts.body,
            method: opts.method,
            timeoutMs,
          });
        }
        if (!r.success) {
          recordFailure(opts.api);
          throw new Error(r.error);
        }
        recordSuccess(opts.api);
        return {
          value: { data: r.data, priceCents: r.priceCents },
          sourceId: callId,
        };
      },
    );

    const payload = wrapped.value as { data: unknown; priceCents: number };
    return {
      ok: true,
      data: payload.data,
      priceCents: wrapped.cached ? 0 : payload.priceCents,
      cached: wrapped.cached,
      cachedFromId: wrapped.cached ? wrapped.cachedFromId : undefined,
      latencyMs: Date.now() - startedAt,
      callId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: msg,
      priceCents: 0,
      cached: false,
      latencyMs: Date.now() - startedAt,
      callId,
    };
  }
}
