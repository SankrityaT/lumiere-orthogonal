"use client";

import { motion } from "framer-motion";
import { Scissors, ZapOff } from "lucide-react";

export interface CompactionEntry {
  droppedCount: number;
  summarizedCount: number;
  actualTokens: number;
  naiveTokens: number;
  modelMax: number;
  wouldHaveCrashed: boolean;
  naiveOverflowTokens: number;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function CompactionNotice({ entry }: { entry: CompactionEntry }) {
  const naivePct = Math.round((entry.naiveTokens / entry.modelMax) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={[
        "my-3 flex items-start gap-2.5 rounded-lg border px-3 py-2 text-[11.5px] italic leading-relaxed",
        entry.wouldHaveCrashed
          ? "border-red-400/30 bg-red-400/5 text-red-400/90"
          : "border-amber-400/25 bg-amber-400/5 text-amber-400/90",
      ].join(" ")}
    >
      {entry.wouldHaveCrashed ? (
        <ZapOff size={12} strokeWidth={1.8} className="mt-0.5 shrink-0" />
      ) : (
        <Scissors size={12} strokeWidth={1.8} className="mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1 text-ink-dim">
        <span className={entry.wouldHaveCrashed ? "text-red-400" : "text-amber-400"}>
          {entry.droppedCount > 0 && `dropped ${entry.droppedCount} older message${entry.droppedCount === 1 ? "" : "s"}`}
          {entry.droppedCount > 0 && entry.summarizedCount > 0 && " + "}
          {entry.summarizedCount > 0 && `summarized ${entry.summarizedCount} tool result${entry.summarizedCount === 1 ? "" : "s"}`}
        </span>
        {" "}— sent <span className="not-italic font-mono">{fmt(entry.actualTokens)}</span> tokens to OpenAI.
        {" "}
        {entry.wouldHaveCrashed ? (
          <>
            Without compaction we would have crashed: naive count was{" "}
            <span className="not-italic font-mono">{fmt(entry.naiveTokens)}</span> ({naivePct}% of {fmt(entry.modelMax)} limit, overshooting by{" "}
            <span className="not-italic font-mono">{fmt(entry.naiveOverflowTokens)}</span>).
          </>
        ) : (
          <>
            Without compaction we&apos;d be at <span className="not-italic font-mono">{fmt(entry.naiveTokens)}</span> ({naivePct}% of limit).
          </>
        )}
      </div>
    </motion.div>
  );
}
