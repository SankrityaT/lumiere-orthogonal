"use client";

import { Plus, Trash2 } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import { groupByRecency, type Conversation } from "@/lib/conversations";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  const groups = groupByRecency(conversations);
  const isEmpty = conversations.length === 0;

  return (
    <aside className="flex h-screen w-[270px] flex-col border-r border-border bg-surface/60 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex h-14 items-center px-5">
        <Logo size="md" />
      </div>

      {/* New chat */}
      <div className="px-3 pb-3">
        <button
          onClick={onNew}
          className="group relative flex w-full items-center gap-2.5 rounded-lg border border-border bg-elevated/40 px-3 py-2 text-[13px] text-ink transition-all hover:border-accent/30 hover:bg-elevated"
        >
          <Plus size={13} strokeWidth={2} className="text-accent transition-transform group-hover:rotate-90 duration-300" />
          <span>New conversation</span>
          <span className="ml-auto rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">⌘K</span>
        </button>
      </div>

      {/* Conversation list */}
      <nav className="flex-1 overflow-y-auto px-1 pb-4">
        {isEmpty ? (
          <div className="mx-3 mt-4 rounded-lg border border-dashed border-border bg-surface/40 p-4 text-[12px] leading-relaxed text-ink-muted">
            No conversations yet. Click <span className="text-ink">New conversation</span> above to start.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {groups.map((group) => (
              <motion.div
                key={group.label}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-3"
              >
                <div className="px-3 py-1.5 text-[11px] text-ink-muted">{group.label}</div>
                <ul className="space-y-0.5">
                  {group.items.map((c) => (
                    <motion.li
                      key={c.id}
                      layout
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="group/item relative"
                    >
                      <button
                        onClick={() => onSelect(c.id)}
                        className={[
                          "group/btn relative flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                          c.id === activeId
                            ? "bg-elevated text-ink"
                            : "text-ink-dim hover:bg-elevated/60 hover:text-ink",
                        ].join(" ")}
                      >
                        {c.id === activeId && (
                          <span className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-accent" />
                        )}
                        <span className="block truncate">{c.title}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted opacity-0 transition-all hover:bg-bg hover:text-ink group-hover/item:opacity-100"
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={11} strokeWidth={1.8} />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/70 p-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="text-[11px] text-ink-muted">
            <span className="font-mono">orth-chat</span> · take-home
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
