"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatInput, type Attachment } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { UserMessage } from "./UserMessage";
import { AIMessage, type AIMessageData, type ToolCallEntry } from "./AIMessage";
import { countTokens } from "./StreamingText";
import { PanelLeftClose, PanelLeftOpen, Sparkles, Share2, MoreHorizontal } from "lucide-react";
import { attachmentsToApi, streamChat, type ChatMessage } from "@/lib/chat-client";
import { deriveTitle, type Conversation, type Msg, type UserMsg, type AIMsg } from "@/lib/conversations";
import type { CompactionEntry } from "./CompactionNotice";

interface ChatAreaProps {
  conversation: Conversation | null;
  onToggleSidebar?: () => void;
  sidebarOpen: boolean;
  onNewConversation: () => void;
  ensureActive: () => string;
  writeToConversation: (id: string, updater: (messages: Msg[]) => Msg[], titleHint?: string) => void;
  updateActiveMessages: (updater: (messages: Msg[]) => Msg[]) => void;
}

/* ----------------------------- header meters ----------------------------- */

function toneClass(pct: number, overflow = false): string {
  if (overflow) return "bg-red-400";
  if (pct < 60) return "bg-accent/70";
  if (pct < 85) return "bg-amber-400/80";
  return "bg-red-400/80";
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function DualContextMeter({
  actual,
  naive,
  modelMax,
}: {
  actual: number;
  naive: number;
  modelMax: number;
}) {
  const actualPct = modelMax ? Math.min(100, (actual / modelMax) * 100) : 0;
  const naivePct = modelMax ? Math.min(100, (naive / modelMax) * 100) : 0;
  const naiveOverflow = naive > modelMax;
  const overflowAmount = naive - modelMax;

  return (
    <div className="hidden md:flex flex-col gap-1 text-[10px] text-ink-muted">
      {/* actual bar */}
      <div className="flex items-center gap-2" title={`Tokens we actually send to OpenAI: ${actual.toLocaleString()} / ${modelMax.toLocaleString()}`}>
        <span className="w-12 font-mono uppercase tracking-[0.14em]">ctx</span>
        <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-elevated">
          <div className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${toneClass(actualPct)}`} style={{ width: `${actualPct}%` }} />
        </div>
        <span className="w-16 font-mono tabular-nums text-right">{fmt(actual)}/{fmt(modelMax)}</span>
      </div>

      {/* naive bar */}
      <div className="flex items-center gap-2" title={`Tokens a naive chatbot WOULD have sent (no compaction): ${naive.toLocaleString()}`}>
        <span className="w-12 font-mono uppercase tracking-[0.14em]">naive</span>
        <div className={`relative h-1.5 w-32 overflow-hidden rounded-full ${naiveOverflow ? "ring-1 ring-red-400/50" : "bg-elevated"}`}>
          {!naiveOverflow && (
            <div className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${toneClass(naivePct)}`} style={{ width: `${naivePct}%` }} />
          )}
          {naiveOverflow && (
            <div className="absolute inset-0 bg-red-400/80" />
          )}
        </div>
        <span className={`w-16 font-mono tabular-nums text-right ${naiveOverflow ? "text-red-400" : ""}`}>
          {naiveOverflow ? `+${fmt(overflowAmount)}` : fmt(naive)}
        </span>
      </div>
    </div>
  );
}

function CostMeter({ cents }: { cents: number }) {
  const dollars = (cents / 100).toFixed(4);
  return (
    <div
      className="hidden md:flex flex-col items-end gap-0.5 text-[10px] text-ink-muted"
      title="Sum of Orthogonal API costs this conversation"
    >
      <span className="font-mono uppercase tracking-[0.14em]">cost</span>
      <span className="font-mono tabular-nums text-ink-dim">${dollars}</span>
    </div>
  );
}

/* ----------------------------- derive header stats ----------------------------- */

function deriveStats(conversation: Conversation | null): {
  actualTokens: number;
  naiveTokens: number;
  modelMax: number;
  totalCostCents: number;
} {
  if (!conversation) {
    return { actualTokens: 0, naiveTokens: 0, modelMax: 128_000, totalCostCents: 0 };
  }
  let totalCostCents = 0;
  let latestActual = 0;
  let latestNaive = 0;
  let modelMax = 128_000;
  for (const m of conversation.messages) {
    if (m.kind !== "ai") continue;
    const stats = (m.data as AIMessageData & { contextStats?: { actual: number; naive: number; modelMax: number } }).contextStats;
    if (stats) {
      latestActual = stats.actual;
      latestNaive = stats.naive;
      modelMax = stats.modelMax || modelMax;
    }
    for (const tc of m.data.toolCalls ?? []) {
      totalCostCents += tc.priceCents;
    }
  }
  return { actualTokens: latestActual, naiveTokens: latestNaive, modelMax, totalCostCents };
}

