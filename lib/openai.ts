import OpenAI from "openai";
import { getEncoding, type Tiktoken } from "js-tiktoken";

let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY missing. Set it in .env.local.");
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

/**
 * Context window for the gpt-5-mini family. 128k is the conservative number;
 * tweak via env if running a different model.
 *
 * This is the number both the actual and naive token bars in the UI compare
 * against. The "would have crashed" marker fires when the naive count would
 * have pushed us past this on the API call.
 */
export const MODEL_MAX_TOKENS = parseInt(process.env.MODEL_MAX_TOKENS || "128000", 10);

/* ----------------------------- tokenization ----------------------------- */
// Real tokenization with js-tiktoken's o200k_base (GPT-5 / GPT-4o / o-series).
// We use this same encoder for BOTH the budgeted count and the naive count so
// the comparison in the UI is apples-to-apples.

let _enc: Tiktoken | null = null;
function enc(): Tiktoken {
  if (!_enc) _enc = getEncoding("o200k_base");
  return _enc;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return enc().encode(text).length;
}

/* ---------------------- chat-message-shaped counting --------------------- */
// OpenAI's chat format adds a small per-message overhead beyond the raw
// content tokens. The numbers below match the public reference for o200k_base
// (3 tokens per message wrap, +3 for assistant priming at end).

export interface CountableMessage {
  role: string;
  content?: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown;
}

export function countMessageTokens(msg: CountableMessage): number {
  const PER_MSG = 3;
  const role = countTokens(msg.role);
  const content = msg.content ? countTokens(msg.content) : 0;
  const name = msg.name ? countTokens(msg.name) + 1 : 0;
  const toolCalls = msg.tool_calls ? countTokens(JSON.stringify(msg.tool_calls)) : 0;
  const toolCallId = msg.tool_call_id ? countTokens(msg.tool_call_id) : 0;
  return PER_MSG + role + content + name + toolCalls + toolCallId;
}

export function countAllMessages(msgs: CountableMessage[]): number {
  const PRIMING = 3;
  return msgs.reduce((acc, m) => acc + countMessageTokens(m), 0) + PRIMING;
}
