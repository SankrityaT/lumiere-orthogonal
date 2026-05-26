import { randomUUID } from "node:crypto";
import { redis, hasRedis } from "./redis";

/**
 * Pending-email draft store for the send_email confirm-flow.
 *
 *   1. send_email tool calls saveDraft() → returns draft_id, no upstream call.
 *   2. UI renders draft card with a "Send" button.
 *   3. POST /api/chat/confirm-send { draft_id, confirmed: true } verifies the
 *      draft + checks per-session send count, then actually fires AgentMail.
 *   4. Drafts expire after 1h. Per-session send cap is 3 (across all drafts).
 *
 * Uses Redis if available, in-memory Map fallback otherwise.
 */

export interface PendingDraft {
  draftId: string;
  conversationId: string;
  userId: string;
  to: string;
  subject: string;
  body: string;
  reason?: string;
  createdAt: number;
}

const TTL_SECONDS = 60 * 60; // 1h
const MAX_SENDS_PER_SESSION = 3;

const memDrafts = new Map<string, { draft: PendingDraft; expiresAt: number }>();
const memSendCounts = new Map<string, number>(); // userId → count

function draftKey(id: string) {
  return `orth:draft:${id}`;
}
function sendCountKey(userId: string) {
  return `orth:sendcount:${userId}`;
}

export async function saveDraft(input: Omit<PendingDraft, "draftId" | "createdAt">): Promise<string> {
  const draftId = `draft_${randomUUID()}`;
  const draft: PendingDraft = { ...input, draftId, createdAt: Date.now() };
  if (hasRedis()) {
    await redis()!.set(draftKey(draftId), draft, { ex: TTL_SECONDS }).catch(() => {});
  } else {
    memDrafts.set(draftId, { draft, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  }
  return draftId;
}

export async function getDraft(draftId: string): Promise<PendingDraft | null> {
  if (hasRedis()) {
    return (await redis()!.get<PendingDraft>(draftKey(draftId)).catch(() => null)) ?? null;
  }
  const e = memDrafts.get(draftId);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    memDrafts.delete(draftId);
    return null;
  }
  return e.draft;
}

export async function consumeDraft(draftId: string): Promise<void> {
  if (hasRedis()) {
    await redis()!.del(draftKey(draftId)).catch(() => {});
  } else {
    memDrafts.delete(draftId);
  }
}

export async function checkAndIncrementSendCount(userId: string): Promise<{
  allowed: boolean;
  used: number;
  cap: number;
}> {
  if (hasRedis()) {
    const used = (await redis()!.incr(sendCountKey(userId))) ?? 1;
    if (used === 1) {
      await redis()!.expire(sendCountKey(userId), 60 * 60 * 24).catch(() => {});
    }
    if (used > MAX_SENDS_PER_SESSION) {
      return { allowed: false, used, cap: MAX_SENDS_PER_SESSION };
    }
    return { allowed: true, used, cap: MAX_SENDS_PER_SESSION };
  }
  const cur = (memSendCounts.get(userId) ?? 0) + 1;
  memSendCounts.set(userId, cur);
  if (cur > MAX_SENDS_PER_SESSION) {
    return { allowed: false, used: cur, cap: MAX_SENDS_PER_SESSION };
  }
  return { allowed: true, used: cur, cap: MAX_SENDS_PER_SESSION };
}

export { MAX_SENDS_PER_SESSION };
