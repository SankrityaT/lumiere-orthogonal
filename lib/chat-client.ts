"use client";

import type { Source } from "@/components/SourceChip";
import type { Attachment } from "@/components/ChatInput";
import { getKeys } from "./keys";

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

export type ChatEvent =
  | { type: "state"; value: "thinking" | "searching" | "reading" | "synthesizing" | "writing" | null; query?: string; count?: number }
  | { type: "reasoning_delta"; text: string }
  | { type: "tool_start"; query: string }
  | { type: "sources"; items: Source[] }
  | { type: "text_delta"; text: string }
  | { type: "done"; sources?: Source[]; toolCalls?: number }
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
    if (!a.preview) continue; // skip non-image attachments for now (Gemini handles inline images well)
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
  options: { enableWeb?: boolean; signal?: AbortSignal } = {},
): AsyncGenerator<ChatEvent> {
  const keys = getKeys();
  if (!keys.llm) {
    yield { type: "error", message: "Missing LLM API key. Open Settings to add one." };
    return;
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-llm-key": keys.llm,
      ...(keys.search ? { "x-search-key": keys.search } : {}),
    },
    body: JSON.stringify({
      messages,
      enableWeb: options.enableWeb !== false && !!keys.search,
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
