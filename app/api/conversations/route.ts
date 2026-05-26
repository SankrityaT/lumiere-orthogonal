import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { hasDb, db, conversations, users } from "@/lib/db";
import { getOrCreateUser } from "@/lib/cookies";

export const runtime = "nodejs";

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** GET /api/conversations — list the cookie-user's conversations.
 *  Returns { ok, conversations, persistence: "db" | "client-only" }.
 *  When DATABASE_URL isn't set, returns persistence:"client-only" so the
 *  client knows to keep using its localStorage cache as the source of truth. */
export async function GET(req: NextRequest) {
  const user = getOrCreateUser(req);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (user.cookieHeader) headers["Set-Cookie"] = user.cookieHeader;

  if (!hasDb()) {
    return new Response(
      JSON.stringify({ ok: true, conversations: [], persistence: "client-only" }),
      { headers },
    );
  }

  const d = db()!;
  await d.insert(users).values({ id: user.uid }).onConflictDoNothing();
  const rows = await d
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, user.uid))
    .orderBy(desc(conversations.updatedAt))
    .limit(200);

  const result: ConversationSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));

  return new Response(JSON.stringify({ ok: true, conversations: result, persistence: "db" }), { headers });
}
