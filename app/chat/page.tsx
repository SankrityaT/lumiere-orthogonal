"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
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

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadConversations();
    setConversations(stored);
    const savedActive = loadActiveId();
    const stillExists = savedActive && stored.some((c) => c.id === savedActive);
    setActiveId(stillExists ? savedActive : null);
    setHydrated(true);
  }, []);

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

  const onDeleteConversation = useCallback((id: string) => {
    setConversations((cur) => cur.filter((c) => c.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  // Returns a writable conversation id, creating a new one if there is no active conversation.
  const ensureActiveConversation = useCallback((): string => {
    const current = activeId ? conversations.find((c) => c.id === activeId) : null;
    if (current) return current.id;
    const c = createNew();
    setConversations((cur) => [...cur, c]);
    setActiveId(c.id);
    return c.id;
  }, [activeId, conversations]);

  // Apply messages to a specific conversation id (used when ensureActive returns a new id
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
            />
          </motion.div>
        )}
      </AnimatePresence>
      <ChatArea
        conversation={activeConversation}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        onNewConversation={onNewConversation}
        ensureActive={ensureActiveConversation}
        writeToConversation={writeToConversation}
        updateActiveMessages={updateActiveMessages}
      />
    </div>
  );
}
