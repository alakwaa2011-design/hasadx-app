import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Bot,
  ChevronDown,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";
const STORAGE_MINIMIZED = "hasad-guide-launcher-minimized";

/** Assistant chrome: quiet green + white accents (no gold). */
const GUIDE_GREEN =
  "linear-gradient(160deg, #1a3d2e 0%, #152a22 45%, #101c17 100%)";
const GUIDE_GREEN_SOFT =
  "linear-gradient(180deg, #1f4536 0%, #163028 100%)";

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  cached?: number;
}

interface ConversationListItem {
  id: number;
  title: string;
  updatedAt: string;
}

interface UsageInfo {
  used: number;
  limit: number | null;
  remaining: number | null;
}

/** True only when the server reports a finite, positive daily cap. */
function hasDailyCap(u: UsageInfo | null): u is UsageInfo & { limit: number; remaining: number } {
  return !!u && typeof u.limit === "number" && u.limit > 0 && typeof u.remaining === "number";
}

function copy(lang: string) {
  const isAr = lang === "ar";
  return {
    brand: isAr ? "مرشد حصاد" : "Hasaad Guide",
    tagline: isAr ? "مساعد العمل الذكي" : "Your workspace AI companion",
    openLauncher: isAr ? "فتح مرشد حصاد" : "Open Hasaad Guide",
    hideLauncher: isAr ? "إخفاء شريط المساعد" : "Hide assistant bar",
    restore: isAr ? "إظهار المرشد" : "Show Hasaad Guide",
    history: isAr ? "السجل" : "History",
    newChat: isAr ? "محادثة جديدة" : "New chat",
    close: isAr ? "إغلاق" : "Close",
    send: isAr ? "إرسال" : "Send",
    usageLine: (rem: number, lim: number) =>
      isAr ? `${rem} / ${lim} متبقية اليوم` : `${rem} / ${lim} left today`,
    welcomeTitle: isAr ? "كيف أقدر أساعدك؟" : "How can I help?",
    welcomeBody: isAr
      ? "اسأل عن ميزات المنصة، أو اطلب صياغة أسئلة لموضوع درسك."
      : "Ask about platform features, or request quiz questions for your topic.",
    suggestions: isAr
      ? [
          "كيف أبدأ أول مسابقة؟",
          "ما الفرق بين الألعاب الجماعية والفردية؟",
          "كيف تعمل النقاط؟",
          "كيف أشارك المسابقة؟",
          "اشرح لي تحدّي حصاد",
          "كيف أستخدم بنك الأسئلة؟",
        ]
      : [
          "How do I start my first contest?",
          "Live vs solo games — what's the difference?",
          "How do points work?",
          "How do I share a contest?",
          "Explain Hasaad Arena",
          "How do I use the question bank?",
        ],
    noHistory: isAr ? "لا توجد محادثات سابقة" : "No past conversations",
    placeholder: isAr ? "اكتب سؤالك…" : "Type your question…",
    cached: isAr ? "⚡ من الذاكرة" : "⚡ From cache",
    dailyLimit: isAr ? "وصلت إلى الحد اليومي. يتجدد غداً." : "Daily limit reached. Resets tomorrow.",
    deleteConfirm: isAr ? "هل تريد حذف هذه المحادثة؟" : "Delete this conversation?",
    errorGeneric: isAr ? "حدث خطأ" : "Something went wrong",
    errorNet: isAr ? "تعذّر الاتصال. حاول مرة أخرى." : "Could not connect. Try again.",
  };
}

