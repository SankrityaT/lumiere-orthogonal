/**
 * Per-provider circuit breaker.
 *
 * 5 consecutive failures → open for 60s. While open, calls fail-fast with a
 * synthetic degraded response so the agent can adapt ("Apollo is currently
 * unavailable") instead of waiting through every timeout.
 *
 * State is in-memory: fine for the single-instance demo. In prod we'd
 * promote to Redis with the same key shape so all serverless instances
 * share breaker state.
 */

const FAILURE_THRESHOLD = 5;
const OPEN_MS = 60_000;

type BreakerState = "closed" | "open" | "half-open";

interface BreakerEntry {
  state: BreakerState;
  failures: number;
  openedAt: number; // ms timestamp
}

const breakers = new Map<string, BreakerEntry>();

function get(provider: string): BreakerEntry {
  let b = breakers.get(provider);
  if (!b) {
    b = { state: "closed", failures: 0, openedAt: 0 };
    breakers.set(provider, b);
  }
  // auto-transition open → half-open after window
  if (b.state === "open" && Date.now() - b.openedAt > OPEN_MS) {
    b.state = "half-open";
  }
  return b;
}

export function canCall(provider: string): { ok: boolean; reason?: string } {
  const b = get(provider);
  if (b.state === "open") {
    const remaining = Math.ceil((OPEN_MS - (Date.now() - b.openedAt)) / 1000);
    return {
      ok: false,
      reason: `${provider} circuit open (${remaining}s left after ${FAILURE_THRESHOLD} consecutive failures)`,
    };
  }
  return { ok: true };
}

export function recordSuccess(provider: string): void {
  const b = get(provider);
  b.failures = 0;
  b.state = "closed";
  b.openedAt = 0;
}

export function recordFailure(provider: string): void {
  const b = get(provider);
  b.failures += 1;
  if (b.failures >= FAILURE_THRESHOLD) {
    b.state = "open";
    b.openedAt = Date.now();
  }
}

export function breakerState(provider: string): BreakerEntry {
  return { ...get(provider) };
}
