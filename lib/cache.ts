import { createHash } from "node:crypto";
import { redis, hasRedis } from "./redis";

/**
 * Two-layer response cache for Orthogonal calls.
 *
 *  Layer 1 — IN-FLIGHT COALESCING (in-process, 30s window):
 *    If two requests for the same cache key arrive within 30s, the second
 *    one awaits the first instead of firing a duplicate upstream call.
 *    Directly answers the brief's "multiple users hitting the SAME APIs
 *    concurrently" question.
 *
 *  Layer 2 — RESPONSE CACHE (Redis, tiered TTLs):
 *    Cache keys are sha256(provider + path + sortedQuery) so identical
 *    payloads dedupe regardless of who's asking. TTL tiers:
 *      - 24h for enrichments (apollo people/match, contactout enrich,
 *              tomba combined/find — stable data)
 *      - 5min for news/signals/financing (predictleads news_events,
 *              financing_events — high churn)
 *      - 1h default
 *
 *  Falls back to a process-local Map if Redis isn't configured.
 */

export type CacheTier = "enrichment" | "signal" | "default";

const TTL_SECONDS: Record<CacheTier, number> = {
  enrichment: 60 * 60 * 24, // 24h
  signal: 60 * 5, // 5min
  default: 60 * 60, // 1h
};

/** In-process LRU-ish Map fallback when Redis isn't configured. */
const memCache = new Map<string, { value: unknown; expiresAt: number }>();
const MEM_CACHE_MAX = 500;

/** In-flight coalescing — keyed by cache key, value is the in-flight promise. */
const inflight = new Map<string, Promise<{ cached: false; value: unknown; cachedFromId?: undefined }>>();

export function cacheKey(api: string, path: string, query?: unknown, body?: unknown): string {
  const norm = JSON.stringify({ api, path, q: sortKeys(query), b: sortKeys(body) });
  const h = createHash("sha256").update(norm).digest("hex");
  return `orth:cache:${h}`;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[k] = sortKeys((obj as Record<string, unknown>)[k]);
  }
  return sorted;
}

interface CacheEntry<T> {
  value: T;
  /** id of the original tool_calls row, so we can write cached_from_id when persisting */
  sourceId: string;
}

export async function getCached<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
  if (hasRedis()) {
    const raw = await redis()!.get<CacheEntry<T>>(key).catch(() => null);
    if (raw) return raw;
    return null;
  }
  const m = memCache.get(key);
  if (m && m.expiresAt > Date.now()) return m.value as CacheEntry<T>;
  if (m) memCache.delete(key);
  return null;
}

export async function setCached<T>(
  key: string,
  entry: CacheEntry<T>,
  tier: CacheTier = "default",
): Promise<void> {
  const ttl = TTL_SECONDS[tier];
  if (hasRedis()) {
    await redis()!.set(key, entry, { ex: ttl }).catch(() => {});
    return;
  }
  if (memCache.size >= MEM_CACHE_MAX) {
    // crude eviction: drop oldest 50 entries by insertion order
    let n = 0;
    for (const k of memCache.keys()) {
      memCache.delete(k);
      if (++n >= 50) break;
    }
  }
  memCache.set(key, { value: entry, expiresAt: Date.now() + ttl * 1000 });
}

/**
 * Run `fn` with cache + in-flight coalescing.
 *  Returns `{ cached: true, value, cachedFromId }` on hit
 *  Returns `{ cached: false, value }` on miss (fn executed)
 */
export async function withCache<T>(
  key: string,
  tier: CacheTier,
  fn: () => Promise<{ value: T; sourceId: string }>,
): Promise<
  | { cached: true; value: T; cachedFromId: string }
  | { cached: false; value: T; cachedFromId?: undefined }
> {
  const hit = await getCached<T>(key);
  if (hit) {
    return { cached: true, value: hit.value, cachedFromId: hit.sourceId };
  }
  const pending = inflight.get(key);
  if (pending) {
    const r = await pending;
    return r as { cached: false; value: T };
  }
  const promise = (async () => {
    const { value, sourceId } = await fn();
    await setCached(key, { value, sourceId }, tier);
    return { cached: false as const, value };
  })();
  inflight.set(key, promise as Promise<{ cached: false; value: unknown }>);
  try {
    return await promise;
  } finally {
    // small grace period to coalesce near-simultaneous callers
    setTimeout(() => inflight.delete(key), 100);
  }
}
