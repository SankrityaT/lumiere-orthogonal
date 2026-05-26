"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Persistence = "db" | "client-only" | "unknown";

interface ServerConvoSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [persistence, setPersistence] = useState<Persistence>("unknown");
  // Track which conversations we've already lazy-loaded messages for, so we
  // don't refetch every time the user re-selects the same conversation.
  const loadedMessagesFor = useRef<Set<string>>(new Set());

  // ---- mount: try server first, fall back to localStorage ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = loadConversations();
      try {
        const res = await fetch("/api/conversations", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          ok: boolean;
          conversations?: ServerConvoSummary[];
          persistence?: Persistence;
        };
        if (cancelled) return;

        if (data.persistence === "db" && Array.isArray(data.conversations)) {
          // Server is source of truth. Hydrate sidebar with summary rows
          // (messages get lazy-loaded on click). Merge in any local-only
          // conversations whose ids don't appear on the server (offline writes).
          const serverIds = new Set(data.conversations.map((c) => c.id));
          const serverList: Conversation[] = data.conversations.map((c) => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            messages: [],
          }));
          const merged = [...serverList, ...local.filter((l) => !serverIds.has(l.id))];
          setConversations(merged);
          setPersistence("db");
          // Mark local-only conversations as "loaded" since we already have their messages.
          for (const l of local) {
            if (!serverIds.has(l.id)) loadedMessagesFor.current.add(l.id);
          }
        } else {
          setConversations(local);
          setPersistence("client-only");
        }

        const savedActive = loadActiveId();
        const stillExists = savedActive && (data.conversations?.some((c) => c.id === savedActive) || local.some((c) => c.id === savedActive));
        setActiveId(stillExists ? savedActive : null);
      } catch {
        // network or 5xx: client-only mode
        if (cancelled) return;
        setConversations(local);
        setPersistence("client-only");
        const savedActive = loadActiveId();
        const stillExists = savedActive && local.some((c) => c.id === savedActive);
        setActiveId(stillExists ? savedActive : null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- write-through localStorage cache ----
  useEffect(() => {
    if (!hydrated) return;
    saveConversations(conversations);
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveActiveId(activeId);
  }, [activeId, hydrated]);

  // ---- lazy-load messages for a conversation when first viewed ----
  const loadMessagesFor = useCallback(
    async (id: string) => {
      if (persistence !== "db") return;
      if (loadedMessagesFor.current.has(id)) return;
      loadedMessagesFor.current.add(id);
      try {
        const res = await fetch(`/api/conversations/${id}`, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          conversation?: { id: string; title: string; messages: Msg[] };
        };
        if (!data.ok || !data.conversation) return;
        const msgs = data.conversation.messages;
        setConversations((cur) =>
          cur.map((c) => (c.id === id && c.messages.length === 0 ? { ...c, messages: msgs } : c)),
        );
      } catch {
        // ignore — sidebar still shows the conversation, user can retry by clicking again
        loadedMessagesFor.current.delete(id);
      }
    },
    [persistence],
  );

  // When the active conversation changes, ensure its messages are loaded.
  useEffect(() => {
    if (!hydrated || !activeId) return;
    loadMessagesFor(activeId);
  }, [activeId, hydrated, loadMessagesFor]);

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
    const current = activeId ? conversations.find((c) => c.id === activeId) : null;
    if (current && current.messages.length === 0) return;

    const c = createNew();
    loadedMessagesFor.current.add(c.id); // fresh conversation has nothing to load
    setConversations((cur) => {
      const cleaned = cur.filter((conv) => conv.messages.length > 0);
      return [...cleaned, c];
    });
    setActiveId(c.id);
  }, [activeId, conversations]);

  const onSelectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const onDeleteConversation = useCallback(
    async (id: string) => {
      setConversations((cur) => cur.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
      loadedMessagesFor.current.delete(id);
      if (persistence === "db") {
        try {
          await fetch(`/api/conversations/${id}`, { method: "DELETE", credentials: "include" });
        } catch {
          // local delete already happened; server delete will reconcile on next mount
        }
      }
    },
    [persistence],
  );

  const ensureActiveConversation = useCallback((): string => {
    const current = activeId ? conversations.find((c) => c.id === activeId) : null;
    if (current) return current.id;
    const c = createNew();
    loadedMessagesFor.current.add(c.id);
    setConversations((cur) => [...cur, c]);
    setActiveId(c.id);
    return c.id;
  }, [activeId, conversations]);

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
