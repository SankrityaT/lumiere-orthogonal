"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, ExternalLink, Trash2, Check, X, Sparkles, Globe, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clearKeys, getKeys, maskKey, setKeys } from "@/lib/keys";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [llmInput, setLlmInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [revealLlm, setRevealLlm] = useState(false);
  const [revealSearch, setRevealSearch] = useState(false);
  const [savedLlm, setSavedLlm] = useState<string | null>(null);
  const [savedSearch, setSavedSearch] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const k = getKeys();
      setSavedLlm(k.llm);
      setSavedSearch(k.search);
      setLlmInput(k.llm ?? "");
      setSearchInput(k.search ?? "");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const save = () => {
    setKeys({
      llm: llmInput.trim() || null,
      search: searchInput.trim() || null,
    });
    const k = getKeys();
    setSavedLlm(k.llm);
    setSavedSearch(k.search);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1400);
  };

  const clear = () => {
    clearKeys();
    setSavedLlm(null);
    setSavedSearch(null);
    setLlmInput("");
    setSearchInput("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[440px] flex-col border-l border-border bg-bg shadow-[0_0_60px_-20px_rgba(0,0,0,0.4)]"
          >
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 px-5">
              <div>
                <div className="text-[14px] font-medium text-ink">Settings</div>
                <div className="text-[11px] text-ink-muted">Bring your own keys</div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
                aria-label="Close settings"
              >
                <X size={15} strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {/* BYOK explainer */}
              <div className="mb-6 rounded-xl border border-border bg-surface/60 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent" />
                  <div className="text-[12.5px] leading-relaxed text-ink-dim">
                    <p className="text-ink font-medium mb-1">Your keys stay yours.</p>
                    <p>
                      Keys live in your browser's localStorage. Each chat request sends them to{" "}
                      <code className="rounded bg-elevated px-1 py-0.5 text-[11px] text-accent-strong">/api/chat</code>{" "}
                      as a one-time header, proxied straight to the provider. We don't log, store, or persist them.
                    </p>
                    <p className="mt-2">Without a key, Lumière runs the scripted demo.</p>
                  </div>
                </div>
              </div>

              {/* LLM key */}
              <section className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={13} strokeWidth={1.8} className="text-accent" />
                  <h3 className="text-[13px] font-medium text-ink">Gemini API key</h3>
                  <span className="text-[11px] text-ink-muted">required</span>
                </div>
                <p className="mb-3 text-[12px] leading-relaxed text-ink-dim">
                  Powers chat, reasoning, vision. Get a free key from{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-accent-strong underline underline-offset-2"
                  >
                    Google AI Studio
                    <ExternalLink size={10} strokeWidth={1.8} />
                  </a>
                  . Free tier covers casual use.
                </p>
                <KeyInput
                  value={llmInput}
                  onChange={setLlmInput}
                  reveal={revealLlm}
                  onToggleReveal={() => setRevealLlm((v) => !v)}
                  placeholder="AIza..."
                  savedMask={savedLlm ? maskKey(savedLlm) : null}
                />
              </section>

              {/* Search key */}
              <section className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <Globe size={13} strokeWidth={1.8} className="text-accent" />
                  <h3 className="text-[13px] font-medium text-ink">Tavily API key</h3>
                  <span className="text-[11px] text-ink-muted">optional, enables web search</span>
                </div>
                <p className="mb-3 text-[12px] leading-relaxed text-ink-dim">
                  Without this, the Web tool is disabled. Free tier is 1,000 searches/month from{" "}
                  <a
                    href="https://app.tavily.com/home"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-accent-strong underline underline-offset-2"
                  >
                    tavily.com
                    <ExternalLink size={10} strokeWidth={1.8} />
                  </a>
                  .
                </p>
                <KeyInput
                  value={searchInput}
                  onChange={setSearchInput}
                  reveal={revealSearch}
                  onToggleReveal={() => setRevealSearch((v) => !v)}
                  placeholder="tvly-..."
                  savedMask={savedSearch ? maskKey(savedSearch) : null}
                />
              </section>

              {/* Status */}
              <div className="rounded-xl border border-border bg-surface/60 p-4">
                <div className="text-[12px] font-medium text-ink mb-2">Current status</div>
                <Row label="Mode" value={savedLlm ? "Live · using your key" : "Demo · scripted responses"} accent={!!savedLlm} />
                <Row label="Chat" value={savedLlm ? "Gemini 2.5 Flash" : "Mocked"} accent={!!savedLlm} />
                <Row label="Web search" value={savedSearch ? "Tavily enabled" : "Disabled"} accent={!!savedSearch} />
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 border-t border-border/70 px-5 py-3">
              <button
                onClick={clear}
                disabled={!savedLlm && !savedSearch}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] text-ink-dim transition-colors hover:bg-elevated hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 size={12} strokeWidth={1.8} />
                Clear
              </button>
              <div className="ml-auto" />
              <button
                onClick={onClose}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-medium text-bg transition-all hover:bg-accent-strong active:scale-95"
              >
                {justSaved ? (
                  <>
                    <Check size={12} strokeWidth={2.4} />
                    Saved
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function KeyInput({
  value,
  onChange,
  reveal,
  onToggleReveal,
  placeholder,
  savedMask,
}: {
  value: string;
  onChange: (v: string) => void;
  reveal: boolean;
  onToggleReveal: () => void;
  placeholder: string;
  savedMask: string | null;
}) {
  return (
    <div className="relative">
      <input
        type={reveal ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="no-default-focus w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 font-mono text-[12.5px] text-ink placeholder:text-ink-muted/70 focus:border-accent/50"
      />
      <button
        type="button"
        onClick={onToggleReveal}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        aria-label={reveal ? "Hide key" : "Reveal key"}
      >
        {reveal ? <EyeOff size={13} strokeWidth={1.8} /> : <Eye size={13} strokeWidth={1.8} />}
      </button>
      {savedMask && (
        <div className="mt-1.5 font-mono text-[10.5px] text-ink-muted">saved: {savedMask}</div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-ink-muted">{label}</span>
      <span className={accent ? "text-accent-strong" : "text-ink-dim"}>{value}</span>
    </div>
  );
}
