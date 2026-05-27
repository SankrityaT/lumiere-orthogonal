"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Github, Infinity, Wrench, BarChart3 } from "lucide-react";
import { Mark } from "@/components/Mark";
import { ThemeToggle } from "@/components/ThemeToggle";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-bg text-ink">
      {/* dotted grid backdrop, very subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] dark:opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 0.6px, transparent 0.6px)",
          backgroundSize: "22px 22px",
          color: "var(--ink-muted, #888)",
        }}
      />

      {/* blueprint frame */}
      <div className="relative mx-auto max-w-[1200px] border-x border-dashed border-border/50">
        <PlusCorner pos="tl" />
        <PlusCorner pos="tr" />
        <PlusCorner pos="bl" />
        <PlusCorner pos="br" />

        {/* Top bar */}
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex items-center justify-between border-b border-dashed border-border/50 px-6 py-5 md:px-12"
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

        <SectionLabel num="01" label="Hero" />

        {/* Hero with full-bleed hanami background */}
        <main className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-20 text-center md:px-12 md:py-32">
          {/* Background image */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.42] dark:opacity-30"
            style={{ backgroundImage: "url(/hero.jpg)", filter: "saturate(0.85)" }}
          />
          {/* Flat tint over image: light cream wash in light mode, dark wash in dark mode */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-bg/30 dark:bg-bg/35"
          />
          {/* Center vignette: brightens center in light mode, darkens in dark mode */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 dark:hidden"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)",
            }}
          />
          {/* Subtle scanline / grid overlay to keep the blueprint vibe on top of the painting */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              color: "var(--ink-muted, #aaa)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="relative mb-7 inline-flex items-center gap-2 border border-dashed border-border bg-bg/70 backdrop-blur-sm px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-dim"
          >
            <span className="text-accent">+</span>
            <span>built on</span>
            <a
              href="https://orthogonal.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-ink transition-colors hover:text-accent"
            >
              <img
                src="/orthogonal-logo.png"
                alt=""
                width={14}
                height={14}
                className="h-[14px] w-[14px] rounded-[3px] ring-1 ring-border"
              />
              <span>ORTHOGONAL</span>
            </a>
            <span className="text-accent">+</span>
          </motion.div>

          <h1
            className="hero-headline serif-display relative max-w-[18ch] text-ink"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.75rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
            }}
          >
            <RevealLine delay={0.35}>The GTM AI agent</RevealLine>
            <br />
            <RevealLine delay={0.5} italic accent>
              with infinite context.
            </RevealLine>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.95, ease: EASE }}
            className="relative mx-auto mt-7 max-w-[58ch] text-[15.5px] leading-relaxed text-ink-dim md:text-[17px]"
          >
            One chat that finds people, enriches contacts, tracks funding signals, searches the
            web, and sends outreach. Powered by <span className="text-ink">55 verified providers
            behind a single key</span>, with a sliding-context memory that never crashes.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.15, ease: EASE }}
            className="relative mt-10 flex flex-wrap items-center justify-center gap-3"
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
        </main>

        <SectionLabel num="02" label="Pillars" />

        {/* Three value props — dashed-divided grid, no gap */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.4, ease: EASE }}
          className="grid grid-cols-1 border-b border-dashed border-border/50 md:grid-cols-3"
        >
          <ValueProp
            num="01"
            icon={<Infinity size={14} strokeWidth={1.7} />}
            title="infinite context"
            body="Sliding-window memory and smart summarization. Watch the live context meter while you chat. A naive chatbot would have crashed twelve messages ago."
          />
          <ValueProp
            num="02"
            icon={<Wrench size={14} strokeWidth={1.7} />}
            title="the tools your agent deserves"
            body="Apollo, ContactOut, PredictLeads, AgentMail, plus 51 more providers. One key, one bill, no per-vendor onboarding."
          />
          <ValueProp
            num="03"
            icon={<BarChart3 size={14} strokeWidth={1.7} />}
            title="every cent visible"
            body="Orthogonal returns the price on every call. We sum it live in the header so you see exactly what your agent spent."
          />
        </motion.div>

        <SectionLabel num="03" label="Powered by" />

        {/* Made possible by Orthogonal */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.6, ease: EASE }}
          className="border-b border-dashed border-border/50 bg-surface/40 px-6 py-20 md:px-12"
        >
          <div className="mx-auto grid max-w-5xl grid-cols-12 gap-8 md:gap-12">
            <div className="col-span-12 md:col-span-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
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
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-muted md:px-12"
        >
          <span>
            [ take-home submission · built on{" "}
            <a
              href="https://orthogonal.com"
              target="_blank"
              rel="noreferrer"
              className="text-ink-dim transition-colors hover:text-accent"
            >
              Orthogonal
            </a>{" "}
            + OpenAI + Neon + Upstash ]
          </span>
          <span>© 2026</span>
        </motion.footer>
      </div>
    </div>
  );
}

// ---------- atoms ----------

function PlusCorner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls = {
    tl: "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
    tr: "top-0 right-0 translate-x-1/2 -translate-y-1/2",
    bl: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    br: "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
  }[pos];
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${cls} select-none font-mono text-[16px] leading-none text-ink-muted/70`}
    >
      +
    </span>
  );
}

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/50 bg-bg/40 px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted md:px-12">
      <span className="flex items-center gap-2">
        <span className="text-accent">{num}</span>
        <span className="text-ink-muted">/</span>
        <span>{label}</span>
      </span>
      <span className="hidden md:inline">— — — — —</span>
    </div>
  );
}

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
  num,
  icon,
  title,
  body,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="relative border-t border-dashed border-border/50 bg-surface/30 p-6 transition-colors hover:bg-elevated/40 md:border-t-0 md:border-l md:first:border-l-0">
      <div className="mb-4 flex items-start justify-between">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-accent">
          {icon}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          {num}
        </span>
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
