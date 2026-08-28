import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCheck, FileText, Gift, Crown, Infinity, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  assignmentId: number | null;
  messageId: number | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  onDirectMessageClick?: () => void;
}

export function NotificationBell({ onDirectMessageClick }: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/notifications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleNotifClick(n: Notification) {
    if (!n.isRead) markRead.mutate(n.id);
    if (["credit_award", "plan_award", "unlimited_award"].includes(n.type)) {
      setOpen(false);
    } else if (n.type === "direct_message") {
      onDirectMessageClick?.();
      setOpen(false);
    } else if (n.type === "maraqui_approval") {
      setLocation("/teacher/admin?tab=maraqui");
      setOpen(false);
    } else if (
      (n.type === "parent_message_read" || n.type === "parent_message_reply") &&
      n.messageId
    ) {
      setLocation(`/teacher/parent-messages?message=${n.messageId}`);
      setOpen(false);
    } else if (n.assignmentId) {
      setLocation(`/teacher/assignment/${n.assignmentId}`);
      setOpen(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isAr ? "الآن" : "Just now";
    if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isAr ? `منذ ${hours} س` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return isAr ? `منذ ${days} ي` : `${days}d ago`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title={isAr ? "الإشعارات" : "Notifications"}
        aria-label={isAr ? "الإشعارات" : "Notifications"}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm"
          >
            {unreadCount > 9 ? "+9" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-full mt-2 w-[min(92vw,24rem)] bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50"
            dir={dir}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="font-bold text-foreground">{isAr ? "الإشعارات" : "Notifications"}</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {isAr ? "قراءة الكل" : "Mark all as read"}
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">{isAr ? "لا توجد إشعارات" : "No notifications"}</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-start px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0 ${
                      !n.isRead ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                      n.type === "credit_award" || n.type === "plan_award" || n.type === "unlimited_award"
                        ? !n.isRead ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                        : n.type === "direct_message"
                          ? !n.isRead ? "bg-[#1E4D35]/15 text-[#1E4D35]" : "bg-muted text-muted-foreground"
                          : !n.isRead ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {n.type === "credit_award" ? <Gift className="w-4 h-4" />
                        : n.type === "plan_award" ? <Crown className="w-4 h-4" />
                        : n.type === "unlimited_award" ? <Infinity className="w-4 h-4" />
                        : n.type === "direct_message" ? <MessageSquare className="w-4 h-4" />
                        : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!n.isRead ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
