// One-off migration runner. Uses @neondatabase/serverless HTTP transport
// (works without websocket). Idempotent — uses IF NOT EXISTS everywhere.
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT 'New conversation',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations (user_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id text PRIMARY KEY,
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role text NOT NULL,
    content text NOT NULL,
    tool_payload jsonb,
    token_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_convo_idx ON messages (conversation_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS tool_calls (
    id text PRIMARY KEY,
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id text REFERENCES messages(id) ON DELETE SET NULL,
    tool_name text NOT NULL,
    provider text NOT NULL,
    path text NOT NULL,
    args jsonb NOT NULL,
    response jsonb,
    error text,
    price_cents integer NOT NULL DEFAULT 0,
    cached_from_id text,
    latency_ms integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS tool_calls_convo_idx ON tool_calls (conversation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS tool_calls_provider_idx ON tool_calls (provider, created_at)`,
];

for (const s of statements) {
  const head = s.split("\n")[0].slice(0, 70);
  process.stdout.write(`→ ${head}... `);
  try {
    await sql.query(s);
    console.log("ok");
  } catch (e) {
    console.log("FAIL");
    console.error(e);
    process.exit(1);
  }
}

console.log("\nmigration complete");