export function AiAssistant({ enabled, lang }: { enabled: boolean; lang: string }) {
  const isAr = lang === "ar";
  const t = copy(lang);

  const [open, setOpen] = useState(false);
  const [launcherMinimized, setLauncherMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_MINIMIZED) === "1";
    } catch {
      return false;
    }
  });
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const minimizeLauncher = () => {
    try {
      localStorage.setItem(STORAGE_MINIMIZED, "1");
    } catch {
      /* ignore */
    }
    setLauncherMinimized(true);
    setOpen(false);
  };

  const restoreLauncher = () => {
    try {
      localStorage.removeItem(STORAGE_MINIMIZED);
    } catch {
      /* ignore */
    }
    setLauncherMinimized(false);
  };

  useEffect(() => {
    if (!open || !enabled) return;
    fetchUsage();
    fetchConversations();
  }, [open, enabled]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function fetchUsage() {
    try {
      const r = await fetch(`${API_BASE}/api/ai-chat/usage`, { credentials: "include" });
      if (r.ok) setUsage(await r.json());
    } catch {
      /* ignore */
    }
  }

  async function fetchConversations() {
    try {
      const r = await fetch(`${API_BASE}/api/ai-chat/conversations`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setConversations(data.conversations || []);
      }
    } catch {
      /* ignore */
    }
  }

  async function loadConversation(id: number) {
    try {
      const r = await fetch(`${API_BASE}/api/ai-chat/conversations/${id}`, {
        credentials: "include",
      });
      if (!r.ok) return;
      const data = await r.json();
      setConversationId(id);
      setMessages(data.messages || []);
      setShowHistory(false);
      setError(null);
    } catch {
      /* ignore */
    }
  }

  async function deleteConversation(id: number) {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await fetch(`${API_BASE}/api/ai-chat/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
      fetchConversations();
    } catch {
      /* ignore */
    }
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
    setError(null);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    try {
      const r = await fetch(`${API_BASE}/api/ai-chat/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.message || data.error || t.errorGeneric);
        setMessages((m) => m.slice(0, -1));
        if (data.usage) setUsage(data.usage);
        return;
      }
      setConversationId(data.conversationId);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply, cached: data.cached ? 1 : 0 },
      ]);
      if (data.usage) setUsage(data.usage);
      fetchConversations();
    } catch {
      setError(t.errorNet);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      {/* NOTE: rendered globally by <GlobalAiAssistant /> in App.tsx so it
          appears on every authenticated teacher/organizer page (mobile +
          desktop), regardless of whether the page wraps itself in
          `<Layout>`. Do not also mount inside layouts. */}
      {/* Compact pill launcher — green / white only, low visual weight */}
      {!launcherMinimized && (
        <div className="fixed bottom-4 end-3 z-40 pointer-events-none [&>*]:pointer-events-auto">
          {/* على الهاتف: دائرة صغيرة فقط — على الشاشة الكبيرة: الزر الكامل */}

          {/* دائرة الهاتف */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="sm:hidden flex items-center justify-center w-11 h-11 rounded-full shadow-lg border border-white/10"
            style={{ background: GUIDE_GREEN }}
            aria-label={t.openLauncher}
            title={t.brand}
          >
            <Sparkles className="w-4 h-4 text-white" aria-hidden />
          </button>

          {/* الزر الكامل للشاشة الكبيرة */}
          <div
            className="hidden sm:inline-flex max-w-[220px] items-stretch overflow-hidden rounded-full border border-white/10 shadow-md shadow-black/20"
            style={{ background: GUIDE_GREEN }}
          >
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 ps-2.5 pe-1.5 py-1.5 text-start text-white/95 transition-colors hover:bg-white/[0.06]"
              aria-label={t.openLauncher}
              title={`${t.brand} — ${t.tagline}`}
            >
              <span className="shrink-0 rounded-full bg-white/12 p-1.5 ring-1 ring-white/10">
                <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 py-0.5">
                <span className="block text-xs font-semibold leading-tight truncate">
                  {t.brand}
                </span>
                <span className="mt-0.5 block text-[9px] leading-tight text-white/55 truncate">
                  {t.tagline}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                minimizeLauncher();
              }}
              className="shrink-0 border-s border-white/10 px-2 text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white flex items-center justify-center"
              aria-label={t.hideLauncher}
              title={t.hideLauncher}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {launcherMinimized && (
        <button
          type="button"
          onClick={restoreLauncher}
          className="fixed bottom-3 end-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-[#1f5a3e]/20 bg-background/90 backdrop-blur-sm px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground shadow-sm hover:border-[#1f5a3e]/35 hover:text-foreground transition-colors"
          aria-label={t.restore}
          title={t.restore}
        >
          <Sparkles className="w-3 h-3 text-[#2d6a4f]" aria-hidden />
          <span className="text-foreground/90">{t.brand}</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
          dir={isAr ? "rtl" : "ltr"}
        >
          <div
            className="w-full sm:max-w-lg h-[86vh] sm:h-[70vh] bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 text-white shrink-0"
              style={{ background: GUIDE_GREEN }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-white/12 ring-1 ring-white/10 flex items-center justify-center">
                  <Bot className="w-4 h-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs leading-tight truncate text-white/95">
                    {t.brand}
                  </div>
                  {hasDailyCap(usage) && (
                    <div className="text-[10px] text-white/60 truncate">
                      {t.usageLine(usage.remaining, usage.limit)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowHistory((s) => !s)}
                  className="px-2 py-1 text-[11px] rounded-md hover:bg-white/10 transition-colors text-white/90"
                >
                  {t.history}
                </button>
                <button
                  type="button"
                  onClick={newChat}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                  title={t.newChat}
                  aria-label={t.newChat}
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                  aria-label={t.close}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {conversations.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12">{t.noHistory}</div>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted group"
                    >
                      <button
                        type="button"
                        onClick={() => loadConversation(c.id)}
                        className={`flex-1 text-sm truncate ${isAr ? "text-right" : "text-left"}`}
                      >
                        {c.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteConversation(c.id)}
                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all"
                        aria-label={t.deleteConfirm}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <div
                      className="inline-flex w-11 h-11 rounded-xl items-center justify-center border border-white/10"
                      style={{ background: GUIDE_GREEN_SOFT }}
                    >
                      <Sparkles className="w-5 h-5 text-white/90" />
                    </div>
                    <div className="text-base font-bold">{t.welcomeTitle}</div>
                    <div className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      {t.welcomeBody}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      {t.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setInput(s)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted hover:border-[#1f5a3e]/25 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? (isAr ? "justify-start" : "justify-end") : isAr ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                        m.role === "user"
                          ? `bg-[#1f5a3e] text-white shadow-sm ${isAr ? "rounded-tr-sm" : "rounded-tl-sm"}`
                          : `bg-muted text-foreground border border-border/60 ${isAr ? "rounded-tl-sm" : "rounded-tr-sm"}`
                      }`}
                    >
                      {m.content}
                      {m.cached === 1 && (
                        <div className="text-[10px] opacity-70 mt-1">{t.cached}</div>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className={`flex ${isAr ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`bg-muted border border-border/60 rounded-2xl px-4 py-3 ${isAr ? "rounded-tl-sm" : "rounded-tr-sm"}`}
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-[#1f5a3e]" />
                    </div>
                  </div>
                )}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm rounded-lg px-3 py-2 text-center">
                    {error}
                  </div>
                )}
              </div>
            )}

            {!showHistory && (
              <div className="border-t border-border p-3 shrink-0 bg-background/95 backdrop-blur-sm">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder={t.placeholder}
                    disabled={sending || (hasDailyCap(usage) && usage.remaining <= 0)}
                    className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f5a3e]/35 max-h-32"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending || !input.trim() || (hasDailyCap(usage) && usage.remaining <= 0)}
                    className="w-10 h-10 rounded-xl bg-[#1f5a3e] hover:bg-[#153d2c] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                    aria-label={t.send}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {hasDailyCap(usage) && usage.remaining <= 0 && (
                  <div className="text-xs text-red-500 text-center mt-2">{t.dailyLimit}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Mounts the Hasaad Guide once at the app root so it shows up on every
 * teacher/organizer page (mobile + desktop) — including pages that don't
 * wrap themselves in `<Layout>` (e.g. teacher/profile, teacher/new-activity,
 * teacher/categories, teacher/collections, presentations/present, etc.).
 *
 * Hidden on student-facing routes and visitor/auth screens to keep the
 * launcher out of the way for non-teacher flows.
 */
export function GlobalAiAssistant() {
  const { lang } = useI18n();
  const [location] = useLocation();
  const { data: user } = useGetCurrentTeacher({
    query: { retry: false } as any,
  });

  // Routes where the assistant must not appear, even if a teacher session
  // happens to exist. These are student-facing, auth-only screens, or
  // full-screen surfaces where the floating launcher would overlap the
  // primary content (presentation present/print mode, the public viewer,
  // and live-control / live-show / live-play screens).
  const HIDDEN_PREFIXES = [
    "/student",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/game/play",
    "/game/join",
    "/p/control",
    "/p/show",
    "/p/play",
    "/p/join",
    "/p/results",
    "/p", // public viewer `/p/:id` — full-screen, no chrome
  ];
  // Path-segment-based suffix matches for routes that don't fit a single
  // prefix (e.g. `/teacher/presentations/:id/present`). We normalize off
  // any query string / hash before testing — wouter's `useLocation`
  // returns just the pathname today, but guarding makes the assistant
  // stay hidden even if a query like `?slide=2` is appended.
  const HIDDEN_SUFFIXES = ["/present", "/print"];
  const pathOnly = location.split("?")[0].split("#")[0];
  const hidden =
    HIDDEN_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(p + "/")) ||
    HIDDEN_SUFFIXES.some((s) => pathOnly.endsWith(s));

  if (hidden) return null;
  return <AiAssistant enabled={!!user} lang={lang} />;
}
