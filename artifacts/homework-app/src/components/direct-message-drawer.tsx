import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface DmMessage {
  id: number;
  senderId: number;
  content: string;
  readAt: string | null;
  createdAt: string;
  mine: boolean;
}

interface DmData {
  messages: DmMessage[];
  unreadCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DirectMessageDrawer({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DmData>({
    queryKey: ["dm-teacher"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/direct-messages`, { credentials: "include" });
      if (!res.ok) return { messages: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: open ? 10000 : false,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: async (senderId: number) => {
      await fetch(`${API_BASE}/api/direct-messages/read/${senderId}`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dm-teacher"] });
      queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
    },
  });

  const sendMsg = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`${API_BASE}/api/direct-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("فشل الإرسال");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dm-teacher"] });
      setText("");
    },
  });

  useEffect(() => {
    if (open && data?.messages) {
      const adminMsgs = data.messages.filter(m => !m.mine && !m.readAt);
      if (adminMsgs.length > 0) {
        const adminId = adminMsgs[0].senderId;
        markRead.mutate(adminId);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [open, data?.messages?.length]);

  function timeStr(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  }

  function dateLabel(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return "اليوم";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "أمس";
    return d.toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
  }

  const messages = data?.messages ?? [];

  const groupedMessages = messages.reduce<{ label: string; items: DmMessage[] }[]>((acc, m) => {
    const label = dateLabel(m.createdAt);
    const last = acc[acc.length - 1];
    if (last && last.label === label) {
      last.items.push(m);
    } else {
      acc.push({ label, items: [m] });
    }
    return acc;
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 end-0 z-50 w-full max-w-sm bg-card border-s border-border flex flex-col shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-[#1E4D35]">
              <div className="w-9 h-9 rounded-full bg-[#C9A050]/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4.5 h-4.5 text-[#C9A050]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">المسؤول</p>
                <p className="text-xs text-white/60">مراسلة مباشرة</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <MessageSquare className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-bold text-foreground">ابدأ المحادثة</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    يمكنك التواصل مع المسؤول بشكل مباشر
                  </p>
                </div>
              ) : (
                groupedMessages.map(group => (
                  <div key={group.label} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] font-bold text-muted-foreground/60 px-2">{group.label}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {group.items.map((m) => (
                      <div key={m.id} className={`flex ${m.mine ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                            m.mine
                              ? "bg-[#1E4D35] text-white rounded-ss-none"
                              : "bg-[#C9A050]/15 text-foreground border border-[#C9A050]/30 rounded-se-none"
                          }`}
                        >
                          {!m.mine && (
                            <p className="text-[10px] font-bold text-[#C9A050] mb-1 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              المسؤول
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                          <p className={`text-[10px] mt-1 text-end ${m.mine ? "text-white/50" : "text-muted-foreground/50"}`}>
                            {timeStr(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-border bg-background">
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (text.trim()) sendMsg.mutate(text.trim());
                    }
                  }}
                  placeholder="اكتب رسالتك للمسؤول…"
                  rows={2}
                  maxLength={2000}
                  className="flex-1 resize-none rounded-xl border border-input bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                />
                <button
                  onClick={() => { if (text.trim()) sendMsg.mutate(text.trim()); }}
                  disabled={!text.trim() || sendMsg.isPending}
                  className="p-2.5 rounded-xl bg-[#1E4D35] text-white disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
                >
                  {sendMsg.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
                Enter للإرسال · Shift+Enter لسطر جديد
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function useDmUnreadCount(enabled = true) {
  const { data } = useQuery<DmData>({
    queryKey: ["dm-teacher"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/direct-messages`, { credentials: "include" });
      if (!res.ok) return { messages: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: enabled ? 15000 : false,
    enabled,
  });
  return data?.unreadCount ?? 0;
}
