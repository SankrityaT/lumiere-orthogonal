import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
let _checked = false;

/** Returns a Redis client if Upstash creds are set, else null.
 *  Callers must handle the null path — cache/rate-limit/breaker degrade
 *  to in-memory / no-op when Redis is absent. */
export function redis(): Redis | null {
  if (_checked) return _redis;
  _checked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[redis] Upstash creds not set — cache/rate-limit/breaker degrade to in-memory.");
    }
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export function hasRedis(): boolean {
  return redis() !== null;
}
