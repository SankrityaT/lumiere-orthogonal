"use client";

import type { Attachment } from "@/components/ChatInput";
import type { AIMessageData } from "@/components/AIMessage";

export interface UserMsg {
  kind: "user";
  id: string;
  text: string;
  attachments?: Attachment[];
}

export interface AIMsg {
  kind: "ai";
  id: string;
  data: AIMessageData;
}

export type Msg = UserMsg | AIMsg;

export interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  createdAt: number;
  updatedAt: number;
}

const STORE_KEY = "orth.conversations";
const ACTIVE_KEY = "orth.active_id";

// ----------------- store I/O -----------------

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Conversation[];
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    // Strip blob: preview URLs from attachments since they don't survive reload
    const serializable = list.map((c) => ({
      ...c,
      messages: c.messages.map((m) => {
        if (m.kind === "user" && m.attachments) {
          return {
            ...m,
            attachments: m.attachments.map((a) => ({ ...a, preview: undefined })),
          };
        }
        return m;
      }),
    }));
    window.localStorage.setItem(STORE_KEY, JSON.stringify(serializable));
  } catch {}
}

export function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

// ----------------- factories -----------------

export function newConversation(): Conversation {
  const now = Date.now();
  return {
    id: `c-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: "New conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New conversation";
  return trimmed.length > 56 ? `${trimmed.slice(0, 56)}…` : trimmed;
}

// ----------------- grouping helpers -----------------

export interface ConversationGroup {
  label: string;
  items: Conversation[];
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function groupByRecency(list: Conversation[]): ConversationGroup[] {
  if (list.length === 0) return [];
  const now = Date.now();
  const today = startOfDay(now);
  const yesterday = today - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = today - 7 * 24 * 60 * 60 * 1000;

  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };
  for (const c of sorted) {
    const t = c.updatedAt;
    if (t >= today) groups.Today.push(c);
    else if (t >= yesterday) groups.Yesterday.push(c);
    else if (t >= sevenDaysAgo) groups["Previous 7 days"].push(c);
    else groups.Older.push(c);
  }
  return (["Today", "Yesterday", "Previous 7 days", "Older"] as const)
    .map((label) => ({ label, items: groups[label] }))
    .filter((g) => g.items.length > 0);
}
