"use client";

import { motion } from "framer-motion";
import { Users, TrendingUp, UserSearch, Globe } from "lucide-react";
import { Mark } from "./Mark";

const SUGGESTIONS = [
  {
    icon: Users,
    title: "Find people at Stripe in engineering",
    body: "Search Apollo for roles, seniority, and locations.",
    prompt: "Find people at Stripe in engineering roles, ideally senior+.",
  },
  {
    icon: TrendingUp,
    title: "AI funding rounds this week",
    body: "PredictLeads financing events, recent first.",
    prompt: "What AI startup funding rounds happened in the last 7 days?",
  },
  {
    icon: UserSearch,
    title: "Enrich a contact",
    body: "ContactOut: email, phone, LinkedIn, role.",
    prompt: "Enrich the contact satya@microsoft.com — give me title, LinkedIn, recent role history.",
  },
  {
    icon: Globe,
    title: "Search the web",
    body: "Live web results, cited.",
    prompt: "Search the web for OpenAI's latest model announcement and summarize it.",
  },
];

interface EmptyStateProps {
  onSuggest: (prompt: string) => void;
}

export function EmptyState({ onSuggest }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10"
      >
        <div className="flex items-center gap-4">
          <Mark size={44} className="text-accent shrink-0" />
          <h1
            className="serif-display text-ink"
            style={{
              fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
              lineHeight: 1.05,
            }}
          >
            <span>What can we </span>
            <span className="serif-italic text-accent">find</span>
            <span> today?</span>
          </h1>
        </div>
        <p className="mt-4 max-w-[520px] text-[14px] leading-relaxed text-ink-dim">
          <span className="text-ink">The only GTM tool you need.</span> Prospecting, enrichment, company signals, and outreach across 55+ APIs, all in one chat. Ask in natural language and the agent picks the right tool, then shows real results inline.
        </p>
      </motion.div>

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
