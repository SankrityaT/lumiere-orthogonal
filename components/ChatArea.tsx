"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput, type Attachment } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { UserMessage } from "./UserMessage";
import { AIMessage, type AIMessageData } from "./AIMessage";
import { countTokens } from "./StreamingText";
import { Share2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Settings, KeyRound, Sparkles } from "lucide-react";
import { useKeys } from "@/lib/use-keys";
import { attachmentsToApi, streamChat, type ChatMessage } from "@/lib/chat-client";
import type { Source } from "./SourceChip";
import { deriveTitle, type Conversation, type Msg, type UserMsg, type AIMsg } from "@/lib/conversations";

interface ChatAreaProps {
  conversation: Conversation | null;
  onToggleSidebar?: () => void;
  sidebarOpen: boolean;
  onOpenSettings: () => void;
  onNewConversation: () => void;
  ensureActive: () => string;
  writeToConversation: (id: string, updater: (messages: Msg[]) => Msg[], titleHint?: string) => void;
  updateActiveMessages: (updater: (messages: Msg[]) => Msg[]) => void;
}

export function ChatArea({
  conversation,
  onToggleSidebar,
  sidebarOpen,
  onOpenSettings,
  onNewConversation,
  ensureActive,
  writeToConversation,
  updateActiveMessages,
}: ChatAreaProps) {
  const keys = useKeys();
  const isLive = !!keys.llm;

  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Abort only on full unmount, NOT on conversation switch. Switching away from
  // a streaming conversation lets the stream finish in the background; its events
  // still write to its original conversation id via writeToConversation().
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new messages
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

  const writeAI = (convoId: string, aiId: string, updater: (d: AIMessageData) => AIMessageData) => {
    writeToConversation(convoId, (msgs) =>
      msgs.map((m) => (m.kind === "ai" && m.id === aiId ? { ...m, data: updater(m.data) } : m)),
    );
  };

  const runLive = async (convoId: string, aiId: string, history: Msg[], userText: string, userAttachments: Attachment[]) => {
    setIsGenerating(true);

    // Build API history from prior completed exchanges (exclude the in-flight AI placeholder)
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
    let reasoningBuffer = "";
    let textBuffer = "";

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      for await (const ev of streamChat(apiMessages, { signal: ctrl.signal })) {
        if (ev.type === "state") {
          if (ev.value === "thinking") {
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "thinking" } }));
          } else if (ev.value === "searching") {
            const q = ev.query || "";
            writeAI(convoId, aiId, (d) => ({
              ...d,
              state: { kind: "searching", query: q },
              toolCall: d.toolCall
                ? { ...d.toolCall, queries: d.toolCall.queries.includes(q) ? d.toolCall.queries : [...d.toolCall.queries, q], status: "running" }
                : { queries: [q], sources: [], status: "running", visibleCount: 0 },
            }));
          } else if (ev.value === "reading") {
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "reading", count: ev.count || 0 } }));
          } else if (ev.value === "synthesizing") {
            writeAI(convoId, aiId, (d) => ({
              ...d,
              state: { kind: "synthesizing" },
              toolCall: d.toolCall ? { ...d.toolCall, status: "done" } : d.toolCall,
            }));
          } else if (ev.value === "writing") {
            writeAI(convoId, aiId, (d) => ({ ...d, state: { kind: "writing" } }));
          } else if (ev.value === null) {
            const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            writeAI(convoId, aiId, (d) => ({
              ...d,
              state: null,
              reasoning: d.reasoning ? { ...d.reasoning, durationSec: elapsed } : d.reasoning,
              toolCall: d.toolCall ? { ...d.toolCall, status: "done" } : d.toolCall,
            }));
          }
        } else if (ev.type === "reasoning_delta") {
          reasoningBuffer += ev.text;
          const thoughts = reasoningBuffer
            .split(/\n\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
          writeAI(convoId, aiId, (d) => ({
            ...d,
            reasoning: { thoughts, visibleCount: thoughts.length, durationSec: d.reasoning?.durationSec ?? null },
          }));
        } else if (ev.type === "tool_start") {
          const q = ev.query;
          writeAI(convoId, aiId, (d) => ({
            ...d,
            toolCall: d.toolCall
              ? { ...d.toolCall, queries: d.toolCall.queries.includes(q) ? d.toolCall.queries : [...d.toolCall.queries, q], status: "running" }
              : { queries: [q], sources: [], status: "running", visibleCount: 0 },
          }));
        } else if (ev.type === "sources") {
          const items: Source[] = ev.items;
          writeAI(convoId, aiId, (d) => ({
            ...d,
            toolCall: d.toolCall
              ? { ...d.toolCall, sources: items, visibleCount: items.length }
              : { queries: [], sources: items, status: "running", visibleCount: items.length },
          }));
        } else if (ev.type === "text_delta") {
          textBuffer += ev.text;
          writeAI(convoId, aiId, (d) => ({
            ...d,
            response: { text: textBuffer, revealedTokens: countTokens(textBuffer) },
          }));
        } else if (ev.type === "error") {
          writeAI(convoId, aiId, (d) => ({
            ...d,
            state: null,
            response: { text: `> **Error:** ${ev.message}`, revealedTokens: countTokens(`> **Error:** ${ev.message}`) },
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

      // Ensure we have a writable conversation to send into. ensureActive
      // handles forking off the read-only demo automatically.
      const effectiveId = ensureActive();

      const userId = `u-${Date.now()}`;
      const aiId = `a-${Date.now() + 1}`;
      const placeholderAI: AIMessageData = {
        id: aiId,
        state: { kind: "thinking" },
        reasoning: { thoughts: [], visibleCount: 0, durationSec: null },
        response: { text: "", revealedTokens: 0 },
        done: false,
      };

      const userMsg: UserMsg = { kind: "user", id: userId, text, attachments };
      const aiMsg: AIMsg = { kind: "ai", id: aiId, data: placeholderAI };

      // Capture history snapshot BEFORE we add the new user/AI pair.
      const historySnapshot: Msg[] = conversation?.id === effectiveId ? conversation.messages : [];

      writeToConversation(
        effectiveId,
        (msgs) => [...msgs, userMsg, aiMsg],
        deriveTitle(text),
      );

      if (!isLive) {
        // Surface the BYOK requirement clearly.
        const msg =
          "Lumière needs a Gemini API key to chat. Open **Settings** and paste a key from [Google AI Studio](https://aistudio.google.com/apikey). Without a key only the pre-loaded *Frontier model comparison* demo is available.";
        writeAI(effectiveId, aiId, (d) => ({
          ...d,
          state: null,
          response: { text: msg, revealedTokens: countTokens(msg) },
          done: true,
        }));
        return;
      }

      await runLive(effectiveId, aiId, historySnapshot, text, attachments);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGenerating, isLive, conversation, ensureActive, writeToConversation],
  );

  // ---------- render ----------

  const messages = conversation?.messages ?? [];
  const isEmpty = messages.length === 0;
  const isDemo = !!conversation?.isDemo;

  return (
    <main className="flex h-screen flex-1 flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-bg/80 px-5 backdrop-blur-xl">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
        >
          {sidebarOpen ? <PanelLeftClose size={15} strokeWidth={1.8} /> : <PanelLeftOpen size={15} strokeWidth={1.8} />}
        </button>
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h2 className="truncate text-[13.5px] font-medium text-ink max-w-[420px]">
            {conversation ? conversation.title : "Lumière"}
          </h2>
          <span className="text-[11.5px] text-ink-muted whitespace-nowrap">
            {isDemo ? "preview · read-only" : isLive ? "live · Gemini 2.5 Flash" : "needs API key"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {!isLive && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[12px] text-accent-strong transition-colors hover:bg-accent/15"
            >
              <KeyRound size={12} strokeWidth={1.8} />
              <span>Add API key</span>
            </button>
          )}
          <button
            onClick={onNewConversation}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
          >
            <Sparkles size={12} strokeWidth={1.8} />
            <span>New</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
            aria-label="Settings"
          >
            <Settings size={15} strokeWidth={1.8} />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink">
            <Share2 size={14} strokeWidth={1.8} />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink">
            <MoreHorizontal size={15} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* Scroll area */}
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
                <AIMessage key={m.id} data={m.data} />
              ),
            )}
            <div className="h-8" />
          </div>
        )}
      </div>

      {/* Input — disabled on demo conversation */}
      {isDemo ? (
        <div className="border-t border-border/60 bg-bg/80 px-6 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 px-4 py-3 text-[13px]">
            <div className="text-ink-dim">
              <span className="text-ink">Preview conversation.</span> Start a new chat to continue from here.
            </div>
            <button
              onClick={onNewConversation}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-bg transition-colors hover:bg-accent-strong"
            >
              New conversation
            </button>
          </div>
        </div>
      ) : (
        <ChatInput onSubmit={(t, a) => submit(t, a)} isGenerating={isGenerating} onStop={stopAll} />
      )}
    </main>
  );
}
