import {
  countAllMessages,
  countMessageTokens,
  countTokens,
  MODEL_MAX_TOKENS,
  type CountableMessage,
} from "./openai";

/**
 * Context-window management with parallel naive-count tracking.
 *
 * The brief asks "how does your app handle the context window filling up?"
 * We don't just claim to compact — we expose it. Per turn we compute:
 *
 *   • actual_tokens — what we send to OpenAI AFTER the sliding window and
 *                     tool-result summarization
 *   • naive_tokens  — what we WOULD have sent if we never compacted
 *                     (full untouched history, every raw tool blob)
 *
 * Both are counted with the same `o200k_base` encoder. The UI renders both
 * as bars in the header; once naive exceeds model_max the naive bar turns
 * red and the compaction notice in the chat says "without compaction we
 * would have crashed at this message."
 */

const SAFETY_HEADROOM_TOKENS = 4_000; // leave room for the assistant's reply

export interface BudgetedMessage extends CountableMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  _tokenCount?: number;
  _summarized?: boolean;
}

export interface CompactionResult {
  /** Messages that should actually be sent to OpenAI this turn. */
  messages: BudgetedMessage[];
  /** Real token count of `messages` (what we're paying for). */
  actualTokens: number;
  /** Real token count of the UNTOUCHED input — what a naive chatbot would have sent. */
  naiveTokens: number;
  /** True if naiveTokens would have busted model_max — proof the compaction was load-bearing. */
  wouldHaveCrashed: boolean;
  /** How far naive overshoots model_max. 0 if not crashed. */
  naiveOverflowTokens: number;
  /** Number of older messages dropped entirely. */
  droppedCount: number;
  /** Number of tool-result messages summarized into one-liners. */
  summarizedCount: number;
  /** Effective ceiling we were budgeting under (model_max minus reply headroom). */
  budgetTokens: number;
}

function summarizeToolResult(msg: BudgetedMessage): BudgetedMessage {
  const name = msg.name || "tool";
  let preview = "";
  try {
    const parsed = JSON.parse(msg.content);
    if (Array.isArray(parsed)) preview = `${parsed.length} items`;
    else if (parsed?.results && Array.isArray(parsed.results)) preview = `${parsed.results.length} results`;
    else if (parsed?.count !== undefined) preview = `count=${parsed.count}`;
    else if (parsed?.error) preview = `error: ${String(parsed.error).slice(0, 80)}`;
    else preview = JSON.stringify(parsed).slice(0, 120);
  } catch {
    preview = msg.content.slice(0, 120);
  }
  const summary = `[${name} prior result, summarized] ${preview}`;
  return {
    ...msg,
    content: summary,
    _tokenCount: countTokens(summary) + 3, // +3 per-message overhead, approximate
    _summarized: true,
  };
}

/** Tokenize all messages (cache result in _tokenCount for reuse). */
function tokenize(msgs: BudgetedMessage[]): BudgetedMessage[] {
  return msgs.map((m) => ({ ...m, _tokenCount: m._tokenCount ?? countMessageTokens(m) }));
}

function sumTokens(msgs: BudgetedMessage[]): number {
  const PRIMING = 3;
  return msgs.reduce((acc, m) => acc + (m._tokenCount ?? countMessageTokens(m)), 0) + PRIMING;
}

/**
 * Budget the input messages to fit under `model_max - headroom` while
 * always returning the parallel naive count.
 *
 * Pipeline:
 *   1. Tokenize the raw input → naiveTokens (this is what a naive chatbot sends)
 *   2. If naive fits, just return it as-is.
 *   3. Otherwise: summarize old tool results, then drop oldest non-system
 *      messages until the actual count fits.
 */
export function budgetMessages(
  input: BudgetedMessage[],
  modelMax: number = MODEL_MAX_TOKENS,
): CompactionResult {
  const headroom = SAFETY_HEADROOM_TOKENS;
  const budgetTokens = Math.max(1024, modelMax - headroom);

  // Naive count: tokenize the input verbatim. This is the "what a chatbot
  // without compaction would have sent" baseline that the UI compares against.
  const naiveTokenized = tokenize(input);
  const naiveTokens = sumTokens(naiveTokenized);
  const wouldHaveCrashed = naiveTokens > budgetTokens;
  const naiveOverflowTokens = wouldHaveCrashed ? naiveTokens - budgetTokens : 0;

  let msgs = naiveTokenized;
  let summarizedCount = 0;
  let droppedCount = 0;

  if (sumTokens(msgs) <= budgetTokens) {
    return {
      messages: msgs,
      actualTokens: sumTokens(msgs),
      naiveTokens,
      wouldHaveCrashed,
      naiveOverflowTokens,
      droppedCount: 0,
      summarizedCount: 0,
      budgetTokens,
    };
  }

  // Find index of last user message — anything from there on is "current turn"
  let lastUserIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  // Step 1: summarize tool messages BEFORE the current turn
  msgs = msgs.map((m, i) => {
    if (i < lastUserIdx && m.role === "tool" && !m._summarized) {
      summarizedCount++;
      return summarizeToolResult(m);
    }
    return m;
  });

  // Step 2: drop oldest non-system messages until under budget
  // Preserve system + current turn (lastUserIdx onwards)
  const head: BudgetedMessage[] = [];
  const tail: BudgetedMessage[] = [];
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role === "system") head.push(msgs[i]);
    else if (i >= lastUserIdx) tail.push(msgs[i]);
    else head.push(msgs[i]);
  }

  while (sumTokens([...head, ...tail]) > budgetTokens && head.length > 1) {
    head.splice(1, 1);
    droppedCount++;
  }

  const out = [...head, ...tail];
  return {
    messages: out,
    actualTokens: sumTokens(out),
    naiveTokens,
    wouldHaveCrashed,
    naiveOverflowTokens,
    droppedCount,
    summarizedCount,
    budgetTokens,
  };
}
