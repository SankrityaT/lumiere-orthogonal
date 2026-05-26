"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { AnimatePresence, motion } from "framer-motion";
import {
  loadConversations,
  saveConversations,
  loadActiveId,
  saveActiveId,
  newConversation as createNew,
  type Conversation,
  type Msg,
} from "@/lib/conversations";
import { buildDemoConversation, isDemoConversation } from "@/lib/preloaded-demo";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on first mount
  useEffect(() => {
    const stored = loadConversations();
    const demo = buildDemoConversation();
    // Always ensure exactly one demo entry exists, and refresh its content so
    // future updates to demo-script propagate automatically.
    const withoutDemo = stored.filter((c) => !c.isDemo);
    const list = [...withoutDemo, demo];
    setConversations(list);

    const savedActive = loadActiveId();
    const activeStillExists = savedActive && list.some((c) => c.id === savedActive);
    setActiveId(activeStillExists ? savedActive : null);
    setHydrated(true);
  }, []);

  // Persist (skip first render before hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveConversations(conversations);
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveActiveId(activeId);
  }, [activeId, hydrated]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((cur) => cur.map((c) => (c.id === id ? updater(c) : c)));
    },
    [],
  );

  const updateActiveMessages = useCallback(
    (updater: (messages: Msg[]) => Msg[]) => {
      if (!activeId) return;
      updateConversation(activeId, (c) => ({
        ...c,
        messages: updater(c.messages),
        updatedAt: Date.now(),
      }));
    },
    [activeId, updateConversation],
  );

  const onNewConversation = useCallback(() => {
    const c = createNew();
    setConversations((cur) => [...cur, c]);
    setActiveId(c.id);
  }, []);

  const onSelectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const onDeleteConversation = useCallback(
    (id: string) => {
      if (isDemoConversation(id)) return; // demo is not deletable
      setConversations((cur) => cur.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  // Returns a writable conversation id, creating a new one if the current
  // active conversation is missing or read-only (the demo).
  const ensureActiveConversation = useCallback((): string => {
    const current = activeId ? conversations.find((c) => c.id === activeId) : null;
    if (current && !current.isDemo) return current.id;
    const c = createNew();
    setConversations((cur) => [...cur, c]);
    setActiveId(c.id);
    return c.id;
  }, [activeId, conversations]);

  // Apply to a specific conversation id (used when ensureActive returns a new id
  // and we need to write into it before React re-renders).
  const writeToConversation = useCallback(
    (id: string, updater: (messages: Msg[]) => Msg[], titleHint?: string) => {
      setConversations((cur) =>
        cur.map((c) => {
          if (c.id !== id) return c;
          const next: Conversation = {
            ...c,
            messages: updater(c.messages),
            updatedAt: Date.now(),
          };
          if (titleHint && (c.title === "New conversation" || !c.title.trim())) {
            next.title = titleHint;
          }
          return next;
        }),
      );
    },
    [],
  );

  return (
    <div className="flex min-h-screen">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 270, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <Sidebar
              conversations={conversations}
              activeId={activeId}
              onSelect={onSelectConversation}
              onNew={onNewConversation}
              onDelete={onDeleteConversation}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <ChatArea
        conversation={activeConversation}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onNewConversation={onNewConversation}
        ensureActive={ensureActiveConversation}
        writeToConversation={writeToConversation}
        updateActiveMessages={updateActiveMessages}
      />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
