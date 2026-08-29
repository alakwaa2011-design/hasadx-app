import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ParentMessagesContent } from "@/pages/teacher/parent-messages";
import { dmImageSrc, uploadDmImage } from "@/components/direct-message-drawer";
import {
  ImagePlus, Inbox, Loader2, Mail, MessageSquare, Send, ShieldCheck, X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface PlatformMessage {
  id: number;
  senderId: number;
  content: string;
  imageUrl: string | null;
  source: "general" | "feedback";
  feedbackId: number | null;
  readAt: string | null;
  createdAt: string;
  mine: boolean;
}

interface PlatformData {
  messages: PlatformMessage[];
  unreadCount: number;
}

type MessagesTab = "all" | "platform" | "parents";

function PlatformMessagesPanel() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const pickImage = (file: File | null) => {
    setImageError(false);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    if (!file) {
      setPendingImage(null);
      setPendingPreview(null);
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setPendingImage(null);
      setPendingPreview(null);
      setImageError(true);
      return;
    }
    setPendingImage(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const { data = { messages: [], unreadCount: 0 }, isLoading } = useQuery<PlatformData>({
    queryKey: ["dm-teacher"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/direct-messages`, { credentials: "include" });
      if (!res.ok) throw new Error("load_failed");
      return res.json();
    },
    refetchInterval: 15_000,
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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const send = useMutation({
    mutationFn: async ({ content, image }: { content: string; image: File | null }) => {
      let imageUrl: string | undefined;
      if (image) {
        imageUrl = await uploadDmImage(image) ?? undefined;
        if (!imageUrl) throw new Error("upload_failed");
      }
      const res = await fetch(`${API_BASE}/api/direct-messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, imageUrl }),
      });
      if (!res.ok) throw new Error("send_failed");
      return res.json();
    },
    onSuccess: () => {
      setText("");
      pickImage(null);
      queryClient.invalidateQueries({ queryKey: ["dm-teacher"] });
    },
    onError: () => toast.error(isAr ? "تعذّر إرسال الرسالة" : "Message could not be sent"),
  });

  useEffect(() => {
    const unread = data.messages.find((message) => !message.mine && !message.readAt);
    if (unread && !markRead.isPending) markRead.mutate(unread.senderId);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.messages.length]);

  const submit = () => {
    const content = text.trim();
    if ((content || pendingImage) && !send.isPending) {
      send.mutate({ content, image: pendingImage });
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" dir={dir}>
      <header className="flex items-center gap-3 bg-[#225739] px-4 py-3 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
          <ShieldCheck className="h-5 w-5 text-[#C9A050]" />
        </div>
        <div>
          <h2 className="font-black">{isAr ? "محادثة المنصة" : "Platform conversation"}</h2>
          <p className="text-xs text-white/65">
            {isAr ? "رسائلك واقتراحاتك وردود فريق حصاد" : "Messages, suggestions and replies from Hasaad"}
          </p>
        </div>
      </header>

      <div className="h-[min(58vh,34rem)] overflow-y-auto bg-muted/20 p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="mb-3 h-11 w-11 text-muted-foreground/25" />
            <p className="font-bold">{isAr ? "ابدأ محادثتك مع المنصة" : "Start a conversation with the platform"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {isAr ? "ستظهر هنا أيضًا ردود المسؤولين على اقتراحاتك." : "Replies to your suggestions will also appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.messages.map((message) => (
              <div key={message.id} className={`flex ${message.mine ? "justify-start" : "justify-end"}`}>
                <article className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.mine
                    ? "rounded-ss-sm bg-[#225739] text-white"
                    : "rounded-se-sm border border-[#C9A050]/30 bg-[#C9A050]/12 text-foreground"
                }`}>
                  {!message.mine && (
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-black text-[#9A741D]">
                      <ShieldCheck className="h-3 w-3" />
                      {isAr ? "فريق حصاد" : "Hasaad team"}
                    </p>
                  )}
                  {message.source === "feedback" && (
                    <span className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      message.mine ? "bg-white/12 text-white/80" : "bg-[#C9A050]/20 text-[#7A5910]"
                    }`}>
                      {isAr ? "اقتراح أو ملاحظة" : "Feedback"}
                    </span>
                  )}
                  {message.imageUrl && (
                    <a href={dmImageSrc(message.imageUrl)} target="_blank" rel="noreferrer">
                      <img src={dmImageSrc(message.imageUrl)} alt="" className="mb-2 max-h-56 rounded-xl" />
                    </a>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  <time className={`mt-1 block text-end text-[10px] ${message.mine ? "text-white/50" : "text-muted-foreground"}`}>
                    {new Date(message.createdAt).toLocaleString(isAr ? "ar-KW" : "en-US", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </time>
                </article>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <footer className="border-t border-border bg-background p-3">
        {pendingPreview && (
          <div className="relative mb-2 inline-block">
            <img src={pendingPreview} alt={isAr ? "معاينة الصورة" : "Image preview"} className="h-20 rounded-xl border border-border object-contain" />
            <button type="button" onClick={() => pickImage(null)} className="absolute -start-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white" aria-label={isAr ? "إزالة الصورة" : "Remove image"}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {imageError && (
          <p className="mb-2 text-xs font-medium text-red-600">
            {isAr ? "اختر صورة لا يتجاوز حجمها 10 ميجابايت." : "Choose an image no larger than 10 MB."}
          </p>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-input text-muted-foreground hover:bg-muted" aria-label={isAr ? "إرفاق صورة" : "Attach image"}>
            <ImagePlus className="h-4 w-4" />
          </button>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={isAr ? "اكتب رسالتك لفريق حصاد…" : "Write to the Hasaad team…"}
            className="min-h-12 flex-1 resize-none rounded-xl border border-input bg-muted/30 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={submit}
            disabled={(!text.trim() && !pendingImage) || send.isPending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#225739] text-white transition-opacity disabled:opacity-40"
            aria-label={isAr ? "إرسال" : "Send"}
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </section>
  );
}

export default function TeacherMessagesPage() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const requestedTab = params.get("tab");
  const tab: MessagesTab = requestedTab === "platform" || requestedTab === "parents"
    ? requestedTab
    : "all";

  const setTab = (next: MessagesTab) => {
    const nextParams = new URLSearchParams(search);
    nextParams.set("tab", next);
    if (next !== "parents") nextParams.delete("message");
    setLocation(`/teacher/messages?${nextParams.toString()}`);
  };

  return (
    <Layout>
      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5" dir={dir}>
        <div className="mb-5">
          <div className="mb-1 flex items-center gap-2">
            <Inbox className="h-6 w-6 text-[#225739]" />
            <h1 className="text-2xl font-black text-foreground">{isAr ? "الرسائل" : "Messages"}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isAr ? "رسائل أولياء الأمور ومحادثاتك مع منصة حصاد في مكان واحد." : "Parent and platform conversations in one place."}
          </p>
        </div>

        <nav className="mb-5 flex gap-2 overflow-x-auto rounded-xl border border-border bg-card p-1.5">
          {([
            ["all", Inbox, isAr ? "الكل" : "All"],
            ["platform", MessageSquare, isAr ? "المنصة" : "Platform"],
            ["parents", Mail, isAr ? "أولياء الأمور" : "Parents"],
          ] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex min-w-fit items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                tab === key ? "bg-[#225739] text-white" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === "all" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <button type="button" onClick={() => setTab("platform")} className="rounded-2xl border border-border bg-card p-6 text-start shadow-sm transition hover:border-[#225739]/40 hover:shadow-md">
              <ShieldCheck className="mb-4 h-9 w-9 text-[#225739]" />
              <h2 className="text-lg font-black">{isAr ? "رسائل المنصة" : "Platform messages"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{isAr ? "تواصل مع فريق حصاد وتابع الردود على اقتراحاتك." : "Contact Hasaad and follow replies to your feedback."}</p>
            </button>
            <button type="button" onClick={() => setTab("parents")} className="rounded-2xl border border-border bg-card p-6 text-start shadow-sm transition hover:border-[#225739]/40 hover:shadow-md">
              <Mail className="mb-4 h-9 w-9 text-[#225739]" />
              <h2 className="text-lg font-black">{isAr ? "رسائل أولياء الأمور" : "Parent messages"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{isAr ? "أرسل الرسائل وتابع القراءة والردود والمرفقات." : "Send messages and follow reads, replies and attachments."}</p>
            </button>
          </div>
        ) : tab === "platform" ? (
          <PlatformMessagesPanel />
        ) : (
          <ParentMessagesContent />
        )}
      </main>
    </Layout>
  );
}