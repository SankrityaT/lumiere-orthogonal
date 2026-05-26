import { Ratelimit } from "@upstash/ratelimit";
import { redis, hasRedis } from "./redis";

/**
 * Per-session sliding-window rate limit on /api/chat.
 *
 * 20 requests per 60s per user. Tight enough to protect against runaway
 * agents or one user racing the loop; loose enough to support healthy
 * conversation cadence + tool retries.
 *
 * When Upstash isn't configured, returns "always allow" — a no-op for the
 * take-home demo so missing infra doesn't break the dev experience. In
 * prod this would always be configured.
 */

let _rl: Ratelimit | null = null;
let _checked = false;

function rl(): Ratelimit | null {
  if (_checked) return _rl;
  _checked = true;
  if (!hasRedis()) return null;
  _rl = new Ratelimit({
    redis: redis()!,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    analytics: false,
    prefix: "orth:rl",
  });
  return _rl;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  reason?: string;
}

export async function checkRate(userId: string): Promise<RateLimitResult> {
  const r = rl();
  if (!r) return { allowed: true, remaining: 99, resetMs: 0 };
  const { success, remaining, reset } = await r.limit(userId);
  return {
    allowed: success,
    remaining,
    resetMs: reset,
    reason: success ? undefined : `Rate limit: 20 requests/min per session. Retry shortly.`,
  };
}
