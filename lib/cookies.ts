import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Signed httpOnly anonymous user cookie.
 *
 * Format: `<uuid>.<hmac-sha256(uuid, secret)>` — no PII, no auth,
 * just a stable handle for "this browser." Re-signed on each visit
 * to detect tampering.
 *
 * If COOKIE_SECRET isn't set we generate an ephemeral per-process
 * secret. Fine for single-instance demo; in prod this would be a
 * stable env-injected secret so cookies survive deploys.
 */

const COOKIE_NAME = "orth_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

let _secret: string | null = null;
function secret(): string {
  if (_secret) return _secret;
  _secret = process.env.COOKIE_SECRET || `ephemeral-${randomUUID()}`;
  if (!process.env.COOKIE_SECRET && process.env.NODE_ENV !== "production") {
    console.warn("[cookies] COOKIE_SECRET not set — using ephemeral secret (cookies won't survive restarts)");
  }
  return _secret;
}

function sign(uid: string): string {
  return createHmac("sha256", secret()).update(uid).digest("hex").slice(0, 32);
}

function verify(uid: string, sig: string): boolean {
  const expected = sign(uid);
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function encode(uid: string): string {
  return `${uid}.${sign(uid)}`;
}

function decode(raw: string | undefined): string | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx === -1) return null;
  const uid = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (!uid || !sig) return null;
  return verify(uid, sig) ? uid : null;
}

export interface ResolvedUser {
  uid: string;
  isNew: boolean;
  cookieHeader?: string; // include in Set-Cookie if isNew
}

export function getOrCreateUser(req: NextRequest): ResolvedUser {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  const existing = decode(raw);
  if (existing) return { uid: existing, isNew: false };
  const uid = randomUUID();
  const cookieHeader = buildCookieHeader(encode(uid));
  return { uid, isNew: true, cookieHeader };
}

function buildCookieHeader(value: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${value}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
