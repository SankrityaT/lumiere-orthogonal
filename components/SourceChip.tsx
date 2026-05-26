"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

export interface Source {
  id: number;
  domain: string;
  title: string;
  url: string;
  snippet?: string;
  faviconColor: string;
  faviconLetter: string;
}

export function SourceChip({ source, index }: { source: Source; index: number }) {
  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.45,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -2 }}
      className="group relative flex w-[230px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/40"
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold text-bg"
          style={{ background: source.faviconColor }}
        >
          {source.faviconLetter}
        </div>
        <div className="text-[11px] text-ink-muted truncate">{source.domain}</div>
        <ExternalLink size={10} strokeWidth={1.8} className="ml-auto text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="text-[12.5px] font-medium leading-snug text-ink line-clamp-2">{source.title}</div>
      {source.snippet && (
        <div className="text-[11px] leading-relaxed text-ink-dim line-clamp-2">{source.snippet}</div>
      )}
      <div className="mt-auto flex items-center gap-1.5 pt-1">
        <span className="font-mono text-[9.5px] text-ink-muted">{String(source.id).padStart(2, "0")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </motion.a>
  );
}
