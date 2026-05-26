"use client";

import { motion } from "framer-motion";
import { Copy, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
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
            <ActionButton icon={<Copy size={13} strokeWidth={1.8} />} label="Copy" />
            <ActionButton icon={<RefreshCw size={13} strokeWidth={1.8} />} label="Regenerate" onClick={onRetry} />
            <div className="mx-1 h-4 w-px bg-border" />
            <ActionButton icon={<ThumbsUp size={13} strokeWidth={1.8} />} label="Good" />
            <ActionButton icon={<ThumbsDown size={13} strokeWidth={1.8} />} label="Bad" />
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="group flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors hover:bg-elevated hover:text-ink">
      {icon}
      <span className="hidden opacity-0 transition-opacity group-hover:opacity-100 md:inline">{label}</span>
    </button>
  );
}
