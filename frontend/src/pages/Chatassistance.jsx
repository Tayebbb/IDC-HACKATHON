import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, User, Trash2, Copy, Check, StopCircle, ArrowDown,
  Briefcase, GraduationCap, Target, MessageSquare,
  Plus, Menu, X as XIcon, Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import ReasoningCard from "../components/ReasoningCard";
import { AIMark } from "../components/branding";
import API_URL from "../config";

/* ----------------------------------------------------------------- */
/* Constants                                                          */
/* ----------------------------------------------------------------- */

const GREETING =
  "Hi! I'm your CareerPath assistant. Ask me anything about jobs, skills, interviews, or career growth.";

const SUGGESTED_PROMPTS = [
  { icon: Briefcase, label: "Top jobs for me", prompt: "What jobs match my current skills and what would make me a stronger candidate?" },
  { icon: GraduationCap, label: "Recommend a course", prompt: "Recommend a learning roadmap to upskill toward a frontend developer role." },
  { icon: Target, label: "Skill gap analysis", prompt: "Analyze my skill gaps for a Data Analyst role and tell me what to learn next." },
  { icon: MessageSquare, label: "Interview prep", prompt: "Give me 3 common interview questions for a junior software engineer with sample answers." },
];

const MAX_INPUT_CHARS = 2000;

/* ----------------------------------------------------------------- */
/* Helpers                                                            */
/* ----------------------------------------------------------------- */

