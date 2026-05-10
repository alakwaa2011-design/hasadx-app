import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquarePlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/* Routes where the floating feedback button is hidden. We hide it on
   `/teacher` and `/organizer` so the teacher isn't seeing it on every
   screen all day — they still have a "ملاحظات" tile in the dashboard
   action menu and a link in the footer. */
const HIDDEN_PREFIXES = [
  "/feedback",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/game/play",
  "/game/join",
  "/student",
  "/teacher",
  "/organizer",
  "/presentations/present",
  "/p/control",
  "/p/show",
  "/p/play",
  "/p/join",
];

export function GlobalFeedbackFab() {
  const { lang } = useI18n();
  const [location] = useLocation();
  const [hover, setHover] = useState(false);

  const hidden = HIDDEN_PREFIXES.some(
    (p) => location === p || location.startsWith(p + "/"),
  );
  if (hidden) return null;

  const label = lang === "ar" ? "اقتراح أو ملاحظة" : "Suggestion or feedback";
  const tooltip =
    lang === "ar"
      ? "شاركنا اقتراحك أو ملاحظتك — نقرأ كل رسالة ونردّ"
      : "Share your suggestion or feedback — we read and reply to every message";

  return (
    <Link
      href="/feedback"
      title={tooltip}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="fixed bottom-16 end-3 z-40 inline-flex items-center gap-2 rounded-full bg-[#225739] hover:bg-[#1c4a30] text-white shadow-lg shadow-black/20 ring-2 ring-white/70 dark:ring-[#0c1f15]/80 transition-all px-3 py-2.5 sm:bottom-20"
      style={{ minHeight: 44 }}
    >
      <MessageSquarePlus className="w-4 h-4 shrink-0" />
      <span
        className={`text-xs font-bold whitespace-nowrap overflow-hidden transition-all duration-200 ${
          hover ? "max-w-[180px] opacity-100 ms-0.5" : "max-w-0 opacity-0"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
