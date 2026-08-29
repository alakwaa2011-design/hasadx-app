import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageSquare, Users, ArrowRight, Plus, Search, X, ImagePlus, CheckCheck, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useSearch } from "wouter";
import { uploadDmImage, dmImageSrc } from "@/components/direct-message-drawer";

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
  imageUrl: string | null;
  readAt: string | null;
  createdAt: string;
  mine: boolean;
}

interface TeacherListItem {
  id: number;
  name: string;
  email: string | null;
}

export function MessagesTab() {
  const { lang, dir, t } = useI18n();
  const m = t.adminMessages;
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>("");
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const urlSearch = useSearch();
  const requestedTeacherId = Number(new URLSearchParams(urlSearch).get("teacher"));

  const { data: threads = [], isLoading: threadsLoading } = useQuery<TeacherThread[]>({
    queryKey: ["dm-admin-threads"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/direct-messages`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: allTeachers = [], isLoading: teachersLoading } = useQuery<TeacherListItem[]>({
    queryKey: ["admin-teachers-list"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/teachers`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.teachers ?? data).map((t: any) => ({ id: t.id, name: t.name, email: t.email }));
    },
    enabled: showNewMsg,
    staleTime: 60_000,
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
    mutationFn: async ({ content, image }: { content: string; image: File | null }) => {
      let imageUrl: string | undefined;
      if (image) {
        const objectPath = await uploadDmImage(image);
        if (!objectPath) throw new Error(m.imageUploadFailed);
        imageUrl = objectPath;
      }
      const res = await fetch(`${API_BASE}/api/direct-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, imageUrl, recipientId: selectedTeacherId }),
      });
      if (!res.ok) throw new Error(m.sendFailed);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dm-admin-conv", selectedTeacherId] });
      queryClient.invalidateQueries({ queryKey: ["dm-admin-threads"] });
      setText("");
      pickImage(null);
    },
    onError: () => setUploadError(true),
  });

  function pickImage(file: File | null) {
    setUploadError(false);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    if (file && file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024) {
      setPendingImage(file);
      setPendingPreview(URL.createObjectURL(file));
    } else {
      setPendingImage(null);
      setPendingPreview(null);
      if (file) setUploadError(true);
    }
  }

  const canSend = (text.trim().length > 0 || !!pendingImage) && !sendMsg.isPending;
  function doSend() {
    if (canSend) sendMsg.mutate({ content: text.trim(), image: pendingImage });
  }

  function readTimeStr(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const locale = lang === "ar" ? "ar-SA" : "en-US";
    const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    if (isToday) return time;
    return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })} ${time}`;
  }

  useEffect(() => {
    if (selectedTeacherId && messages.length > 0) {
      const unread = messages.filter(m => !m.mine && !m.readAt);
      if (unread.length > 0) markRead.mutate(selectedTeacherId);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [selectedTeacherId, messages.length]);

  useEffect(() => {
    if (showNewMsg) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [showNewMsg]);

  function timeStr(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const locale = lang === "ar" ? "ar-SA" : "en-US";
    if (isToday) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }

  function openChat(id: number, name: string) {
    setSelectedTeacherId(id);
    setSelectedTeacherName(name);
    setShowNewMsg(false);
    setSearch("");
  }

  const totalUnread = threads.reduce((s, t) => s + t.unread_count, 0);

  const filteredTeachers = allTeachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!Number.isInteger(requestedTeacherId) || requestedTeacherId <= 0) return;
    const thread = threads.find((item) => item.teacher_id === requestedTeacherId);
    setSelectedTeacherId(requestedTeacherId);
    if (thread) setSelectedTeacherName(thread.teacher_name);
  }, [requestedTeacherId, threads]);

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]" dir={dir}>
      {/* ── قائمة المحادثات ── */}
      <div className={`flex flex-col border border-border rounded-2xl overflow-hidden bg-card ${selectedTeacherId && !showNewMsg ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0`}>
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm">{m.conversations}</h3>
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <span className="text-[10px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {totalUnread}
              </span>
            )}
            {/* زر رسالة جديدة */}
            <button
              onClick={() => setShowNewMsg(v => !v)}
              title={showNewMsg ? m.closeTeacherPicker : m.newMessage}
              aria-label={showNewMsg ? m.closeTeacherPicker : m.newMessage}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showNewMsg ? "bg-[#1E4D35] text-white" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {showNewMsg ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showNewMsg ? (
            <motion.div
              key="new-msg-picker"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              {/* حقل البحث */}
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={m.searchTeacher}
                    aria-label={m.searchTeacher}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* قائمة المعلمين */}
              <div className="flex-1 overflow-y-auto">
                {teachersLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label={m.loadingTeachers} />
                  </div>
                ) : filteredTeachers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <p className="text-sm text-muted-foreground">
                      {m.noResults}
                    </p>
                  </div>
                ) : (
                  filteredTeachers.map(t => (
                    <button
                      key={t.id}
                      onClick={() => openChat(t.id, t.name)}
                      className="w-full text-start px-4 py-3 flex items-center gap-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1E4D35] text-white flex items-center justify-center text-sm font-black shrink-0">
                        {t.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{t.name}</p>
                        {t.email && <p className="text-[11px] text-muted-foreground truncate">{t.email}</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="threads-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex-1 overflow-y-auto"
            >
              {threadsLoading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label={m.loadingConversations} />
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4 gap-3">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {m.noConversations}
                  </p>
                  <button
                    onClick={() => setShowNewMsg(true)}
                    className="text-xs font-bold text-[#1E4D35] hover:underline"
                  >
                    {m.startNew}
                  </button>
                </div>
              ) : (
                threads.map(thread => (
                  <button
                    key={thread.teacher_id}
                    onClick={() => openChat(thread.teacher_id, thread.teacher_name)}
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
                            <span className="text-[#1E4D35] font-bold">{m.youPrefix}</span>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── نافذة المحادثة ── */}
      {selectedTeacherId ? (
        <div className="flex-1 flex flex-col border border-border rounded-2xl overflow-hidden bg-card min-w-0">
          <div className="px-4 py-3 border-b border-border bg-[#1E4D35] flex items-center gap-3">
            <button
              onClick={() => setSelectedTeacherId(null)}
              aria-label={m.backToConversations}
              className="md:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
            >
              <ArrowRight className={`w-4 h-4 ${dir === "ltr" ? "rotate-180" : ""}`} />
            </button>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-black shrink-0">
              {selectedTeacherName[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{selectedTeacherName}</p>
              <p className="text-[10px] text-white/50">{m.directMessage}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label={m.loadingMessages} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{m.startConversation}</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                      message.mine
                        ? "bg-[#1E4D35] text-white rounded-se-none"
                        : "bg-muted text-foreground rounded-ss-none"
                    }`}
                  >
                    {message.imageUrl && (
                      <a href={dmImageSrc(message.imageUrl)} target="_blank" rel="noreferrer">
                        <img
                          src={dmImageSrc(message.imageUrl)}
                          alt={m.attachedImage}
                          loading="lazy"
                          className="rounded-lg max-h-56 w-auto mb-1.5 border border-black/10"
                        />
                      </a>
                    )}
                    {message.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>}
                    <div className={`flex items-center gap-1 mt-1 ${message.mine ? "text-white/50 justify-start" : "text-muted-foreground/50 justify-end"}`}>
                      <span className="text-[10px]">{timeStr(message.createdAt)}</span>
                      {/* إيصال القراءة — يظهر للمسؤول فقط على رسائله */}
                      {message.mine && (
                        message.readAt ? (
                          <span className="flex items-center gap-0.5 text-[#7FD1A8]" title={m.readAt.replace("{time}", readTimeStr(message.readAt))} data-testid={`read-receipt-${message.id}`}>
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span className="text-[10px]">{m.readAt.replace("{time}", readTimeStr(message.readAt))}</span>
                          </span>
                        ) : (
                          <Check className="w-3.5 h-3.5 opacity-60" aria-label={m.unread} />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border">
            {pendingPreview && (
              <div className="relative inline-block mb-2">
                <img src={pendingPreview} alt={m.preview} className="h-16 rounded-lg border border-border" />
                <button
                  onClick={() => pickImage(null)}
                  aria-label={m.removeImage}
                  className="absolute -top-1.5 -start-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                  data-testid="btn-remove-admin-dm-image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {uploadError && (
              <p className="text-[11px] text-red-500 mb-1.5">
                {m.attachmentError}
              </p>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                data-testid="input-admin-dm-image"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title={m.attachImage}
                aria-label={m.attachImage}
                className="p-2.5 rounded-xl border border-input text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                data-testid="btn-attach-admin-dm-image"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    doSend();
                  }
                }}
                placeholder={m.messagePlaceholder.replace("{name}", selectedTeacherName)}
                aria-label={m.messagePlaceholder.replace("{name}", selectedTeacherName)}
                rows={2}
                maxLength={2000}
                className="flex-1 resize-none rounded-xl border border-input bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={doSend}
                disabled={!canSend}
                aria-label={m.send}
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
              {m.selectConversation}
            </p>
            <button
              onClick={() => setShowNewMsg(true)}
              className="mt-3 text-xs font-bold text-[#1E4D35] hover:underline"
            >
              {m.orStartNew}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
