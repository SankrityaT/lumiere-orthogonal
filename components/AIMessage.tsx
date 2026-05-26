"use client";

import { motion } from "framer-motion";
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Share2 } from "lucide-react";
import { ThinkingIndicator, type ThinkingState } from "./ThinkingIndicator";
import { ReasoningPanel } from "./ReasoningPanel";
import { ToolCall } from "./ToolCall";
import { StreamingText } from "./StreamingText";
import type { Source } from "./SourceChip";
import { Mark } from "./Mark";

export interface AIMessageData {
  id: string;
  state: ThinkingState | null; // null => done
  reasoning?: { thoughts: string[]; visibleCount: number; durationSec: number | null };
  toolCall?: { queries: string[]; sources: Source[]; status: "running" | "done"; visibleCount: number };
  response?: { text: string; revealedTokens: number };
  done: boolean;
}

interface AIMessageProps {
  data: AIMessageData;
}

export function AIMessage({ data }: AIMessageProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex gap-4 py-6"
    >
      {/* Avatar */}
      <div className="sticky top-6 self-start">
        <Mark size={32} className="text-accent" />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        {/* Header */}
        <div className="mb-2 flex items-baseline gap-2 text-[11.5px] text-ink-muted">
          <span className="serif-italic text-[13px] text-ink-dim">Lumière</span>
          <span>·</span>
          <span>Opus</span>
        </div>

        {/* Reasoning panel */}
        {data.reasoning && data.reasoning.visibleCount > 0 && (
          <ReasoningPanel
            thoughts={data.reasoning.thoughts}
            visibleCount={data.reasoning.visibleCount}
            durationSec={data.reasoning.durationSec}
          />
        )}

        {/* Thinking state (while running) */}
        {data.state && (
          <div className="my-2">
            <ThinkingIndicator state={data.state} />
          </div>
        )}

        {/* Tool call */}
        {data.toolCall && (
          <ToolCall
            queries={data.toolCall.queries}
            sources={data.toolCall.sources}
            status={data.toolCall.status}
            visibleCount={data.toolCall.visibleCount}
          />
        )}

        {/* Response */}
        {data.response && data.response.revealedTokens > 0 && (
          <div className="mt-3">
            <StreamingText
              text={data.response.text}
              revealedTokens={data.response.revealedTokens}
              sources={data.toolCall?.sources ?? []}
            />
          </div>
        )}

        {/* Action footer */}
        {data.done && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-5 flex items-center gap-1 text-ink-muted"
          >
            <ActionButton icon={<Copy size={13} strokeWidth={1.8} />} label="Copy" />
            <ActionButton icon={<RefreshCw size={13} strokeWidth={1.8} />} label="Regenerate" />
            <ActionButton icon={<Share2 size={13} strokeWidth={1.8} />} label="Share" />
            <div className="mx-1 h-4 w-px bg-border" />
            <ActionButton icon={<ThumbsUp size={13} strokeWidth={1.8} />} label="Good" />
            <ActionButton icon={<ThumbsDown size={13} strokeWidth={1.8} />} label="Bad" />
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}

function ActionButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="group flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors hover:bg-elevated hover:text-ink">
      {icon}
      <span className="hidden opacity-0 transition-opacity group-hover:opacity-100 md:inline">{label}</span>
    </button>
  );
}
