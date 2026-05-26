"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Github, Infinity, Wrench, BarChart3 } from "lucide-react";
import { Mark } from "@/components/Mark";
import { ThemeToggle } from "@/components/ThemeToggle";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Landing() {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg text-ink">
      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="flex items-center justify-between px-6 py-5 md:px-12"
      >
        <div className="flex items-center gap-2.5">
          <Mark size={16} className="text-accent" />
          <span className="serif-italic text-[16px] leading-none">Orthogonal Chat</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/SankrityaT/lumiere-orthogonal"
            target="_blank"
            rel="noreferrer"
            className="hidden h-8 items-center gap-1.5 rounded-full border border-border bg-surface/50 px-3 text-[12px] text-ink-dim transition-colors hover:border-border-strong hover:text-ink md:flex"
          >
            <Github size={11} strokeWidth={1.8} />
            <span>Source</span>
          </a>
          <ThemeToggle />
        </div>
      </motion.header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 text-[11px] text-ink-dim"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          built on
          <a
            href="https://orthogonal.com"
            target="_blank"
            rel="noreferrer"
            className="font-mono uppercase tracking-[0.18em] text-ink hover:text-accent transition-colors"
          >
            Orthogonal
          </a>
        </motion.div>

        <h1
          className="serif-display max-w-[18ch] text-ink"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.75rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
          }}
        >
          <RevealLine delay={0.35}>the AI agent that</RevealLine>
          <br />
          <RevealLine delay={0.5} italic accent>
            never runs out of context.
          </RevealLine>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.95, ease: EASE }}
          className="mx-auto mt-7 max-w-[58ch] text-[15.5px] leading-relaxed text-ink-dim md:text-[17px]"
        >
          A chat agent with the entire Orthogonal catalog at its fingertips. Find people, enrich
          contacts, track funding signals, search the web, send outreach. Powered by 55 verified
          providers behind a single key.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.15, ease: EASE }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/chat"
            className="group flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[13.5px] font-medium text-bg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Try the agent</span>
            <ArrowUpRight
              size={14}
              strokeWidth={2.2}
              className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
          <a
            href="https://orthogonal.com"
            target="_blank"
            rel="noreferrer"
            className="group flex h-11 items-center gap-1.5 rounded-full border border-border bg-surface/50 px-5 text-[13.5px] text-ink transition-all hover:border-border-strong hover:bg-elevated"
          >
            <span>Get an Orthogonal key</span>
            <ArrowUpRight size={13} strokeWidth={1.8} className="text-ink-muted" />
          </a>
        </motion.div>

        {/* Three value props */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.4, ease: EASE }}
          className="mt-20 grid w-full max-w-4xl grid-cols-1 gap-3 text-left md:grid-cols-3"
        >
          <ValueProp
            icon={<Infinity size={14} strokeWidth={1.7} />}
            title="infinite context"
            body="Sliding-window memory and smart summarization. Watch the live context meter while you chat. A naive chatbot would have crashed twelve messages ago."
          />
          <ValueProp
            icon={<Wrench size={14} strokeWidth={1.7} />}
            title="the tools your agent deserves"
            body="Apollo, ContactOut, PredictLeads, AgentMail, plus 51 more providers. One key, one bill, no per-vendor onboarding."
          />
          <ValueProp
            icon={<BarChart3 size={14} strokeWidth={1.7} />}
            title="every cent visible"
            body="Orthogonal returns the price on every call. We sum it live in the header so you see exactly what your agent spent."
          />
        </motion.div>
      </main>

      {/* Glaze section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.6, ease: EASE }}
        className="border-t border-border/60 bg-surface/40 px-6 py-20 md:px-12"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-12 gap-8 md:gap-12">
          <div className="col-span-12 md:col-span-3">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
              powered by
            </div>
            <a
              href="https://orthogonal.com"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 text-ink transition-colors hover:text-accent"
            >
              <OrthogonalWordmark />
            </a>
            <div className="mt-3 text-[12px] text-ink-muted">
              The unified API for AI agents.
            </div>
          </div>

          <div className="col-span-12 md:col-span-9">
            <h2
              className="serif-display max-w-[28ch] text-ink"
              style={{
                fontSize: "clamp(1.5rem, 3.2vw, 2.25rem)",
                lineHeight: 1.15,
                letterSpacing: "-0.015em",
              }}
            >
              Made possible by Orthogonal.
            </h2>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-dim">
              Orthogonal puts 55 verified APIs behind a single key. Apollo for people and
              companies, ContactOut for verified emails, PredictLeads for funding and hiring
              signals, AgentMail for programmatic inboxes, plus Tavily, Exa, Hunter, Tomba,
              PeopleDataLabs, Coresignal, and 45 more. No vendor onboarding. No procurement.
              Structured responses with usage and pricing on every call. Built for agents.
            </p>
            <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-dim">
              This chat would have taken months of integration work without Orthogonal. With it,
              the entire catalog was wired through a single thin wrapper. The architecture treats
              provider plus endpoint as data, so adding the remaining 51 providers is config, not
              code.
            </p>

            <div className="mt-7">
              <a
                href="https://orthogonal.com"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[12.5px] font-medium text-bg transition-transform hover:scale-[1.02]"
              >
                <span>Browse the catalog</span>
                <ArrowUpRight
                  size={12}
                  strokeWidth={2.2}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.9, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-6 py-5 text-[11px] text-ink-muted md:px-12"
      >
        <span>
          Take-home submission. Built on{" "}
          <a
            href="https://orthogonal.com"
            target="_blank"
            rel="noreferrer"
            className="text-ink-dim transition-colors hover:text-accent"
          >
            Orthogonal
          </a>{" "}
          + OpenAI + Neon + Upstash.
        </span>
        <span className="font-mono uppercase tracking-[0.18em]">© 2026</span>
      </motion.footer>
    </div>
  );
}

// ---------- atoms ----------

function RevealLine({
  children,
  delay,
  italic,
  accent,
}: {
  children: React.ReactNode;
  delay: number;
  italic?: boolean;
  accent?: boolean;
}) {
  return (
    <span className="inline-block overflow-hidden align-baseline" style={{ paddingBottom: "0.1em" }}>
      <motion.span
        initial={{ y: "108%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.1, delay, ease: EASE }}
        className={[
          "inline-block",
          italic ? "serif-italic" : "",
          accent ? "text-accent" : "",
        ].join(" ")}
      >
        {children}
      </motion.span>
    </span>
  );
}

function ValueProp({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-5 transition-colors hover:border-accent/30">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-accent">
        {icon}
      </div>
      <div className="serif-display text-[16px] text-ink">{title}</div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{body}</p>
    </div>
  );
}

function OrthogonalWordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <img
        src="/orthogonal-logo.png"
        alt="Orthogonal"
        width={22}
        height={22}
        className="h-[22px] w-[22px] rounded-md ring-1 ring-border"
      />
      <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.18em]">
        Orthogonal
      </span>
    </span>
  );
}
