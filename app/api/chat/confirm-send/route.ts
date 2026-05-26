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
  confirmed?: boolean;
}

/** POST /api/chat/confirm-send — verify a pending draft + per-session cap,
 *  then actually fire AgentMail (with [DEMO] subject + footer). The agent
 *  never reaches this code path; only a user-clicked Send button does. */
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
  if (!body.draft_id || body.confirmed !== true) {
    return new Response(
      JSON.stringify({ ok: false, error: "draft_id and confirmed:true are required" }),
      { status: 400, headers },
    );
  }

  // 1. Look up the draft
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

  // 2. Check inbox env
  const inboxId = process.env.AGENTMAIL_INBOX_ID;
  if (!inboxId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "AGENTMAIL_INBOX_ID not set. Create an inbox via Orthogonal AgentMail and set the env var. ($2/mo per inbox, auto-deleted after 30d inactivity.)",
      }),
      { status: 500, headers },
    );
  }

  // 3. Per-session cap (3 sends per user)
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

  // 4. Actually call AgentMail with the [DEMO] prefix + demo footer
  const subject = `[DEMO] ${draft.subject}`;
  const text = `${draft.body}${DEMO_FOOTER}`;
  const send = await orth().run<{ message_id?: string; thread_id?: string }>({
    api: "agentmail",
    path: `/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    body: { to: [draft.to], subject, text },
    timeoutMs: 20_000,
  });

  if (!send.success) {
    return new Response(
      JSON.stringify({ ok: false, error: send.error, status: send.status }),
      { status: 502, headers },
    );
  }

  // 5. Cleanup
  await consumeDraft(body.draft_id);

  return new Response(
    JSON.stringify({
      ok: true,
      message_id: send.data?.message_id ?? "",
      thread_id: send.data?.thread_id ?? "",
      used: rate.used,
      cap: rate.cap,
      price_cents: send.priceCents,
    }),
    { headers },
  );
}
