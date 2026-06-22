import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageSquare, Users, ChevronRight, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface TeacherThread {
  teacher_id: number;
  teacher_name: string;
  teacher_email: string | null;
  last_message: string;
  last_message_at: string;
  last_sender_id: number;
  unread_count: number;
}

interface DmMessage {
  id: number;
  senderId: number;
  content: string;
  readAt: string | null;
  createdAt: string;
  mine: boolean;
}

export function MessagesTab() {
  const { lang } = useI18n();
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>("");
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: threads = [], isLoading: threadsLoading } = useQuery<TeacherThread[]>({
    queryKey: ["dm-admin-threads"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/direct-messages`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<DmMessage[]>({
    queryKey: ["dm-admin-conv", selectedTeacherId],
    queryFn: async () => {
      if (!selectedTeacherId) return [];
      const res = await fetch(`${API_BASE}/api/direct-messages/${selectedTeacherId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: selectedTeacherId ? 10000 : false,
    enabled: !!selectedTeacherId,
  });

  const markRead = useMutation({
    mutationFn: async (senderId: number) => {
      await fetch(`${API_BASE}/api/direct-messages/read/${senderId}`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dm-admin-threads"] }),
  });

  const sendMsg = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`${API_BASE}/api/direct-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, recipientId: selectedTeacherId }),
      });
      if (!res.ok) throw new Error("فشل الإرسال");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dm-admin-conv", selectedTeacherId] });
      queryClient.invalidateQueries({ queryKey: ["dm-admin-threads"] });
      setText("");
    },
  });

  useEffect(() => {
    if (selectedTeacherId && messages.length > 0) {
      const unread = messages.filter(m => !m.mine && !m.readAt);
      if (unread.length > 0) markRead.mutate(selectedTeacherId);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [selectedTeacherId, messages.length]);

  function timeStr(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
  }

  const totalUnread = threads.reduce((s, t) => s + t.unread_count, 0);

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]" dir="rtl">
      <div className={`flex flex-col border border-border rounded-2xl overflow-hidden bg-card ${selectedTeacherId ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0`}>
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm">{lang === "ar" ? "المحادثات" : "Conversations"}</h3>
          </div>
          {totalUnread > 0 && (
            <span className="text-[10px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {totalUnread}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {lang === "ar" ? "لا توجد محادثات بعد" : "No conversations yet"}
              </p>
            </div>
          ) : (
            threads.map(thread => (
              <button
                key={thread.teacher_id}
                onClick={() => {
                  setSelectedTeacherId(thread.teacher_id);
                  setSelectedTeacherName(thread.teacher_name);
                }}
                className={`w-full text-start px-4 py-3 flex items-start gap-3 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/40 ${
                  selectedTeacherId === thread.teacher_id ? "bg-primary/5" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-[#1E4D35] text-white flex items-center justify-center text-sm font-black shrink-0">
                  {thread.teacher_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm truncate ${thread.unread_count > 0 ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
                      {thread.teacher_name}
                    </p>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      {timeStr(thread.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate flex-1">
                      {thread.last_sender_id !== thread.teacher_id && (
                        <span className="text-[#1E4D35] font-bold">أنت: </span>
                      )}
                      {thread.last_message}
                    </p>
                    {thread.unread_count > 0 && (
                      <span className="text-[10px] font-black bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedTeacherId ? (
        <div className="flex-1 flex flex-col border border-border rounded-2xl overflow-hidden bg-card min-w-0">
          <div className="px-4 py-3 border-b border-border bg-[#1E4D35] flex items-center gap-3">
            <button
              onClick={() => setSelectedTeacherId(null)}
              className="md:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-black shrink-0">
              {selectedTeacherName[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{selectedTeacherName}</p>
              <p className="text-[10px] text-white/50">{lang === "ar" ? "مراسلة مباشرة" : "Direct message"}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "ابدأ المحادثة" : "Start the conversation"}</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                      m.mine
                        ? "bg-[#1E4D35] text-white rounded-se-none"
                        : "bg-muted text-foreground rounded-ss-none"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.mine ? "text-white/50 text-start" : "text-muted-foreground/50 text-end"}`}>
                      {timeStr(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border">
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
                placeholder={lang === "ar" ? `اكتب رسالة إلى ${selectedTeacherName}…` : `Message ${selectedTeacherName}…`}
                rows={2}
                maxLength={2000}
                className="flex-1 resize-none rounded-xl border border-input bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center border border-border rounded-2xl bg-card/50">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {lang === "ar" ? "اختر محادثة لعرضها" : "Select a conversation"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
