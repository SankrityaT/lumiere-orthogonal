"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Mark } from "./Mark";

interface ReasoningPanelProps {
  thoughts: string[];
  visibleCount: number;
  durationSec: number | null;
  defaultOpen?: boolean;
}

export function ReasoningPanel({ thoughts, visibleCount, durationSec, defaultOpen = true }: ReasoningPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isStreaming = durationSec === null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="my-3"
    >
      <button
        onClick={() => setOpen(!open)}
        className="group inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[12.5px] text-ink-dim transition-colors hover:text-ink"
      >
        <Mark size={14} className="text-accent/80" dense />
        <span className="serif-italic text-[13px]">
          {isStreaming ? "thinking" : `thought for ${durationSec}s`}
        </span>
        <ChevronDown size={12} strokeWidth={1.8} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="relative ml-2 mt-2 border-l border-border/0 pl-5">
              <div className="absolute left-0 top-1 bottom-1 w-px reasoning-rule" />
              <div className="space-y-2.5">
                {thoughts.slice(0, visibleCount).map((t, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -4, filter: "blur(2px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0)" }}
                    transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className="serif-italic text-[14px] leading-relaxed text-ink-dim"
                  >
                    {t}
                  </motion.p>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
