import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/* ---------- users ---------- */
// Anonymous identity. user_id is the signed cookie value.
export const users = pgTable("users", {
  id: text("id").primaryKey(), // uuid v4
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- conversations ---------- */
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("conversations_user_idx").on(t.userId, t.updatedAt),
  }),
);

/* ---------- messages ---------- */
// One row per chat turn (user message, assistant message, or tool result summary).
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant" | "tool"
    content: text("content").notNull(),
    // For assistant messages with tool calls, we persist the structured tool payload here.
    // Shape: { toolCalls: Array<{ id, name, args, status, result?, error?, priceCents, cached }> }
    toolPayload: jsonb("tool_payload"),
    tokenCount: integer("token_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convoIdx: index("messages_convo_idx").on(t.conversationId, t.createdAt),
  }),
);

/* ---------- tool_calls ---------- */
// One row per Orthogonal call (or cache hit). Separate from messages so we can
// answer "how much did this user cost us?" and "what's our cache hit rate?" with
// a single GROUP BY. Also feeds the per-conversation cost meter.
export const toolCalls = pgTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    toolName: text("tool_name").notNull(), // our public tool name (apollo_search_people, etc.)
    provider: text("provider").notNull(), // orthogonal api slug (apollo, contactout, ...)
    path: text("path").notNull(),
    args: jsonb("args").notNull(),
    response: jsonb("response"),
    error: text("error"),
    priceCents: integer("price_cents").notNull().default(0),
    cachedFromId: text("cached_from_id"), // tool_calls.id of the original call if served from cache
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convoIdx: index("tool_calls_convo_idx").on(t.conversationId, t.createdAt),
    providerIdx: index("tool_calls_provider_idx").on(t.provider, t.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ToolCallRow = typeof toolCalls.$inferSelect;