/* ================================ main ================================ */

export function ChatArea({
  conversation,
  onToggleSidebar,
  sidebarOpen,
  onNewConversation,
  ensureActive,
  writeToConversation,
  updateActiveMessages,
}: ChatAreaProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [conversation?.messages.length]);

  const stopAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    if (conversation) {
      updateActiveMessages((msgs) =>
        msgs.map((m) =>
          m.kind === "ai" && !m.data.done ? { ...m, data: { ...m.data, state: null, done: true } } : m,
        ),
      );
    }
  }, [conversation, updateActiveMessages]);

  const writeAI = useCallback(
    (convoId: string, aiId: string, updater: (d: AIMessageData) => AIMessageData) => {
      writeToConversation(convoId, (msgs) =>
        msgs.map((m) => (m.kind === "ai" && m.id === aiId ? { ...m, data: updater(m.data) } : m)),
      );
    },
    [writeToConversation],
  );

  const runLive = async (
    convoId: string,
    aiId: string,
    history: Msg[],
    userText: string,
    userAttachments: Attachment[],
  ) => {
    setIsGenerating(true);

    const apiMessages: ChatMessage[] = [];
    for (const m of history) {
      if (m.kind === "user") {
        const atts = m.attachments ? await attachmentsToApi(m.attachments) : undefined;
        apiMessages.push({ role: "user", content: m.text, attachments: atts });
      } else if (m.kind === "ai" && m.data.done && m.data.response?.text) {
        apiMessages.push({ role: "assistant", content: m.data.response.text });
      }
    }
    const currentAtts = userAttachments.length ? await attachmentsToApi(userAttachments) : undefined;
    apiMessages.push({ role: "user", content: userText, attachments: currentAtts });

    const startedAt = Date.now();
    let textBuffer = "";

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      for await (const ev of streamChat(apiMessages, { signal: ctrl.signal, conversationId: convoId })) {
        if (ev.type === "state") {
          if (ev.value === "thinking") {
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "thinking" } }));
          } else if (ev.value === "searching") {
            const q = ev.query || "";
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "searching", query: q } }));
          } else if (ev.value === "reading") {
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "reading", count: ev.count || 0 } }));
          } else if (ev.value === "synthesizing") {
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "synthesizing" } }));
          } else if (ev.value === "writing") {
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "writing" } }));
          } else if (ev.value === null) {
            const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            writeAI(convoId, aiId, (d) => ({
              ...d,
              state: null,
              reasoning: d.reasoning ? { ...d.reasoning, durationSec: elapsed } : d.reasoning,
            }));
          }
        } else if (ev.type === "text_delta") {
          textBuffer += ev.text;
          writeAI(convoId, aiId, (d) => ({
            ...d,
            response: { text: textBuffer, revealedTokens: countTokens(textBuffer) },
          }));
        } else if (ev.type === "context_update") {
          writeAI(convoId, aiId, (d) => ({
            ...d,
            contextStats: {
              actual: ev.actual_tokens,
              naive: ev.naive_tokens,
              modelMax: ev.model_max,
            },
          }));
        } else if (ev.type === "compaction") {
          const entry: CompactionEntry = {
            droppedCount: ev.dropped_count,
            summarizedCount: ev.summarized_count,
            actualTokens: ev.actual_tokens,
            naiveTokens: ev.naive_tokens,
            modelMax: ev.model_max,
            wouldHaveCrashed: ev.would_have_crashed,
            naiveOverflowTokens: ev.naive_overflow_tokens,
          };
          writeAI(convoId, aiId, (d) => ({
            ...d,
            compactions: [...(d.compactions ?? []), entry],
          }));
        } else if (ev.type === "tool_call_start") {
          const tc: ToolCallEntry = {
            toolCallId: ev.tool_call_id,
            toolName: ev.tool_name,
            cardKind: ev.card_kind,
            provider: ev.provider,
            status: "running",
            args: ev.args,
            priceCents: 0,
            cached: false,
          };
          writeAI(convoId, aiId, (d) => ({
            ...d,
            toolCalls: [...(d.toolCalls ?? []), tc],
          }));
        } else if (ev.type === "tool_call_result") {
          writeAI(convoId, aiId, (d) => ({
            ...d,
            toolCalls: (d.toolCalls ?? []).map((tc) =>
              tc.toolCallId === ev.tool_call_id
                ? {
                    ...tc,
                    status: ev.error ? "error" : "done",
                    payload: ev.payload,
                    priceCents: ev.price_cents,
                    cached: ev.cached,
                    error: ev.error,
                  }
                : tc,
            ),
          }));
        } else if (ev.type === "tool_call_error") {
          writeAI(convoId, aiId, (d) => ({
            ...d,
            toolCalls: (d.toolCalls ?? []).map((tc) =>
              tc.toolCallId === ev.tool_call_id ? { ...tc, status: "error", error: ev.error } : tc,
            ),
          }));
        } else if (ev.type === "error") {
          writeAI(convoId, aiId, (d) => ({
            ...d,
            state: null,
            response: {
              text: `> **Error:** ${ev.message}`,
              revealedTokens: countTokens(`> **Error:** ${ev.message}`),
            },
            done: true,
          }));
        } else if (ev.type === "done") {
          const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
          writeAI(convoId, aiId, (d) => ({
            ...d,
            state: null,
            reasoning: d.reasoning ? { ...d.reasoning, durationSec: elapsed } : d.reasoning,
            done: true,
          }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeAI(convoId, aiId, (d) => ({
        ...d,
        state: null,
        response: { text: `> **Stream error:** ${msg}`, revealedTokens: countTokens(`> **Stream error:** ${msg}`) },
        done: true,
      }));
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const submit = useCallback(
    async (text: string, attachments: Attachment[]) => {
      if (isGenerating) return;
      if (!text.trim() && attachments.length === 0) return;

      const effectiveId = ensureActive();

      const userId = `u-${Date.now()}`;
      const aiId = `a-${Date.now() + 1}`;
      const placeholderAI: AIMessageData = {
        id: aiId,
        state: { kind: "thinking" },
        reasoning: { thoughts: [], visibleCount: 0, durationSec: null },
        toolCalls: [],
        compactions: [],
        response: { text: "", revealedTokens: 0 },
        done: false,
      };

      const userMsg: UserMsg = { kind: "user", id: userId, text, attachments };
      const aiMsg: AIMsg = { kind: "ai", id: aiId, data: placeholderAI };

      const historySnapshot: Msg[] = conversation?.id === effectiveId ? conversation.messages : [];

      writeToConversation(effectiveId, (msgs) => [...msgs, userMsg, aiMsg], deriveTitle(text));

      await runLive(effectiveId, aiId, historySnapshot, text, attachments);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGenerating, conversation, ensureActive, writeToConversation],
  );

  const retryLast = useCallback(() => {
    if (!conversation || isGenerating) return;
    // Find last user message and re-fire submit with it
    const lastUser = [...conversation.messages].reverse().find((m): m is UserMsg => m.kind === "user");
    if (!lastUser) return;
    submit(lastUser.text, lastUser.attachments ?? []);
  }, [conversation, isGenerating, submit]);

  const messages = conversation?.messages ?? [];
  const isEmpty = messages.length === 0;
  const stats = useMemo(() => deriveStats(conversation), [conversation]);

  return (
    <main className="flex h-screen flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-bg/80 px-5 backdrop-blur-xl">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
        >
          {sidebarOpen ? <PanelLeftClose size={15} strokeWidth={1.8} /> : <PanelLeftOpen size={15} strokeWidth={1.8} />}
        </button>
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h2 className="truncate text-[13.5px] font-medium text-ink max-w-[280px]">
            {conversation ? conversation.title : "New conversation"}
          </h2>
        </div>

        <div className="ml-auto flex items-center gap-5">
          <DualContextMeter actual={stats.actualTokens} naive={stats.naiveTokens} modelMax={stats.modelMax} />
          <CostMeter cents={stats.totalCostCents} />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onNewConversation}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
          >
            <Sparkles size={12} strokeWidth={1.8} />
            <span>New</span>
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink">
            <Share2 size={14} strokeWidth={1.8} />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink">
            <MoreHorizontal size={15} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex min-h-full flex-col">
            <EmptyState onSuggest={(p) => submit(p, [])} />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-6">
            {messages.map((m) =>
              m.kind === "user" ? (
                <UserMessage key={m.id} text={m.text} attachments={m.attachments} />
              ) : (
                <AIMessage key={m.id} data={m.data} onRetry={retryLast} />
              ),
            )}
            <div className="h-8" />
          </div>
        )}
      </div>

      <ChatInput onSubmit={(t, a) => submit(t, a)} isGenerating={isGenerating} onStop={stopAll} />
    </main>
  );
}
