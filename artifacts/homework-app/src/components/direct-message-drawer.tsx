import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageSquare, ShieldCheck, ImagePlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface DmMessage {
  id: number;
  senderId: number;
  content: string;
  imageUrl: string | null;
  readAt: string | null;
  createdAt: string;
  mine: boolean;
}

/** يرفع صورة إلى التخزين ويعيد المسار الداخلي "/objects/<id>" أو null */
export async function uploadDmImage(file: File): Promise<string | null> {
  try {
    const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-image-url`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!reqRes.ok) return null;
    const { uploadURL, objectPath, finalizeURL, uploadTicket } = await reqRes.json();
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) return null;
    const finalized = await fetch(`${API_BASE}/api${finalizeURL || "/storage/uploads/finalize"}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectPath, uploadTicket }) });
    if (!finalized.ok) return null;
    return objectPath;
  } catch {
    return null;
  }
}

export function dmImageSrc(objectPath: string): string {
  return `${API_BASE}/api/storage${objectPath}`;
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
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
    mutationFn: async ({ content, image }: { content: string; image: File | null }) => {
      let imageUrl: string | undefined;
      if (image) {
        const objectPath = await uploadDmImage(image);
        if (!objectPath) throw new Error(isAr ? "فشل رفع الصورة" : "Image upload failed");
        imageUrl = objectPath;
      }
      const res = await fetch(`${API_BASE}/api/direct-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, imageUrl }),
      });
      if (!res.ok) throw new Error(isAr ? "فشل الإرسال" : "Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dm-teacher"] });
      setText("");
      pickImage(null);
    },
    onError: () => setUploadError(true),
  });

  const canSend = (text.trim().length > 0 || !!pendingImage) && !sendMsg.isPending;
  function doSend() {
    if (canSend) sendMsg.mutate({ content: text.trim(), image: pendingImage });
  }

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
    return d.toLocaleTimeString(isAr ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function dateLabel(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return isAr ? "اليوم" : "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return isAr ? "أمس" : "Yesterday";
    return d.toLocaleDateString(isAr ? "ar-SA" : "en-US", { day: "numeric", month: "long" });
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
            initial={{ x: dir === "rtl" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: dir === "rtl" ? "-100%" : "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 end-0 z-50 w-full max-w-sm bg-card border-s border-border flex flex-col shadow-2xl"
            dir={dir}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-[#1E4D35]">
              <div className="w-9 h-9 rounded-full bg-[#C9A050]/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4.5 h-4.5 text-[#C9A050]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{isAr ? "المسؤول" : "Administrator"}</p>
                <p className="text-xs text-white/60">{isAr ? "مراسلة مباشرة" : "Direct messages"}</p>
              </div>
              <button
                onClick={onClose}
                  aria-label={isAr ? "إغلاق" : "Close"}
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
                  <p className="text-sm font-bold text-foreground">{isAr ? "ابدأ المحادثة" : "Start the conversation"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? "يمكنك التواصل مع المسؤول بشكل مباشر" : "You can contact the administrator directly"}
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
                               {isAr ? "المسؤول" : "Administrator"}
                            </p>
                          )}
                          {m.imageUrl && (
                            <a href={dmImageSrc(m.imageUrl)} target="_blank" rel="noreferrer">
                              <img
                                src={dmImageSrc(m.imageUrl)}
                                 alt={isAr ? "صورة مرفقة" : "Attached image"}
                                loading="lazy"
                                className="rounded-lg max-h-52 w-auto mb-1.5 border border-black/10"
                              />
                            </a>
                          )}
                          {m.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>}
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
              {pendingPreview && (
                <div className="relative inline-block mb-2">
                  <img src={pendingPreview} alt={isAr ? "معاينة" : "Preview"} className="h-16 rounded-lg border border-border" />
                  <button
                    onClick={() => pickImage(null)}
                    aria-label={isAr ? "إزالة الصورة" : "Remove image"}
                    className="absolute -top-1.5 -start-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                    data-testid="btn-remove-dm-image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {uploadError && (
                <p className="text-[11px] text-red-500 mb-1.5">{isAr ? "تعذّر إرفاق الصورة — تأكد أنها صورة وأصغر من 10MB" : "Unable to attach image — use an image smaller than 10 MB"}</p>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                  data-testid="input-dm-image"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title={isAr ? "إرفاق صورة" : "Attach image"}
                  aria-label={isAr ? "إرفاق صورة" : "Attach image"}
                  className="p-2.5 rounded-xl border border-input text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                  data-testid="btn-attach-dm-image"
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
                  placeholder={isAr ? "اكتب رسالتك للمسؤول…" : "Write a message to the administrator…"}
                  rows={2}
                  maxLength={2000}
                  className="flex-1 resize-none rounded-xl border border-input bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                />
                <button
                  onClick={doSend}
                  disabled={!canSend}
                  aria-label={isAr ? "إرسال" : "Send"}
                  className="p-2.5 rounded-xl bg-[#1E4D35] text-white disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
                >
                  {sendMsg.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
                {isAr ? "Enter للإرسال · Shift+Enter لسطر جديد" : "Enter to send · Shift+Enter for a new line"}
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
