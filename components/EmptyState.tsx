"use client";

import { motion } from "framer-motion";
import { Code2, Compass, Feather, FlaskConical } from "lucide-react";
import { Mark } from "./Mark";

const SUGGESTIONS = [
  {
    icon: Compass,
    title: "Compare frontier AI models",
    body: "Claude 4.7 vs GPT-5.5 vs Gemini 3.1 Pro on benchmarks and fit.",
    prompt: "Compare the latest frontier models: Claude 4.7, GPT-5.5, and Gemini 3.1 Pro across benchmarks, capabilities, and best use cases.",
  },
  {
    icon: Code2,
    title: "Review my React component",
    body: "Critique architecture and suggest improvements.",
    prompt: "Review my React component architecture for performance and maintainability.",
  },
  {
    icon: Feather,
    title: "Draft a sharp opener",
    body: "Editorial cold email under sixty words.",
    prompt: "Draft me a sharp editorial-style cold email under 60 words.",
  },
  {
    icon: FlaskConical,
    title: "Explain a paper",
    body: "Break down a recent ML paper for a curious engineer.",
    prompt: "Explain a recent ML paper at a graduate-engineer level. Clear and concise.",
  },
];

interface EmptyStateProps {
  onSuggest: (prompt: string) => void;
}

export function EmptyState({ onSuggest }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-12">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10"
      >
        <div className="flex items-center gap-4">
          <Mark size={48} className="text-accent shrink-0" />
          <h1
            className="serif-display text-ink"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              lineHeight: 1.05,
            }}
          >
            <span>What shall we </span>
            <span className="serif-italic text-accent">illuminate</span>
            <span> today?</span>
          </h1>
        </div>
        <p className="mt-4 max-w-[460px] text-[14px] leading-relaxed text-ink-dim">
          An editorial assistant for thinking out loud, equipped to read the web, hold a thought, and write back with care.
        </p>
      </motion.div>

      {/* Suggestion cards */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.2 + i * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            onClick={() => onSuggest(s.prompt)}
            className="group relative overflow-hidden rounded-xl border border-border bg-surface/40 p-4 text-left transition-all hover:border-accent/30 hover:bg-elevated/70"
          >
            <div className="relative flex items-start gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-elevated transition-all group-hover:border-accent/30 group-hover:text-accent">
                <s.icon size={14} strokeWidth={1.6} className="text-accent/80" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13.5px] font-medium text-ink">{s.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{s.body}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