function newThreadId() {
  return (
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
}

function deriveTitle(msgs) {
  const firstUser = msgs.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const t = (firstUser.content || "").replace(/\s+/g, " ").trim();
  return t.length > 50 ? t.slice(0, 50) + "…" : t || "New chat";
}

function relativeTime(d) {
  if (!d) return "";
  const date = d.toDate ? d.toDate() : new Date(d);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ----------------------------------------------------------------- */
/* Component                                                          */
/* ----------------------------------------------------------------- */

export default function Chatassistance() {
  const { currentUser } = useAuth();

  // Multi-thread state
  const [threads, setThreads] = useState([]); // [{id, title, lastUpdated}]
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([
    { role: "model", content: GREETING },
  ]);

  // UI state
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer

  const chatBoxRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  /* ----------- Firestore: thread list + active thread ----------- */

  const threadsCol = useCallback(() => {
    if (!currentUser) return null;
    return collection(db, "users", currentUser.uid, "chatThreads");
  }, [currentUser]);

  const threadDoc = useCallback(
    (id) => {
      if (!currentUser || !id) return null;
      return doc(db, "users", currentUser.uid, "chatThreads", id);
    },
    [currentUser]
  );

  // Load all threads on mount / when user changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentUser) {
        // Anonymous: single local thread only
        const localId = "local";
        setThreads([{ id: localId, title: "New chat", lastUpdated: new Date() }]);
        setActiveId(localId);
        return;
      }
      try {
        const col = threadsCol();
        const q = query(col, orderBy("lastUpdated", "desc"));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || "New chat",
            lastUpdated: data.lastUpdated || null,
          };
        });

        // Legacy migration: pull old single-doc conversation if exists
        if (list.length === 0) {
          try {
            const legacy = await getDoc(
              doc(db, "users", currentUser.uid, "chatHistory", "conversations")
            );
            if (legacy.exists()) {
              const data = legacy.data();
              const legacyMsgs = (data.messages || []).filter(
                (m) => m.content !== GREETING
              );
              if (legacyMsgs.length > 0) {
                const id = newThreadId();
                await setDoc(threadDoc(id), {
                  title: deriveTitle(legacyMsgs),
                  messages: legacyMsgs,
                  createdAt: data.createdAt || serverTimestamp(),
                  lastUpdated: data.lastUpdated || serverTimestamp(),
                });
                list.push({
                  id,
                  title: deriveTitle(legacyMsgs),
                  lastUpdated: data.lastUpdated || new Date(),
                });
              }
            }
          } catch {
            /* legacy load is best-effort */
          }
        }

        if (cancelled) return;
        if (list.length === 0) {
          // create empty starter thread
          const id = newThreadId();
          await setDoc(threadDoc(id), {
            title: "New chat",
            messages: [],
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
          list.push({ id, title: "New chat", lastUpdated: new Date() });
        }
        setThreads(list);
        setActiveId(list[0].id);
      } catch (e) {
        console.error("[chat] load threads failed", e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, threadsCol, threadDoc]);

  // Load active thread messages
  useEffect(() => {
    let cancelled = false;
    async function loadActive() {
      if (!activeId) return;
      if (!currentUser) {
        setMessages([{ role: "model", content: GREETING }]);
        return;
      }
      try {
        const snap = await getDoc(threadDoc(activeId));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const msgs = Array.isArray(data.messages) ? data.messages : [];
          // Strip greeting if persisted; we always prepend one client-side
          const cleaned = msgs.filter((m) => m.content !== GREETING);
          setMessages([{ role: "model", content: GREETING }, ...cleaned]);
        } else {
          setMessages([{ role: "model", content: GREETING }]);
        }
      } catch (e) {
        console.error("[chat] load active failed", e);
        setMessages([{ role: "model", content: GREETING }]);
      }
    }
    loadActive();
    return () => {
      cancelled = true;
    };
  }, [activeId, currentUser, threadDoc]);

  // Persist messages to active thread doc
  const saveActiveThread = useCallback(
    async (msgs) => {
      if (!currentUser || !activeId) return;
      try {
        setIsSaving(true);
        const toPersist = msgs.filter((m) => m.content !== GREETING);
        const title = deriveTitle(msgs);
        await updateDoc(threadDoc(activeId), {
          title,
          messages: toPersist,
          lastUpdated: serverTimestamp(),
        });
        setThreads((prev) =>
          prev
            .map((t) =>
              t.id === activeId
                ? { ...t, title, lastUpdated: new Date() }
                : t
            )
            .sort((a, b) => {
              const ad = a.lastUpdated?.toDate
                ? a.lastUpdated.toDate().getTime()
                : new Date(a.lastUpdated || 0).getTime();
              const bd = b.lastUpdated?.toDate
                ? b.lastUpdated.toDate().getTime()
                : new Date(b.lastUpdated || 0).getTime();
              return bd - ad;
            })
        );
      } catch (e) {
        console.error("[chat] save failed", e);
      } finally {
        setIsSaving(false);
      }
    },
    [currentUser, activeId, threadDoc]
  );

  /* ----------- Thread actions ----------- */

  const newThread = async () => {
    if (!currentUser) {
      setMessages([{ role: "model", content: GREETING }]);
      setActiveId("local");
      setSidebarOpen(false);
      return;
    }
    const id = newThreadId();
    try {
      await setDoc(threadDoc(id), {
        title: "New chat",
        messages: [],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });
      setThreads((prev) => [
        { id, title: "New chat", lastUpdated: new Date() },
        ...prev,
      ]);
      setActiveId(id);
      setSidebarOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create new chat");
    }
  };

  const switchThread = (id) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const deleteThread = async (id) => {
    if (!currentUser) return;
    if (!window.confirm("Delete this chat?")) return;
    try {
      await deleteDoc(threadDoc(id));
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        // If deleted active, pick another or create new
        if (id === activeId) {
          if (next.length > 0) setActiveId(next[0].id);
          else {
            // create a fresh one
            setTimeout(newThread, 0);
          }
        }
        return next;
      });
      toast.success("Chat deleted");
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  };

  /* ----------- Chat send / stop ----------- */

  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;

    const userMessage = text;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    let controller = null;
    try {
      const history = messages
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-40);

      if (abortRef.current) abortRef.current.abort();
      controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Chat request failed (${response.status})`);
      }

      const data = await response.json();
      const reply =
        data.response ||
        data.reply ||
        "I'm not sure how to answer that. Could you rephrase?";

      const modelMsg = {
        role: "model",
        content: reply,
        sources: data.sources || [],
        factors: data.factors || [],
        confidence: data.confidence || (data.sources?.length ? "High" : "Medium"),
        basis:
          data.basis ||
          (data.sources?.length
            ? `${data.sources.length} retrieved source(s) via ${data.retrieval_path || "backend RAG"}`
            : "no corpus sources retrieved"),
      };
      const updated = [...newMessages, modelMsg];
      setMessages(updated);
      saveActiveThread(updated);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      const updated = [
        ...newMessages,
        {
          role: "model",
          content:
            "Sorry, something went wrong talking to the server. Please try again.",
        },
      ];
      setMessages(updated);
      saveActiveThread(updated);
    } finally {
      if (!controller || abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    toast("Stopped", { icon: "⏹️" });
  };

  /* ----------- UI side-effects ----------- */

  // Focus
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [input]);

  // Scroll tracking
  const handleScroll = useCallback(() => {
    const el = chatBoxRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distance < 80);
  }, []);

  // Auto-scroll to bottom on new message if anchored
  useEffect(() => {
    if (chatBoxRef.current && isAtBottom) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isAtBottom, loading]);

  const scrollToBottom = () => {
    const el = chatBoxRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setIsAtBottom(true);
  };

  // Inject one-off CSS for scrollbar + dot animation + markdown polish
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes cp-typing-dot {
        0%, 60%, 100% { transform: translateY(0);    opacity: 0.45; }
        30%           { transform: translateY(-6px); opacity: 1;    }
      }
      .cp-scroll::-webkit-scrollbar { width: 10px; }
      .cp-scroll::-webkit-scrollbar-track { background: transparent; }
      .cp-scroll::-webkit-scrollbar-thumb {
        background: rgb(var(--c-on-card) / 0.18);
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      .cp-scroll::-webkit-scrollbar-thumb:hover { background: rgb(var(--c-on-card) / 0.30); background-clip: padding-box; }
      .cp-row:hover .cp-actions { opacity: 1; }
      .cp-actions { opacity: 0; transition: opacity 0.15s ease; }
      .cp-prose p { margin: 0.5em 0; }
      .cp-prose ul, .cp-prose ol { margin: 0.5em 0; padding-left: 1.25em; }
      .cp-prose li { margin: 0.25em 0; }
      .cp-prose code:not(pre code) {
        background: rgb(var(--c-on-card) / 0.10);
        padding: 1px 6px;
        border-radius: 5px;
        font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
        font-size: 0.88em;
      }
      .cp-prose pre {
        background: rgb(var(--c-bg-elevated) / 0.95);
        border: 1px solid rgb(var(--c-on-card) / 0.10);
        padding: 12px 14px;
        border-radius: 10px;
        overflow-x: auto;
        font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
        font-size: 12.5px;
        line-height: 1.55;
        margin: 0.6em 0;
      }
      .cp-prose strong { color: rgb(var(--c-on-card)); font-weight: 600; }
      .cp-prose a { color: rgb(var(--c-primary)); text-decoration: underline; text-underline-offset: 2px; }
      .cp-prose h1, .cp-prose h2, .cp-prose h3 { font-weight: 600; margin: 0.8em 0 0.3em; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  /* ----------- Helpers ----------- */

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(-1), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  const visibleMessages = useMemo(
    () => messages.filter((m, i) => !(i === 0 && m.content === GREETING)),
    [messages]
  );

  const showEmptyState = visibleMessages.length === 0 && !loading;

  /* ----------- Render ----------- */

  return (
    <div className="flex h-screen bg-base text-text-main">
      {/* ───── Sidebar ───── */}
      <Sidebar
        threads={threads}
        activeId={activeId}
        onNew={newThread}
        onSelect={switchThread}
        onDelete={deleteThread}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ───── Main column ───── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Slim top bar */}
        <header className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-text-main/10 bg-bg-base/80 backdrop-blur z-10">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-text-main/5 text-text-main"
            title="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-primary to-accent-pink shadow-sm">
              <Sparkles size={14} className="text-white" />
            </span>
            <h1 className="text-sm font-semibold truncate">
              {threads.find((t) => t.id === activeId)?.title || "New chat"}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isSaving && (
              <span className="text-[11px] text-text-muted hidden sm:inline">
                Saving…
              </span>
            )}
            <button
              type="button"
              onClick={newThread}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-main border border-text-main/10 hover:bg-text-main/5"
              title="New chat"
            >
              <Plus size={14} /> New
            </button>
          </div>
        </header>

        {/* Conversation area */}
        <div
          ref={chatBoxRef}
          onScroll={handleScroll}
          className="cp-scroll flex-1 overflow-y-auto"
        >
          {showEmptyState ? (
            <EmptyState onPick={(p) => sendMessage(p)} />
          ) : (
            <div className="w-full">
              {visibleMessages.map((msg, idx) => (
                <MessageRow
                  key={idx}
                  msg={msg}
                  idx={idx}
                  onCopy={() => copyMessage(msg.content, idx)}
                  copied={copiedIdx === idx}
                />
              ))}
              {loading && <TypingRow />}
              <div className="h-6" />
            </div>
          )}
        </div>

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {!isAtBottom && (
            <motion.button
              key="fab"
              type="button"
              onClick={scrollToBottom}
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="absolute right-6 bottom-32 w-10 h-10 rounded-full bg-primary text-white shadow-glass-glow flex items-center justify-center"
              title="Scroll to latest"
            >
              <ArrowDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Composer */}
        <Composer
          input={input}
          setInput={setInput}
          onSubmit={() => sendMessage()}
          onStop={stopGeneration}
          loading={loading}
          onKeyDown={handleKeyDown}
          textareaRef={textareaRef}
        />
      </main>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/* Sidebar                                                            */
/* ----------------------------------------------------------------- */

function Sidebar({ threads, activeId, onNew, onSelect, onDelete, open, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden fixed inset-0 bg-black/50 z-30"
          />
        )}
      </AnimatePresence>

      <aside
        className={[
          "z-40 md:z-auto bg-bg-section border-r border-text-main/10",
          "flex flex-col w-[280px] h-full",
          "fixed md:static top-0 left-0 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        <div className="h-14 px-3 flex items-center gap-2 border-b border-text-main/10">
          <button
            type="button"
            onClick={onNew}
            className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-gradient-to-r from-primary to-accent-pink text-white text-[13px] font-medium shadow-glass-sm hover:opacity-95"
          >
            <Plus size={15} /> New chat
          </button>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-text-main/5"
            title="Close"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
          Recent chats
        </div>

        <div className="cp-scroll flex-1 overflow-y-auto px-2 pb-3">
          {threads.length === 0 && (
            <p className="px-3 py-4 text-xs text-text-muted">
              No conversations yet. Start one!
            </p>
          )}
          {threads.map((t) => {
            const isActive = t.id === activeId;
            return (
              <div
                key={t.id}
                className={[
                  "group relative my-0.5 rounded-lg cursor-pointer transition-colors",
                  isActive
                    ? "bg-primary/15 border border-primary/30"
                    : "hover:bg-text-main/5 border border-transparent",
                ].join(" ")}
                onClick={() => onSelect(t.id)}
              >
                <div className="flex items-center gap-2 px-3 py-2 pr-9">
                  <MessageSquare
                    size={14}
                    className={isActive ? "text-primary" : "text-text-muted"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate text-text-main">
                      {t.title || "New chat"}
                    </div>
                    <div className="text-[10.5px] text-text-subtle truncate">
                      {relativeTime(t.lastUpdated)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(t.id);
                  }}
                  className="cp-actions absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-error hover:bg-error/10"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-3 py-3 border-t border-text-main/10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent-pink flex items-center justify-center text-white text-xs font-semibold">
            <User size={14} />
          </div>
          <div className="text-[12px] text-text-muted truncate">
            CareerPath AI · v1
          </div>
        </div>
      </aside>
    </>
  );
}

/* ----------------------------------------------------------------- */
/* MessageRow                                                         */
/* ----------------------------------------------------------------- */

function MessageRow({ msg, idx, onCopy, copied }) {
  const isUser = msg.role === "user";
  // Full-width alternating row backgrounds (Claude-style)
  const rowBg = isUser ? "bg-transparent" : "bg-text-main/[0.025]";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`cp-row w-full ${rowBg} border-b border-text-main/[0.04]`}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-accent-pink flex items-center justify-center text-white">
              <User size={14} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-md bg-bg-elevated border border-text-main/10 flex items-center justify-center">
              <AIMark height={16} />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12.5px] font-semibold text-text-main">
              {isUser ? "You" : "CareerPath AI"}
            </span>
            {!isUser && (
              <span className="cp-actions ml-auto inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={onCopy}
                  title={copied ? "Copied" : "Copy"}
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text-main hover:bg-text-main/10"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </span>
            )}
          </div>

          <div className="cp-prose text-[14.5px] leading-relaxed text-text-main/95 break-words">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>

          {/* Sources */}
          {msg.sources && msg.sources.length > 0 && (
            <div className="mt-3 grid gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Sources
              </p>
              {msg.sources.slice(0, 5).map((src, i) => (
                <div
                  key={src.id || i}
                  className="text-[11.5px] text-text-muted bg-text-main/[0.04] border border-text-main/[0.08] rounded-md px-2.5 py-1.5 flex items-center gap-2"
                >
                  <span className="text-primary font-semibold capitalize">
                    {src.type}
                  </span>
                  <span className="opacity-50">·</span>
                  <span className="flex-1 truncate">{src.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* RAG explainability */}
          {!isUser && Array.isArray(msg.factors) && msg.factors.length > 0 && (
            <div className="mt-3">
              <ReasoningCard
                title="Why this answer?"
                factors={msg.factors}
                basis={msg.basis}
                confidence={msg.confidence}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------- */
/* TypingRow                                                          */
/* ----------------------------------------------------------------- */

function TypingRow() {
  return (
    <div className="w-full bg-text-main/[0.025] border-b border-text-main/[0.04]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex gap-3 sm:gap-4">
        <div className="flex-shrink-0 pt-0.5">
          <div className="w-7 h-7 rounded-md bg-bg-elevated border border-text-main/10 flex items-center justify-center">
            <AIMark height={16} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <span className="text-[12.5px] font-semibold text-text-main">CareerPath AI</span>
          <span className="text-[12.5px]">is thinking</span>
          <span className="inline-flex items-center gap-1 ml-1">
            <Dot delay="0s" />
            <Dot delay="0.18s" />
            <Dot delay="0.36s" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-primary"
      style={{ animation: `cp-typing-dot 1.2s ${delay} infinite ease-in-out` }}
    />
  );
}

/* ----------------------------------------------------------------- */
/* EmptyState                                                         */
/* ----------------------------------------------------------------- */

function EmptyState({ onPick }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent-pink shadow-glass-glow mb-5">
          <Sparkles size={26} className="text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-text-main mb-2">
          How can I help with your career today?
        </h2>
        <p className="text-sm text-text-muted mb-8">
          Ask about jobs, skill gaps, learning paths, or interview prep.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
          {SUGGESTED_PROMPTS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPick(prompt)}
              className="group flex items-start gap-3 p-3.5 rounded-xl border border-text-main/10 bg-bg-section/50 hover:bg-bg-section hover:border-primary/40 hover:shadow-glass-sm transition-all text-left"
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/15 text-primary border border-primary/25 inline-flex items-center justify-center">
                <Icon size={14} />
              </span>
              <span className="min-w-0">
                <div className="text-[13px] font-semibold text-text-main">
                  {label}
                </div>
                <div className="text-[11.5px] text-text-muted line-clamp-2 mt-0.5">
                  {prompt}
                </div>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/* Composer                                                           */
/* ----------------------------------------------------------------- */

function Composer({
  input,
  setInput,
  onSubmit,
  onStop,
  loading,
  onKeyDown,
  textareaRef,
}) {
  const overLimit = input.length > MAX_INPUT_CHARS;
  return (
    <div className="border-t border-text-main/10 bg-bg-base/85 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
        <div
          className={[
            "flex items-end gap-2 p-2 rounded-2xl bg-bg-section border transition-colors",
            overLimit
              ? "border-error/60 shadow-[0_0_0_3px_rgb(var(--c-error)/0.20)]"
              : "border-text-main/10 focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.18)]",
          ].join(" ")}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_CHARS + 50))}
            onKeyDown={onKeyDown}
            placeholder="Message CareerPath AI…"
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-text-main placeholder:text-text-subtle text-[14.5px] leading-6 resize-none outline-none px-3 py-2 max-h-[180px] min-h-[40px]"
          />
          {loading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-error text-white inline-flex items-center justify-center hover:opacity-90 shadow-sm"
              title="Stop"
            >
              <StopCircle size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!input.trim() || overLimit}
              className={[
                "flex-shrink-0 w-10 h-10 rounded-xl inline-flex items-center justify-center transition-opacity shadow-sm",
                !input.trim() || overLimit
                  ? "bg-text-main/15 text-text-muted cursor-not-allowed"
                  : "bg-gradient-to-br from-primary to-accent-pink text-white hover:opacity-95",
              ].join(" ")}
              title="Send (Enter)"
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10.5px] text-text-subtle">
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-text-main/15 bg-text-main/5">
              Enter
            </kbd>{" "}
            to send · <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-text-main/15 bg-text-main/5">Shift</kbd>+<kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-text-main/15 bg-text-main/5">Enter</kbd> for new line
          </p>
          <p
            className={`text-[10.5px] tabular-nums ${
              overLimit ? "text-error" : "text-text-subtle"
            }`}
          >
            {input.length} / {MAX_INPUT_CHARS}
          </p>
        </div>
      </div>
    </div>
  );
}
