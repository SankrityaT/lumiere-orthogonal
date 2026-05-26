"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mark } from "@/components/Mark";
import { AIMessage } from "@/components/AIMessage";
import { buildDemoConversation } from "@/lib/preloaded-demo";
import { useMemo } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Landing() {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg text-ink overflow-hidden">
      {/* Corner mark */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
        className="absolute left-8 top-8 z-10 flex items-center gap-2 md:left-12 md:top-10"
      >
        <Mark size={14} className="text-accent" />
        <span className="serif-italic text-[15px] leading-none">Lumière</span>
      </motion.div>

      {/* Edition marker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
        className="absolute right-8 top-9 z-10 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted md:right-12 md:top-11"
      >
        Vol. I
      </motion.div>

      {/* Split layout */}
      <main className="flex flex-1 flex-col px-8 pt-32 md:flex-row md:items-center md:px-12 md:pt-0">
        {/* Left: hero text */}
        <div className="flex flex-col items-start md:w-[42%] md:pr-12">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.5, ease: EASE }}
            className="serif-display max-w-[14ch] text-ink"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 4.25rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            An AI with{" "}
            <span className="serif-italic text-accent">trust</span> issues.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 0.9, ease: EASE }}
            className="mt-7 max-w-[44ch] text-[15px] leading-relaxed text-ink-dim"
          >
            Lumière doesn’t trust its own training data, so it{" "}
            <span className="text-ink">reads the web first</span>, streams its reasoning out loud, and cites every claim with a numbered source. The good kind of paranoid.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 1.2, ease: EASE }}
            className="mt-10"
          >
            <Link
              href="/chat"
              className="group inline-flex items-baseline gap-3 text-[16px] text-ink-dim transition-colors hover:text-ink"
            >
              <span
                className="border-b border-transparent transition-colors group-hover:border-current"
                style={{ paddingBottom: "0.15em" }}
              >
                Begin
              </span>
              <span className="text-accent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-2">
                →
              </span>
            </Link>
          </motion.div>
        </div>

        {/* Right: chat preview */}
        <div className="mt-16 md:mt-0 md:flex-1">
          <ChatPreview />
        </div>
      </main>

      {/* Bottom-right whisper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1.4, ease: EASE }}
        className="absolute bottom-8 right-8 z-10 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted md:bottom-10 md:right-12"
      >
        MMXXVI
      </motion.div>
    </div>
  );
}

function ChatPreview() {
  const demo = useMemo(() => buildDemoConversation(), []);
  const aiMessage = demo.messages.find((m) => m.kind === "ai");
  if (!aiMessage || aiMessage.kind !== "ai") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay: 0.7, ease: EASE }}
      className="relative mx-auto w-full max-w-[640px]"
    >
      {/* Window frame */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {/* Mini top bar */}
        <div className="flex h-10 items-center gap-2.5 border-b border-border/60 bg-bg/40 px-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-muted/30" />
            <span className="h-2 w-2 rounded-full bg-ink-muted/30" />
            <span className="h-2 w-2 rounded-full bg-ink-muted/30" />
          </div>
          <div className="ml-2 flex items-center gap-2">
            <Mark size={11} className="text-accent" dense />
            <span className="text-[11.5px] text-ink-dim">Frontier model comparison</span>
          </div>
          <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">
            live · Gemini 2.5
          </span>
        </div>

        {/* Faux user prompt */}
        <div className="flex justify-end border-b border-border/40 px-5 py-3">
          <div className="rounded-2xl rounded-tr-md border border-border bg-elevated/60 px-3.5 py-2 text-[13px] text-ink max-w-[80%]">
            Compare Claude 4.7, GPT-5.5, and Gemini 3.1 Pro.
          </div>
        </div>

        {/* AI message — scaled down */}
        <div
          className="relative max-h-[420px] overflow-hidden px-5 pt-2"
          style={{ maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)" }}
        >
          <div className="lumiere-preview-scale">
            <AIMessage data={aiMessage.data} />
          </div>
        </div>
      </div>

      {/* Subtle glow under the frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-12 -bottom-6 h-24 rounded-full bg-accent/10 blur-2xl"
      />

      <style jsx>{`
        .lumiere-preview-scale {
          font-size: 13.5px;
        }
        .lumiere-preview-scale :global(.prose-editorial) {
          font-size: 13px;
          line-height: 1.55;
        }
        .lumiere-preview-scale :global(.prose-editorial h2) {
          font-size: 1.15rem;
        }
        .lumiere-preview-scale :global(.prose-editorial h3) {
          font-size: 0.95rem;
        }
        .lumiere-preview-scale :global(.prose-editorial pre) {
          font-size: 0.72rem;
        }
      `}</style>
    </motion.div>
  );
}
