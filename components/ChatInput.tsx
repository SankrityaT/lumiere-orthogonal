"use client";

import { useRef, useState, useEffect, useCallback, type DragEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paperclip,
  Mic,
  ArrowUp,
  X,
  Image as ImageIcon,
  FileText,
  Square,
} from "lucide-react";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

interface ChatInputProps {
  onSubmit: (text: string, attachments: Attachment[]) => void;
  isGenerating?: boolean;
  onStop?: () => void;
  disabled?: boolean;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ChatInput({ onSubmit, isGenerating, onStop, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const modelName = process.env.NEXT_PUBLIC_OPENAI_MODEL ?? "gpt-5-mini";
  const [isDragging, setIsDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const dragCounter = useRef(0);

  // Auto-grow
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [text]);

  // Drag-drop on window
  useEffect(() => {
    const onDragEnter = (e: globalThis.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounter.current++;
        setIsDragging(true);
      }
    };
    const onDragLeave = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };
    const onDragOver = (e: globalThis.DragEvent) => e.preventDefault();
    const onDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files) {
        handleFiles(Array.from(e.dataTransfer.files));
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  // Paste images
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files = Array.from(e.clipboardData.files);
      if (files.length) handleFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // External prefill — DiscoverCard rows dispatch chat:prefill to ask us to
  // seed the input with a templated prompt the user can then edit + send.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== "string") return;
      setText(detail);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(detail.length, detail.length);
      });
    };
    window.addEventListener("chat:prefill", onPrefill);
    return () => window.removeEventListener("chat:prefill", onPrefill);
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const next: Attachment[] = files.slice(0, 6).map((f) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const att: Attachment = { id, name: f.name, size: f.size, type: f.type };
      if (f.type.startsWith("image/")) {
        att.preview = URL.createObjectURL(f);
      }
      return att;
    });
    setAttachments((cur) => [...cur, ...next].slice(0, 6));
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((cur) => {
      const found = cur.find((a) => a.id === id);
      if (found?.preview) URL.revokeObjectURL(found.preview);
      return cur.filter((a) => a.id !== id);
    });
  };

  const submit = () => {
    if (disabled || isGenerating) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSubmit(trimmed, attachments);
    setText("");
    setAttachments([]);
  };

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled;

  return (
    <>
      {/* Drag-drop overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col items-center gap-6 px-12 py-10"
            >
              {/* Dashed border */}
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <rect
                  x="1"
                  y="1"
                  width="calc(100% - 2px)"
                  height="calc(100% - 2px)"
                  fill="none"
                  stroke="rgb(var(--accent))"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                  rx="18"
                  className="animate-pulse-soft"
                />
              </svg>
              <div className="relative">
                <div className="absolute inset-0 animate-pulse-soft rounded-full bg-accent/20 blur-2xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-elevated">
                  <Paperclip className="text-accent" size={26} strokeWidth={1.6} />
                </div>
              </div>
              <div className="text-center">
                <div className="serif-display text-[32px] text-ink">Drop to attach</div>
                <div className="mt-1 serif-italic text-[14px] text-ink-muted">
                  images, PDFs, documents
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container */}
      <div className="px-6 pb-6 pt-2">
        <div className="mx-auto max-w-3xl">
          <motion.div
            ref={containerRef}
            layout
            transition={{ layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
            className={[
              "relative rounded-2xl border bg-surface/80 backdrop-blur-xl transition-all duration-300",
              focused
                ? "border-border-strong shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]"
                : "border-border shadow-[0_4px_18px_-12px_rgba(0,0,0,0.18)]",
            ].join(" ")}
          >
            {/* Attachment row */}
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 border-b border-border/60 p-3">
                    {attachments.map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ scale: 0.9, opacity: 0, y: 6 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-border bg-elevated p-1.5 pr-3"
                      >
                        {a.preview ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-md ring-1 ring-border">
                            <img src={a.preview} alt={a.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg ring-1 ring-border">
                            <FileText size={16} className="text-accent" strokeWidth={1.6} />
                          </div>
                        )}
                        <div className="min-w-0 max-w-[180px]">
                          <div className="truncate text-[12.5px] font-medium text-ink">{a.name}</div>
                          <div className="font-mono text-[10.5px] text-ink-muted">{formatSize(a.size)}</div>
                        </div>
                        <button
                          onClick={() => removeAttachment(a.id)}
                          className="ml-1 rounded-full p-1 text-ink-muted opacity-0 transition-all hover:bg-bg hover:text-ink group-hover:opacity-100"
                          aria-label="Remove"
                        >
                          <X size={12} strokeWidth={2.2} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <div className="px-5 pt-4">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Ask anything, or paste a question, image, or document…"
                rows={1}
                className="no-default-focus auto-grow w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-muted/80 placeholder:font-light"
                style={{ minHeight: 28 }}
              />
            </div>

            {/* Tool row */}
            <div className="flex items-center gap-1.5 px-3 pb-3 pt-2">
              {/* Attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="group flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
                aria-label="Attach files"
              >
                <Paperclip size={15} strokeWidth={1.8} className="transition-transform group-hover:-rotate-12" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv"
                onChange={(e) => {
                  if (e.target.files) handleFiles(Array.from(e.target.files));
                  e.target.value = "";
                }}
                className="hidden"
              />

              {/* Model badge (read-only, env-pinned) */}
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent/80" />
                <span className="font-mono">{modelName}</span>
              </span>

              {/* Right cluster */}
              <div className="ml-auto flex items-center gap-1">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
                  aria-label="Voice input"
                >
                  <Mic size={14} strokeWidth={1.8} />
                </button>

                {/* Send / Stop */}
                <AnimatePresence mode="wait" initial={false}>
                  {isGenerating ? (
                    <motion.button
                      key="stop"
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.85, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={onStop}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-bg transition-transform hover:scale-105 active:scale-95"
                      aria-label="Stop"
                    >
                      <Square size={11} fill="currentColor" />
                    </motion.button>
                  ) : (
                    <motion.button
                      key="send"
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.85, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={submit}
                      disabled={!canSend}
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                        canSend
                          ? "bg-accent text-bg hover:scale-105 hover:bg-accent-strong active:scale-95"
                          : "bg-elevated text-ink-muted",
                      ].join(" ")}
                      aria-label="Send"
                    >
                      <ArrowUp size={14} strokeWidth={2.4} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Footer microcopy */}
          <div className="mt-3 text-center text-[11px] text-ink-muted">
            Orthogonal Chat can make mistakes. Verify important details.
          </div>
        </div>
      </div>
    </>
  );
}

function ToolChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "group flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-all",
        active
          ? "border-accent/40 bg-accent/10 text-accent-strong"
          : "border-border text-ink-dim hover:border-border-strong hover:text-ink",
      ].join(" ")}
    >
      <span className={active ? "text-accent" : ""}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
