"use client";

import type { Attachment } from "@/components/ChatInput";

export interface ApiAttachment {
  name: string;
  mimeType: string;
  base64: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: ApiAttachment[];
}

export type CardKind =
  | "apollo-people"
  | "contact-enrich"
  | "company-signals"
  | "web-results"
  | "email-draft"
  | "discover"
  | "generic";

export type ChatEvent =
  // existing
  | {
      type: "state";
      value: "thinking" | "searching" | "reading" | "synthesizing" | "writing" | null;
      query?: string;
      count?: number;
    }
  | { type: "text_delta"; text: string }
  // dual-track context + live cost
  | {
      type: "context_update";
      actual_tokens: number;
      naive_tokens: number;
      model_max: number;
      price_cents: number;
      naive_overflow?: number;
    }
  // inline compaction notice in the chat
  | {
      type: "compaction";
      dropped_count: number;
      summarized_count: number;
      actual_tokens: number;
      naive_tokens: number;
      model_max: number;
      would_have_crashed: boolean;
      naive_overflow_tokens: number;
    }
  // rich per-tool events for UI cards
  | {
      type: "tool_call_start";
      tool_call_id: string;
      tool_name: string;
      card_kind: CardKind;
      provider: string;
      args: unknown;
    }
  | {
      type: "tool_call_result";
      tool_call_id: string;
      tool_name: string;
      card_kind: CardKind;
      provider: string;
      args: unknown;
      payload: unknown;
      price_cents: number;
      cached: boolean;
      error?: string;
    }
  | {
      type: "tool_call_error";
      tool_call_id: string;
      tool_name: string;
      error: string;
    }
  | { type: "done"; price_cents?: number }
  | { type: "error"; message: string };

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function attachmentsToApi(atts: Attachment[]): Promise<ApiAttachment[]> {
  const out: ApiAttachment[] = [];
  for (const a of atts) {
    if (!a.preview) continue;
    try {
      const res = await fetch(a.preview);
      const blob = await res.blob();
      const file = new File([blob], a.name, { type: a.type });
      const base64 = await fileToBase64(file);
      out.push({ name: a.name, mimeType: a.type, base64 });
    } catch {
      // ignore conversion failures
    }
  }
  return out;
}

export async function* streamChat(
  messages: ChatMessage[],
  options: { signal?: AbortSignal; conversationId?: string } = {},
): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      messages,
      conversationId: options.conversationId,
    }),
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    let msg = `Server error ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    yield { type: "error", message: msg };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line) as ChatEvent;
      } catch {
        // ignore malformed lines
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer.trim()) as ChatEvent;
    } catch {}
  }
}
