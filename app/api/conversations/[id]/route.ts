import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { hasDb, db, conversations, messages as messagesTable } from "@/lib/db";
import { getOrCreateUser } from "@/lib/cookies";

export const runtime = "nodejs";

/** GET /api/conversations/[id] — return a single conversation with its
 *  full message history reconstructed into the UI Msg[] shape. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = getOrCreateUser(req);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user.cookieHeader) headers["Set-Cookie"] = user.cookieHeader;

  if (!hasDb()) {
    return new Response(JSON.stringify({ ok: false, error: "no-db" }), { status: 503, headers });
  }

  const d = db()!;
  const [convo] = await d
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.uid)))
    .limit(1);
  if (!convo) {
    return new Response(JSON.stringify({ ok: false, error: "not found" }), { status: 404, headers });
  }

  const rows = await d
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  // Map DB rows back into the UI's Msg[] shape. We skip "tool" rows here
  // because tool results live inside the next assistant row's tool_payload.
  const uiMsgs: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (r.role === "user") {
      uiMsgs.push({ kind: "user", id: r.id, text: r.content });
    } else if (r.role === "assistant") {
      const toolCalls = Array.isArray(r.toolPayload)
        ? (r.toolPayload as Array<Record<string, unknown>>).map((t) => ({
            toolCallId: t.id,
            toolName: t.name,
            cardKind: t.cardKind,
            provider: t.provider,
            status: t.error ? "error" : "done",
            args: t.args,
            payload: t.payload,
            priceCents: t.priceCents ?? 0,
            cached: !!t.cached,
            error: t.error,
          }))
        : [];
      uiMsgs.push({
        kind: "ai",
        id: r.id,
        data: {
          id: r.id,
          state: null,
          toolCalls,
          compactions: [],
          response: { text: r.content, revealedTokens: r.content.length },
          done: true,
        },
      });
    }
    // role === "tool" rows are absorbed into the prior assistant message
  }

  return new Response(
    JSON.stringify({
      ok: true,
      conversation: {
        id: convo.id,
        title: convo.title,
        createdAt: convo.createdAt.getTime(),
        updatedAt: convo.updatedAt.getTime(),
        messages: uiMsgs,
      },
    }),
    { headers },
  );
}

/** DELETE /api/conversations/[id] — soft delete (currently hard delete; would
 *  flip to soft delete with a deleted_at column when GDPR / undo matters). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = getOrCreateUser(req);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user.cookieHeader) headers["Set-Cookie"] = user.cookieHeader;

  if (!hasDb()) {
    return new Response(JSON.stringify({ ok: true, deleted: false, persistence: "client-only" }), { headers });
  }

  const d = db()!;
  await d
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.uid)));

  return new Response(JSON.stringify({ ok: true, deleted: true }), { headers });
}
