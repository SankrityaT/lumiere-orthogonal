"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { ThinkingIndicator, type ThinkingState } from "./ThinkingIndicator";
import { ReasoningPanel } from "./ReasoningPanel";
import { StreamingText } from "./StreamingText";
import { ToolCardShell, ToolCardBody } from "./tool-cards";
import { CompactionNotice, type CompactionEntry } from "./CompactionNotice";
import type { Source } from "./SourceChip";
import type { CardKind } from "@/lib/chat-client";
import { Mark } from "./Mark";

export interface ToolCallEntry {
  toolCallId: string;
  toolName: string;
  cardKind: CardKind;
  provider: string;
  status: "running" | "done" | "error";
  args: unknown;
  payload?: unknown;
  priceCents: number;
  cached: boolean;
  error?: string;
}

export interface AIMessageData {
  id: string;
  state: ThinkingState | null;
  reasoning?: { thoughts: string[]; visibleCount: number; durationSec: number | null };
  toolCalls?: ToolCallEntry[];
  compactions?: CompactionEntry[];
  response?: { text: string; revealedTokens: number };
  done: boolean;
}

interface AIMessageProps {
  data: AIMessageData;
  onRetry?: () => void;
}

// Collect web-search citation sources across this message's tool calls so the
// streaming text can render [N] chips that point to real URLs.
function collectSources(toolCalls?: ToolCallEntry[]): Source[] {
  if (!toolCalls) return [];
  const out: Source[] = [];
  for (const tc of toolCalls) {
    if (tc.cardKind !== "web-results" || !tc.payload) continue;
    const payload = tc.payload as { results?: Array<{ id: number; title: string; url: string; snippet: string; domain: string }> };
    for (const r of payload.results ?? []) {
      out.push({
        id: r.id,
        domain: r.domain,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        faviconColor: "#c68a74",
        faviconLetter: (r.domain[0] ?? "?").toUpperCase(),
      });
    }
  }
  return out;
}

export function AIMessage({ data, onRetry }: AIMessageProps) {
  const sources = collectSources(data.toolCalls);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex gap-4 py-6"
    >
      <div className="sticky top-6 self-start">
        <Mark size={32} className="text-accent" />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-2 flex items-baseline gap-2 text-[11.5px] text-ink-muted">
          <span className="serif-italic text-[13px] text-ink-dim">Orthogonal</span>
          <span>·</span>
          <span className="font-mono">{process.env.NEXT_PUBLIC_MODEL_LABEL ?? "gpt-5-mini"}</span>
        </div>

        {data.reasoning && data.reasoning.visibleCount > 0 && (
          <ReasoningPanel
            thoughts={data.reasoning.thoughts}
            visibleCount={data.reasoning.visibleCount}
            durationSec={data.reasoning.durationSec}
          />
        )}

        {data.state && (
          <div className="my-2">
            <ThinkingIndicator state={data.state} />
          </div>
        )}

        {/* Tool calls — rich provider-specific cards */}
        {data.toolCalls?.map((tc) => (
          <ToolCardShell
            key={tc.toolCallId}
            provider={tc.provider}
            toolName={tc.toolName}
            status={tc.status}
            cached={tc.cached}
            priceCents={tc.priceCents}
            error={tc.error}
            onRetry={tc.status === "error" ? onRetry : undefined}
          >
            {tc.status === "running" ? (
              <div className="text-[12px] italic text-ink-muted">
                calling {tc.provider}…
              </div>
            ) : (
              <ToolCardBody cardKind={tc.cardKind} payload={tc.payload} />
            )}
          </ToolCardShell>
        ))}

        {/* Inline compaction notices — proof the sliding window fired */}
        {data.compactions?.map((c, i) => (
          <CompactionNotice key={`compact-${i}`} entry={c} />
        ))}

        {data.response && data.response.revealedTokens > 0 && (
          <div className="mt-3">
            <StreamingText
              text={data.response.text}
              revealedTokens={data.response.revealedTokens}
              sources={sources}
            />
          </div>
        )}

        {data.done && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-5 flex items-center gap-1 text-ink-muted"
          >
            <CopyButton text={data.response?.text ?? ""} />
            <div className="mx-1 h-4 w-px bg-border" />
            <FeedbackButton messageId={data.id} kind="good" />
            <FeedbackButton messageId={data.id} kind="bad" />
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard might be blocked; silently fail
    }
  };
  return (
    <button
      onClick={onClick}
      className="group flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors hover:bg-elevated hover:text-ink"
      aria-label="Copy response"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center text-accent"
          >
            <Check size={13} strokeWidth={2.2} />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center"
          >
            <Copy size={13} strokeWidth={1.8} />
          </motion.span>
        )}
      </AnimatePresence>
      <span className="hidden opacity-0 transition-opacity group-hover:opacity-100 md:inline">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function FeedbackButton({ messageId, kind }: { messageId: string; kind: "good" | "bad" }) {
  const [active, setActive] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const storeKey = `orth.feedback.${messageId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActive(window.localStorage.getItem(storeKey) === kind);
  }, [storeKey, kind]);

  const onClick = () => {
    const next = !active;
    setActive(next);
    if (typeof window !== "undefined") {
      if (next) {
        window.localStorage.setItem(storeKey, kind);
      } else if (window.localStorage.getItem(storeKey) === kind) {
        window.localStorage.removeItem(storeKey);
      }
    }
    if (next) {
      setShowThanks(true);
      setTimeout(() => setShowThanks(false), 1800);
    }
  };

  const Icon = kind === "good" ? ThumbsUp : ThumbsDown;
  const label = kind === "good" ? "Good" : "Bad";

  return (
    <button
      onClick={onClick}
      className={[
        "group flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors hover:bg-elevated hover:text-ink",
        active ? "text-accent hover:text-accent" : "",
      ].join(" ")}
      aria-label={`Mark response as ${label}`}
      aria-pressed={active}
    >
      <Icon size={13} strokeWidth={1.8} fill={active ? "currentColor" : "none"} />
      <span className="hidden opacity-0 transition-opacity group-hover:opacity-100 md:inline">
        {showThanks ? "Thanks" : label}
      </span>
    </button>
  );
}
