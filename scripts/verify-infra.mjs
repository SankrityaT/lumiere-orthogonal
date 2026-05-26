// Spot-check that Neon + Upstash are actually being written to.
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

console.log("=== NEON ===");
for (const table of ["users", "conversations", "messages", "tool_calls"]) {
  const rows = await sql.query(`SELECT count(*)::int AS n FROM ${table}`);
  console.log(`  ${table}: ${rows[0].n} rows`);
}

const recent = await sql.query(
  `SELECT id, conversation_id, role, length(content) AS content_len, created_at
   FROM messages ORDER BY created_at DESC LIMIT 5`,
);
console.log(`  last 5 messages:`);
for (const r of recent) {
  console.log(`    ${r.created_at?.toISOString?.() || r.created_at} ${r.role} (${r.content_len} chars)`);
}

const tools = await sql.query(
  `SELECT provider, path, price_cents, latency_ms, cached_from_id, created_at
   FROM tool_calls ORDER BY created_at DESC LIMIT 5`,
);
console.log(`  last 5 tool_calls:`);
for (const r of tools) {
  console.log(`    ${r.created_at?.toISOString?.() || r.created_at} ${r.provider}${r.path} (${r.price_cents}¢, ${r.latency_ms}ms${r.cached_from_id ? `, CACHED from ${r.cached_from_id.slice(0, 8)}` : ""})`);
}

console.log("\n=== UPSTASH ===");
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.log("  missing UPSTASH env, skipping");
  process.exit(0);
}

async function r(cmd) {
  const res = await fetch(`${url}/${cmd.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await res.json();
  return j.result;
}

const dbsize = await r(["dbsize"]);
console.log(`  total keys: ${dbsize}`);

const sample = await r(["scan", "0", "count", "20"]);
const keys = sample[1] || [];
console.log(`  sample (first 20):`);
for (const k of keys.slice(0, 20)) {
  const ttl = await r(["ttl", k]);
  console.log(`    ${k}  ttl=${ttl}s`);
}
