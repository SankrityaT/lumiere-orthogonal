"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useState } from "react";
import { SourceChip, type Source } from "./SourceChip";

interface ToolCallProps {
  queries: string[];
  sources: Source[];
  status: "running" | "done";
  visibleCount: number;
}

export function ToolCall({ queries, sources, status, visibleCount }: ToolCallProps) {
  const [open, setOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="my-4 rounded-2xl border border-border bg-surface/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated/40"
      >
        <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
          {status === "running" ? (
            <span className="absolute inset-0 animate-pulse-soft rounded-lg bg-accent/15" />
          ) : null}
          {status === "done" ? (
            <Check size={13} strokeWidth={2.4} className="relative text-accent" />
          ) : (
            <Globe size={13} strokeWidth={1.8} className="relative text-accent animate-spin-slow" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
            <span>Web search</span>
            <span>·</span>
            <span>
              {queries.length > 1 ? `${queries.length} queries · ` : ""}
              {status === "done" ? `${sources.length} sources` : `${sources.length} sources so far`}
            </span>
          </div>
          <ul className="mt-0.5 space-y-0.5">
            {queries.map((q, i) => (
              <li key={i} className="truncate text-[13.5px] text-ink serif-italic">
                <span className="font-mono text-[10.5px] not-italic text-ink-muted mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                "{q}"
              </li>
            ))}
          </ul>
        </div>
        <ChevronDown
          size={15}
          strokeWidth={1.8}
          className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Sources horizontal scroll */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 px-4 py-3">
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
                {sources.slice(0, visibleCount).map((s, i) => (
                  <SourceChip key={s.id} source={s} index={i} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
