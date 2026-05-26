"use client";

/**
 * BYOK key storage. Keys are stored ONLY in the user's browser localStorage.
 * They are sent to /api/chat on a per-request basis via request headers, used
 * once to call the upstream provider, and never logged or persisted server-side.
 */

const LLM_KEY = "lumiere.llm_key";
const SEARCH_KEY = "lumiere.search_key";
const ACK_KEY = "lumiere.byok_ack";

export interface Keys {
  llm: string | null;
  search: string | null;
}

export function getKeys(): Keys {
  if (typeof window === "undefined") return { llm: null, search: null };
  return {
    llm: window.localStorage.getItem(LLM_KEY),
    search: window.localStorage.getItem(SEARCH_KEY),
  };
}

export function setKeys(next: Partial<Keys>): void {
  if (typeof window === "undefined") return;
  if (next.llm !== undefined) {
    if (next.llm) window.localStorage.setItem(LLM_KEY, next.llm);
    else window.localStorage.removeItem(LLM_KEY);
  }
  if (next.search !== undefined) {
    if (next.search) window.localStorage.setItem(SEARCH_KEY, next.search);
    else window.localStorage.removeItem(SEARCH_KEY);
  }
  window.dispatchEvent(new Event("lumiere:keys-changed"));
}

export function clearKeys(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LLM_KEY);
  window.localStorage.removeItem(SEARCH_KEY);
  window.dispatchEvent(new Event("lumiere:keys-changed"));
}

export function hasLlmKey(): boolean {
  return !!getKeys().llm;
}

export function maskKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}
