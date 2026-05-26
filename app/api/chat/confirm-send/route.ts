import { NextRequest } from "next/server";
import { getOrCreateUser } from "@/lib/cookies";
import { getDraft, consumeDraft, checkAndIncrementSendCount } from "@/lib/draft-store";
import { orth } from "@/lib/orthogonal";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEMO_FOOTER = `

---
Sent via Orthogonal Chat — take-home demo. https://github.com/SankrityaT/lumiere-orthogonal`;

interface ConfirmBody {
  draft_id?: string;
  to?: string;
  confirmed?: boolean;
}

/* ------------------------- recipient allowlist ------------------------- */
// Defense-in-depth. The agent can't reach this code path (it has no
// network capability from the tool runtime, only saveDraft). But if the
// UI sends an unexpected recipient anyway, we refuse here.
//
// Allowed:
//   - the AgentMail inbox's own address (sending to yourself for testing)
//   - anything @orthogonal.com or @orthogonal.sh (team)
//   - anything @example.com (RFC test domain)
//   - anything in EMAIL_SEND_ALLOWLIST env (comma-separated full emails or "@domain")

function isRecipientAllowed(addr: string): { ok: true } | { ok: false; reason: string } {
  const lower = addr.trim().toLowerCase();
  if (!lower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) {
    return { ok: false, reason: "Not a valid email address." };
  }

  const inboxEmail = (process.env.AGENTMAIL_INBOX_EMAIL || "").toLowerCase();
  if (inboxEmail && lower === inboxEmail) return { ok: true };

  const DEFAULT_ALLOWED_DOMAINS = ["@orthogonal.com", "@orthogonal.sh", "@example.com"];
  for (const d of DEFAULT_ALLOWED_DOMAINS) {
    if (lower.endsWith(d)) return { ok: true };
  }

  const extra = (process.env.EMAIL_SEND_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const e of extra) {
    if (e.startsWith("@")) {
      if (lower.endsWith(e)) return { ok: true };
    } else if (lower === e) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    reason: `Recipient ${addr} is not on the demo allowlist. Allowed: the inbox itself, @orthogonal.com, @orthogonal.sh, @example.com, or anything in the EMAIL_SEND_ALLOWLIST env var.`,
  };
}

/** POST /api/chat/confirm-send — user-supplied recipient + draft_id only.
 *  Agent has no path to this endpoint. */
export async function POST(req: NextRequest) {
  const user = getOrCreateUser(req);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user.cookieHeader) headers["Set-Cookie"] = user.cookieHeader;

  let body: ConfirmBody;
  try {
    body = (await req.json()) as ConfirmBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), { status: 400, headers });
  }
  if (!body.draft_id || body.confirmed !== true || !body.to) {
    return new Response(
      JSON.stringify({ ok: false, error: "draft_id, to, and confirmed:true are required" }),
      { status: 400, headers },
    );
  }

  // 1. Recipient gate (defense in depth — UI also blocks but we trust nothing)
  const gate = isRecipientAllowed(body.to);
  if (!gate.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: gate.reason, blocked: true }),
      { status: 403, headers },
    );
  }

  // 2. Look up the draft
  const draft = await getDraft(body.draft_id);
  if (!draft) {
    return new Response(
      JSON.stringify({ ok: false, error: "Draft not found or expired (1h TTL)." }),
      { status: 404, headers },
    );
  }
  if (draft.userId !== user.uid) {
    return new Response(JSON.stringify({ ok: false, error: "Draft doesn't belong to this session." }), { status: 403, headers });
  }

  // 3. Check inbox env
  const inboxId = process.env.AGENTMAIL_INBOX_ID;
  if (!inboxId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "AGENTMAIL_INBOX_ID not set. Create an inbox via Orthogonal AgentMail and set the env var.",
      }),
      { status: 500, headers },
    );
  }

  // 4. Per-session cap (3 sends per user)
  const rate = await checkAndIncrementSendCount(user.uid);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Send cap reached (${rate.used}/${rate.cap}). Take-home demo limit — resets after 24h.`,
        used: rate.used,
        cap: rate.cap,
      }),
      { status: 429, headers },
    );
  }

  // 5. Fire AgentMail with the USER-PROVIDED `to` (never the agent's pick)
  const subject = `[DEMO] ${draft.subject}`;
  const text = `${draft.body}${DEMO_FOOTER}`;
  const send = await orth().run<{ message_id?: string; thread_id?: string }>({
    api: "agentmail",
    path: `/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    body: { to: [body.to], subject, text },
    timeoutMs: 20_000,
  });

  if (!send.success) {
    return new Response(
      JSON.stringify({ ok: false, error: send.error, status: send.status }),
      { status: 502, headers },
    );
  }

  // 6. Cleanup
  await consumeDraft(body.draft_id);

  return new Response(
    JSON.stringify({
      ok: true,
      message_id: send.data?.message_id ?? "",
      thread_id: send.data?.thread_id ?? "",
      sent_to: body.to,
      used: rate.used,
      cap: rate.cap,
      price_cents: send.priceCents,
    }),
    { headers },
  );
}
