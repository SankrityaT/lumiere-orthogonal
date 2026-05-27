"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Globe, Brain, FileSearch, PencilLine, Compass } from "lucide-react";

export type ThinkingState =
  | { kind: "thinking" }
  | { kind: "searching"; query?: string }
  | { kind: "reading"; count: number }
  | { kind: "synthesizing" }
  | { kind: "writing" };

const ICON_MAP: Record<ThinkingState["kind"], React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  thinking: Brain,
  searching: Compass,
  reading: FileSearch,
  synthesizing: Globe,
  writing: PencilLine,
};

function labelFor(state: ThinkingState): string {
  switch (state.kind) {
    case "thinking":
      return "thinking";
    case "searching":
      return "searching the web";
    case "reading":
      return `reading ${state.count} ${state.count === 1 ? "source" : "sources"}`;
    case "synthesizing":
      return "synthesising";
    case "writing":
      return "writing the response";
  }
}

export function ThinkingIndicator({ state }: { state: ThinkingState }) {
  const Icon = ICON_MAP[state.kind];
  const label = labelFor(state);

  return (
    <div className="flex items-center gap-3 py-1">
      {/* Icon */}
      <div className="relative flex h-6 w-6 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-border" />
        <AnimatePresence mode="wait">
          <motion.span
            key={state.kind}
            initial={{ scale: 0.6, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative text-accent"
          >
            <Icon
              size={12}
              strokeWidth={2}
              className={state.kind === "searching" ? "animate-compass" : ""}
            />
          </motion.span>
        </AnimatePresence>
      </div>

      {/* State text — the word itself shimmers */}
      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="flex items-baseline gap-2.5"
        >
          <span className="thinking-word serif-italic text-[15px]">{label}</span>
          {state.kind === "searching" && state.query && (
            <span className="text-[11.5px] text-ink-muted truncate max-w-[260px]">"{state.query}"</span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
