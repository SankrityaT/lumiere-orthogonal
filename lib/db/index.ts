import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;
let _checked = false;

/** Returns a Drizzle handle if DATABASE_URL is configured, else null.
 *  Lazy so module imports don't crash without DB creds — callers must
 *  handle the null path (we fall back to localStorage / in-memory). */
export function db(): NeonHttpDatabase<typeof schema> | null {
  if (_checked) return _db;
  _checked = true;
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[db] DATABASE_URL not set — falling back to localStorage / in-memory.");
    }
    return null;
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export function hasDb(): boolean {
  return db() !== null;
}

export * from "./schema";
