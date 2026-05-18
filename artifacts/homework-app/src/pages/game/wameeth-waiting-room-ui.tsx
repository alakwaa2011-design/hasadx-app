/**
 * وميض — غرفة الانتظار (واجهة فقط، مطابقة للمرجع البصري)
 */
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { ClassSelector } from "@/components/teacher/class-selector";
import { GameQRCode } from "@/components/game-qr-code";
import { AvatarDisplay } from "@/components/avatar-display";
import {
  Play,
  Home,
  Languages,
  Users,
  User,
  UsersRound,
  SkipForward,
  Gift,
  Mic,
  Lock,
  Unlock,
  Ban,
  Copy,
  CheckCircle,
  Link2,
  Share2,
  ArrowRightLeft,
  ArrowRight,
  Smartphone,
  Power,
  LockKeyhole,
  Terminal,
  Bot,
  GraduationCap,
  Info,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Palette (reference) ── */
const P = {
  bg: "#031b11",
  primary: "#0a4d26",
  card: "#062415",
  cardAlt: "#082b18",
  cardDeep: "#021408",
  gold: "#d4a63a",
  goldLight: "#f4c95d",
  text: "#ffffff",
  muted: "#9fb89f",
  border: "rgba(212,166,58,0.28)",
  neon: "#3dff8a",
  neonDim: "rgba(61,255,138,0.35)",
} as const;

const MAX_LOBBY_PLAYERS = 20;

/** ديسكتوب: صف واحد | تابلت: شبكة 3 أعمدة (صفان) | جوال: عمودان */
const SETTING_CARD_DESKTOP = "xl:w-[min(188px,13.5vw)] xl:shrink-0";

export type LobbyPlayer = {
  name: string;
  score: number;
  avatar?: string;
  teamName?: string | null;
  isBot?: boolean;
  hasPassword?: boolean;
};

export interface WameethWaitingRoomUIProps {
  dir: "rtl" | "ltr";
  isAr: boolean;
  pin: string;
  players: LobbyPlayer[];
  teamNames: string[];
  lockedTeams: string[];
  currentGameMode: "solo" | "teams";
  autoAdvance: boolean;
  giftsEnabled: boolean;
  hackMode: boolean;
  ttsEnabled: boolean;
  roomLocked: boolean;
  targetClass: string;
  targetClassEditing: boolean;
  botCount: number;
  isAddingBots: boolean;
  copied: boolean;
  linkCopied: boolean;
  hackDurationMin: number;
  hackCustomMin: string;
  broadcastMessage: string;
  broadcastSent: boolean;
  sentMessages: { id: number; text: string; timestamp: number }[];
  t: {
    teacherGame: {
      teamMode?: string;
      soloMode?: string;
    };
  };
  onHome: () => void;
  onToggleLang: () => void;
  onEndGame: () => void;
  onStartGame: () => void;
  onCopyPin: () => void;
  onCopyLink: () => void;
  onSetAutoAdvance: (v: boolean) => void;
  onToggleGifts: () => void;
  onToggleHackMode: () => void;
  onToggleTts: () => void;
  onToggleRoomLock: () => void;
  onSetTargetClassEditing: (fn: (v: boolean) => boolean) => void;
  onUpdateTargetClass: (v: string) => void;
  onSetBotCount: (fn: (c: number) => number) => void;
  onAddBots: () => void;
  onSetHackDurationMin: (m: number) => void;
  onSetHackCustomMin: (v: string) => void;
  onKickPlayer: (name: string) => void;
  onToggleTeamLock: (teamName: string) => void;
  onMovePlayer: (playerName: string, teamName: string) => void;
  onBroadcastMessageChange: (v: string) => void;
  onSendBroadcast: () => void;
  onClearSentMessages: () => void;
  onRemoveSentMessage: (id: number) => void;
}

function GoldToggle({
  on,
  onClick,
  disabled,
  dir,
  large,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  dir: "rtl" | "ltr";
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative shrink-0 rounded-full transition-all duration-300",
        large ? "h-9 w-[58px]" : "h-8 w-[52px]",
        disabled && "cursor-not-allowed opacity-40",
        on ? "bg-gradient-to-b from-[#f4c95d] to-[#d4a63a] shadow-[0_0_16px_rgba(212,166,58,0.45)]" : "bg-[#02140c] border border-[rgba(212,166,58,0.2)]",
      )}
      aria-pressed={on}
    >
      <span
        className={cn(
          "absolute top-1 rounded-full bg-white shadow-md transition-transform duration-300",
          large ? "h-7 w-7" : "h-6 w-6",
        )}
        style={
          dir === "rtl"
            ? { right: 4, transform: on ? "translateX(-22px)" : "translateX(0)" }
            : { left: 4, transform: on ? "translateX(22px)" : "translateX(0)" }
        }
      />
    </button>
  );
}

function IconCircle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full border sm:h-[52px] sm:w-[52px] lg:h-14 lg:w-14",
        "border-[rgba(212,166,58,0.22)] bg-gradient-to-b from-[#0a4d26] to-[#02140c]",
        "shadow-[inset_0_1px_0_rgba(244,201,93,0.12),0_4px_20px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SettingCard({
  icon,
  title,
  desc,
  children,
  delay = 0,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        "flex min-h-[168px] flex-col rounded-[20px] border p-4 backdrop-blur-sm sm:min-h-[180px]",
        "lg:min-h-[200px] lg:rounded-[22px] lg:p-5 lg:transition-transform lg:hover:-translate-y-1",
        "lg:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35),0_0_24px_rgba(212,166,58,0.08)]",
        "overflow-visible border-[rgba(212,166,58,0.22)] bg-gradient-to-b from-[#062415] to-[#021408]",
        "transition-[border-color,box-shadow] duration-300 active:scale-[0.98] lg:hover:border-[rgba(212,166,58,0.38)]",
        className,
      )}
    >
      <IconCircle>{icon}</IconCircle>
      <h3 className="mt-3 text-sm font-black text-white sm:mt-4 sm:text-[15px]">{title}</h3>
      {desc ? <p className="mt-1 text-[11px] leading-relaxed text-[#9fb89f] sm:text-xs">{desc}</p> : null}
      <div className="mt-auto flex items-center justify-end pt-3 sm:pt-4">{children}</div>
    </motion.div>
  );
}

function GoldDust() {
  const pts = [
    { t: "8%", l: "5%", d: 0, s: 2 },
    { t: "72%", l: "12%", d: 0.5, s: 1.5 },
    { t: "18%", r: "8%", d: 1, s: 2.5 },
    { t: "85%", r: "14%", d: 1.4, s: 1 },
    { t: "42%", l: "48%", d: 0.7, s: 1.5 },
    { t: "55%", r: "42%", d: 1.8, s: 2 },
    { t: "30%", l: "78%", d: 0.3, s: 1 },
    { t: "90%", l: "65%", d: 1.1, s: 1.5 },
  ];
  return (
    <>
      {pts.map((p, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute rounded-full bg-[#f4c95d]"
          style={{
            top: p.t,
            left: p.l,
            right: p.r,
            width: p.s,
            height: p.s,
          }}
          animate={{ opacity: [0.08, 0.35, 0.08], y: [0, -8, 0] }}
          transition={{ duration: 4 + i * 0.3, repeat: Infinity, delay: p.d, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

function PlayersZoneDecor() {
  const silhouettes = ["🧑", "👩", "🧑‍🎓", "👨", "👧"];
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.1]" aria-hidden>
        <defs>
          <linearGradient id="wameeth-zone-arc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4a63a" stopOpacity="0" />
            <stop offset="50%" stopColor="#f4c95d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#d4a63a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 0 120 Q 180 40 360 100" fill="none" stroke="url(#wameeth-zone-arc)" strokeWidth="0.8" />
        <path d="M 60 280 Q 280 220 520 260" fill="none" stroke="url(#wameeth-zone-arc)" strokeWidth="0.6" />
        <path d="M 700 60 Q 900 140 1100 80" fill="none" stroke="url(#wameeth-zone-arc)" strokeWidth="0.7" />
      </svg>
      <GoldDust />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {silhouettes.map((emoji, i) => (
          <span
            key={i}
            className="absolute select-none text-[2.75rem] opacity-[0.1] sm:text-5xl"
            style={{
              insetInlineEnd: `${6 + i * 11}%`,
              top: `${18 + (i % 3) * 24}%`,
              filter: "grayscale(0.2)",
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
      <div
        className="pointer-events-none absolute -end-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, rgba(10,77,38,0.5) 0%, transparent 70%)" }}
      />
    </>
  );
}

function HeroGoldLines() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden>
      <defs>
        <linearGradient id="wameeth-gold-line" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4a63a" stopOpacity="0" />
          <stop offset="50%" stopColor="#f4c95d" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d4a63a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-20 80 Q 200 40 400 120" fill="none" stroke="url(#wameeth-gold-line)" strokeWidth="1" />
      <path d="M 900 20 Q 1100 80 1300 30" fill="none" stroke="url(#wameeth-gold-line)" strokeWidth="0.8" />
      <path d="M 50 280 Q 300 240 550 300" fill="none" stroke="url(#wameeth-gold-line)" strokeWidth="0.6" />
    </svg>
  );
}

function SegmentedGold({
  options,
  value,
  onChange,
  isAr,
}: {
  options: readonly { val: boolean; ar: string; en: string }[];
  value: boolean;
  onChange: (v: boolean) => void;
  isAr: boolean;
}) {
  return (
    <div className="flex rounded-xl border border-[rgba(212,166,58,0.18)] bg-[#02140c]/80 p-1" role="group">
      {options.map((opt) => (
        <button
          key={String(opt.val)}
          type="button"
          onClick={() => onChange(opt.val)}
          className={cn(
            "min-h-[40px] min-w-[72px] rounded-lg px-3 py-2 text-xs font-black transition-all duration-200 sm:min-h-0",
            value === opt.val
              ? "bg-gradient-to-b from-[#f4c95d] to-[#d4a63a] text-[#031b11] shadow-[0_2px_12px_rgba(212,166,58,0.35)]"
              : "text-[#9fb89f] hover:text-white",
          )}
        >
          {isAr ? opt.ar : opt.en}
        </button>
      ))}
    </div>
  );
}

export function WameethWaitingRoomUI(props: WameethWaitingRoomUIProps) {
  const {
    dir,
    isAr,
    pin,
    players,
    teamNames,
    lockedTeams,
    currentGameMode,
    autoAdvance,
    giftsEnabled,
    hackMode,
    ttsEnabled,
    roomLocked,
    targetClass,
    botCount,
    isAddingBots,
    copied,
    linkCopied,
    hackDurationMin,
    hackCustomMin,
    broadcastMessage,
    broadcastSent,
    sentMessages,
    t,
    onHome,
    onToggleLang,
    onEndGame,
    onStartGame,
    onCopyPin,
    onCopyLink,
    onSetAutoAdvance,
    onToggleGifts,
    onToggleHackMode,
    onToggleTts,
    onToggleRoomLock,
    onUpdateTargetClass,
    onSetBotCount,
    onAddBots,
    onSetHackDurationMin,
    onSetHackCustomMin,
    onKickPlayer,
    onToggleTeamLock,
    onMovePlayer,
    onBroadcastMessageChange,
    onSendBroadcast,
    onClearSentMessages,
    onRemoveSentMessage,
  } = props;

  const hackPanelRef = useRef<HTMLElement>(null);
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}game/join/${pin}`;
  const playerProgressPct = Math.min(100, (players.length / MAX_LOBBY_PLAYERS) * 100);
  const humanCount = players.filter((p) => !p.isBot).length;

  const scrollToHackPanel = () => {
    hackPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToSettings = () => {
    document.getElementById("game-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShare = async () => {
    const shareText = isAr ? `انضم إلى لعبة وميض! الكود: ${pin}` : `Join Wameeth! Code: ${pin}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: isAr ? "وميض — غرفة الانتظار" : "Wameeth — waiting room",
          text: shareText,
          url: joinUrl,
        });
        return;
      } catch {
        /* cancelled or unsupported */
      }
    }
    onCopyLink();
  };

  const roomStatusLabel = roomLocked
    ? isAr
      ? "الغرفة مغلقة"
      : "Room locked"
    : players.length >= MAX_LOBBY_PLAYERS
      ? isAr
        ? "الغرفة ممتلئة"
        : "Room full"
      : isAr
        ? "بانتظار اللاعبين"
        : "Waiting for players";

  return (
    <Layout noHeader>
      <motion.div
        className="min-h-screen text-white"
        dir={dir}
        style={{
          fontFamily: "'Cairo', 'Tajawal', sans-serif",
          background: `radial-gradient(ellipse 120% 80% at 50% -20%, #0a4d26 0%, ${P.bg} 45%, ${P.cardDeep} 100%)`,
        }}
      >
        {/* ── Header (mobile) ── */}
        <header
          className="sticky top-0 z-50 border-b backdrop-blur-xl lg:hidden"
          style={{ borderColor: P.border, background: "rgba(3,27,17,0.92)" }}
        >
          <motion.div className="relative flex h-[52px] items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                alt={isAr ? "حصاد" : "Hasad"}
                className="h-9 w-9 shrink-0 rounded-lg object-cover ring-2 ring-[rgba(212,166,58,0.25)]"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
              <p className="text-[15px] font-black leading-tight text-[#d4a63a]">{isAr ? "غرفة الانتظار" : "Waiting Room"}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={scrollToSettings}
                className="flex h-10 w-10 items-center justify-center rounded-xl border transition-colors active:scale-95"
                style={{ borderColor: P.border, background: "rgba(8,43,24,0.65)" }}
                aria-label={isAr ? "إعدادات" : "Settings"}
              >
                <Settings className="h-[18px] w-[18px] text-[#d4a63a]" />
              </button>
              <button
                type="button"
                onClick={onHome}
                className="flex h-10 w-10 items-center justify-center rounded-xl border transition-colors active:scale-95"
                style={{ borderColor: P.border, background: "rgba(8,43,24,0.65)" }}
                aria-label={isAr ? "رجوع" : "Back"}
              >
                <ArrowRight className="h-5 w-5 text-[#f4c95d]" />
              </button>
            </div>
          </motion.div>
        </header>

        {/* ── Header (desktop) ── */}
        <header
          className="sticky top-0 z-50 hidden border-b backdrop-blur-xl lg:block"
          style={{ borderColor: P.border, background: "rgba(3,27,17,0.88)" }}
        >
          <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between gap-4 px-5 lg:px-10">
            {/* يمين: الشعار */}
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                alt={isAr ? "حصاد" : "Hasad"}
                className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-[rgba(212,166,58,0.25)]"
              />
              <span className="hidden text-lg font-black tracking-tight text-white sm:inline">
                {isAr ? "حصاد" : "Hasad"}
              </span>
            </div>

            {/* وسط: العنوان */}
            <div className="absolute start-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-center md:block">
              <p className="text-lg font-black text-[#d4a63a] lg:text-xl">{isAr ? "غرفة الانتظار" : "Waiting Room"}</p>
              <p className="text-[11px] font-semibold text-[#9fb89f]">
                {isAr ? "وميض — لعبة المعرفة السريعة" : "Wameeth — fast knowledge game"}
              </p>
            </div>

            {/* يسار: أزرار */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onHome}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors hover:border-[rgba(212,166,58,0.4)]"
                style={{ borderColor: P.border, color: P.muted, background: "rgba(8,43,24,0.6)" }}
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">{isAr ? "الرئيسية" : "Home"}</span>
              </button>
              <button
                type="button"
                onClick={onToggleLang}
                className="flex items-center gap-1 rounded-xl border px-2.5 py-2 text-[11px] font-bold"
                style={{ borderColor: P.border, color: P.muted, background: "rgba(8,43,24,0.6)" }}
              >
                <Languages className="h-3.5 w-3.5" />
                {isAr ? "EN" : "ع"}
              </button>
              <button
                type="button"
                onClick={onEndGame}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors hover:border-rose-400/40 hover:text-rose-300"
                style={{ borderColor: P.border, color: P.muted, background: "rgba(8,43,24,0.6)" }}
              >
                <Power className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isAr ? "إنهاء اللعبة" : "End game"}</span>
              </button>
              <motion.button
                type="button"
                onClick={onStartGame}
                disabled={players.length === 0}
                whileHover={players.length > 0 ? { scale: 1.04 } : undefined}
                whileTap={players.length > 0 ? { scale: 0.97 } : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all sm:px-6",
                  "disabled:cursor-not-allowed disabled:opacity-45",
                )}
                style={{
                  background: `linear-gradient(135deg, ${P.goldLight} 0%, ${P.gold} 50%, #b8892a 100%)`,
                  color: "#031b11",
                  boxShadow: players.length > 0 ? "0 4px 28px rgba(212,166,58,0.42), inset 0 1px 0 rgba(255,255,255,0.25)" : undefined,
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                {isAr ? "ابدأ اللعبة" : "Start game"}
              </motion.button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 pb-28 sm:space-y-5 sm:px-5 sm:py-6 lg:space-y-6 lg:px-10 lg:py-8 lg:pb-8">
          {/* ── Hero (mobile) ── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[24px] border lg:hidden"
            style={{
              borderColor: P.border,
              background: `linear-gradient(165deg, ${P.primary} 0%, #062a18 38%, ${P.cardDeep} 100%)`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 48px rgba(212,166,58,0.1), inset 0 1px 0 rgba(244,201,93,0.12)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60"
              style={{ background: "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(244,201,93,0.18) 0%, transparent 70%)" }}
            />
            <GoldDust />
            <div className="relative z-10 flex flex-col items-center px-5 py-7 sm:py-8" dir={dir}>
              <p className="text-xs font-bold tracking-[0.2em] text-[#9fb89f]">{isAr ? "كود اللعبة" : "Game code"}</p>
              <span
                className="mt-3 select-all font-black tabular-nums text-[#f4c95d]"
                dir="ltr"
                style={{
                  fontSize: "clamp(3rem, 14vw, 4.25rem)",
                  letterSpacing: "0.2em",
                  lineHeight: 1,
                  textShadow: "0 0 48px rgba(244,201,93,0.4), 0 2px 0 rgba(0,0,0,0.35)",
                }}
              >
                {pin}
              </span>
              <div className="mt-6 rounded-2xl bg-white p-3 shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
                <GameQRCode url={joinUrl} pin={pin} size={108} />
              </div>
              <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#9fb89f]">
                <Smartphone className="h-3.5 w-3.5 text-[#d4a63a]" />
                {isAr ? "امسح للانضمام" : "Scan to join"}
              </span>
              <div className="mt-5 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition-transform active:scale-[0.98]"
                  style={{ borderColor: P.border, background: "rgba(2,20,12,0.55)", color: P.muted }}
                >
                  {linkCopied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4 text-[#d4a63a]" />}
                  {linkCopied ? (isAr ? "تم النسخ!" : "Copied!") : isAr ? "نسخ الرابط" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition-transform active:scale-[0.98]"
                  style={{
                    borderColor: "rgba(212,166,58,0.45)",
                    background: "rgba(212,166,58,0.12)",
                    color: P.goldLight,
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  {isAr ? "مشاركة" : "Share"}
                </button>
              </div>
            </div>
          </motion.section>

          {/* حالة اللاعبين (mobile) */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="rounded-2xl border px-4 py-4 lg:hidden"
            style={{
              borderColor: P.border,
              background: `linear-gradient(90deg, ${P.card} 0%, ${P.cardDeep} 100%)`,
              boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
            }}
          >
            <motion.div className="flex items-stretch justify-between gap-3">
              <div className="min-w-0 flex-1 text-center">
                <p className="text-2xl font-black tabular-nums text-[#f4c95d]">{players.length}</p>
                <p className="mt-0.5 text-sm font-bold text-[#9fb89f]">{isAr ? "لاعبون" : "Players"}</p>
              </div>
              <motion.div className="w-px shrink-0 bg-[rgba(212,166,58,0.2)]" aria-hidden />
              <div className="min-w-0 flex-1 text-center">
                <p className="text-2xl font-black tabular-nums text-white">{MAX_LOBBY_PLAYERS}</p>
                <p className="mt-0.5 text-sm font-bold text-[#9fb89f]">{isAr ? "الحد الأقصى" : "Max"}</p>
              </div>
              <motion.div className="w-px shrink-0 bg-[rgba(212,166,58,0.2)]" aria-hidden />
              <div className="min-w-0 flex-1 text-center">
                <p className="text-sm font-black leading-snug text-[#f4c95d]">{roomStatusLabel}</p>
                <p className="mt-0.5 text-sm font-bold text-[#9fb89f]">{isAr ? "حالة الغرفة" : "Room status"}</p>
              </div>
            </motion.div>
          </motion.section>

          {/* ── Hero (desktop) ── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative hidden overflow-hidden rounded-[28px] border lg:block"
            style={{
              borderColor: P.border,
              background: `linear-gradient(155deg, ${P.primary} 0%, #062a18 42%, ${P.cardDeep} 100%)`,
              boxShadow: "0 16px 56px rgba(0,0,0,0.45), 0 0 60px rgba(212,166,58,0.06), inset 0 1px 0 rgba(244,201,93,0.1)",
            }}
          >
            <HeroGoldLines />
            <GoldDust />
            <div
              className="pointer-events-none absolute -end-24 -top-24 h-64 w-64 rounded-full opacity-30"
              style={{ background: "radial-gradient(circle, rgba(212,166,58,0.15) 0%, transparent 70%)" }}
            />
            <motion.div
              className="pointer-events-none absolute -start-16 bottom-0 h-48 w-48 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, rgba(10,77,38,0.8) 0%, transparent 70%)" }}
            />

            <div
              dir="ltr"
              className="relative z-10 grid grid-cols-1 items-center gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(140px,auto)_1fr_minmax(160px,auto)] lg:gap-10 lg:p-10"
            >
              {/* QR يسار */}
              <div className="flex flex-col items-center gap-3 lg:items-start">
                <div
                  className="rounded-2xl bg-white p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35),0_0_24px_rgba(212,166,58,0.12)]"
                  style={{ border: "1px solid rgba(212,166,58,0.15)" }}
                >
                  <GameQRCode url={joinUrl} pin={pin} size={120} />
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#9fb89f]">
                  <Smartphone className="h-3.5 w-3.5 text-[#d4a63a]" />
                  {isAr ? "امسح للانضمام" : "Scan to join"}
                </span>
              </div>

              {/* كود — وسط */}
              <div className="flex flex-col items-center gap-4 text-center" dir={dir}>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#9fb89f]">
                  {isAr ? "كود اللعبة" : "Game code"}
                </p>
                <motion.div className="flex items-center gap-3" dir="ltr">
                  <button
                    type="button"
                    onClick={onCopyPin}
                    className="rounded-xl border border-[rgba(212,166,58,0.35)] bg-[rgba(212,166,58,0.1)] p-2.5 transition-all hover:bg-[rgba(212,166,58,0.2)] hover:shadow-[0_0_20px_rgba(212,166,58,0.2)]"
                  >
                    {copied ? (
                      <CheckCircle className="h-5 w-5 text-[#f4c95d]" />
                    ) : (
                      <Copy className="h-5 w-5 text-[#d4a63a]" />
                    )}
                  </button>
                  <span
                    className="select-all font-black tabular-nums text-[#f4c95d]"
                    style={{
                      fontSize: "clamp(2.75rem, 10vw, 4.5rem)",
                      letterSpacing: "0.22em",
                      lineHeight: 1,
                      textShadow: "0 0 40px rgba(244,201,93,0.35), 0 2px 0 rgba(0,0,0,0.3)",
                    }}
                  >
                    {pin}
                  </span>
                </motion.div>
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold transition-all hover:shadow-[0_0_20px_rgba(212,166,58,0.15)]"
                  style={{
                    borderColor: P.border,
                    background: "rgba(2,20,12,0.5)",
                    color: P.muted,
                  }}
                >
                  {linkCopied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5 text-[#d4a63a]" />}
                  {linkCopied ? (isAr ? "تم النسخ!" : "Copied!") : isAr ? "نسخ رابط الانضمام" : "Copy join link"}
                </button>
              </div>

              {/* لاعبون — يمين */}
              <div
                className="flex flex-col items-center gap-4 rounded-2xl border p-5 lg:items-end lg:p-6"
                dir={dir}
                style={{
                  borderColor: "rgba(212,166,58,0.15)",
                  background: "rgba(2,20,12,0.45)",
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: "rgba(212,166,58,0.35)",
                    background: "linear-gradient(180deg, #0a4d26 0%, #02140c 100%)",
                    boxShadow: "0 0 40px rgba(212,166,58,0.15), inset 0 1px 0 rgba(244,201,93,0.1)",
                  }}
                >
                  <Users className="h-10 w-10 text-[#d4a63a]" strokeWidth={1.75} />
                </motion.div>
                <motion.div className="text-center lg:text-end">
                  <p
                    className="font-black tabular-nums text-[#f4c95d]"
                    style={{ fontSize: "2.5rem", lineHeight: 1, textShadow: "0 0 24px rgba(244,201,93,0.25)" }}
                  >
                    {players.length}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#9fb89f]">{isAr ? "لاعب متصل" : "player(s) joined"}</p>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* ── شريط الصف المستهدف ── */}
          <motion.section
            id="target-class-bar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative overflow-visible rounded-[20px] border px-4 py-4 sm:rounded-[22px] sm:px-6 sm:py-5"
            style={{
              borderColor: "rgba(212,166,58,0.32)",
              background: `linear-gradient(90deg, ${P.card} 0%, #062818 50%, ${P.cardDeep} 100%)`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 28px rgba(212,166,58,0.06), inset 0 1px 0 rgba(244,201,93,0.06)",
              minHeight: 88,
            }}
          >
            <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-center lg:gap-6">
              <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 sm:h-16 sm:w-16"
                  style={{
                    borderColor: "rgba(212,166,58,0.4)",
                    background: "linear-gradient(145deg, #0a4d26, #021408)",
                    boxShadow: "0 0 28px rgba(212,166,58,0.12)",
                  }}
                >
                  <GraduationCap className="h-8 w-8 text-[#f4c95d]" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-white sm:text-lg">{isAr ? "الصف المستهدف" : "Target class"}</h2>
                  <p className="mt-0.5 text-sm leading-relaxed text-[#9fb89f] sm:text-xs">
                    {isAr ? "اختر الصف المناسب لضبط مستوى التجربة والأسئلة" : "Pick a class to tune difficulty and questions"}
                  </p>
                </div>
              </div>

              <div className="relative z-[60] flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-center">
                <div className="w-full min-w-0 flex-1 overflow-visible sm:min-w-[200px] sm:max-w-md">
                  <ClassSelector
                    value={targetClass}
                    onChange={onUpdateTargetClass}
                    accent={P.gold}
                    label=""
                    portaled
                    className="[&_label]:hidden"
                  />
                </div>
                <span
                  className="w-fit shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-black"
                  style={{ borderColor: P.border, color: P.gold, background: "rgba(212,166,58,0.08)" }}
                >
                  {isAr ? "اختياري" : "Optional"}
                </span>
              </div>

              <div className="hidden shrink-0 items-start gap-2 lg:flex lg:max-w-[220px]">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d4a63a]/70" />
                <p className="text-[11px] leading-relaxed text-[#9fb89f]">
                  {isAr
                    ? "اختيار الصف يساعد على ضبط صعوبة اللعبة واحتساب النتائج"
                    : "Class selection helps tune difficulty and score tracking"}
                </p>
              </div>
            </div>
          </motion.section>

          {/* ── إعدادات اللعبة ── */}
          <section id="game-settings">
            <div className="mb-4 flex items-center gap-2.5">
              <Settings className="h-5 w-5 text-[#d4a63a]" />
              <h2 className="text-base font-black text-white lg:text-lg">{isAr ? "إعدادات اللعبة" : "Game settings"}</h2>
            </div>

            <div className="-mx-1 overflow-x-auto overflow-y-visible pb-2 xl:mx-0">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:flex xl:min-w-max xl:flex-nowrap xl:gap-4">
              <SettingCard
                className={SETTING_CARD_DESKTOP}
                delay={0.04}
                icon={
                  currentGameMode === "teams" ? (
                    <UsersRound className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />
                  ) : (
                    <User className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />
                  )
                }
                title={isAr ? "وضع اللعبة" : "Game mode"}
                desc={isAr ? "تنافس فردي أو جماعي بالفرق" : "Solo or team competition"}
              >
                <span
                  className="rounded-full border px-4 py-2 text-xs font-black"
                  style={{ borderColor: P.border, color: P.goldLight, background: "rgba(10,77,38,0.5)" }}
                >
                  {currentGameMode === "teams"
                    ? isAr
                      ? t.teacherGame.teamMode || "فرق"
                      : "Teams"
                    : isAr
                      ? t.teacherGame.soloMode || "فردي"
                      : "Solo"}
                </span>
              </SettingCard>

              <SettingCard
                className={SETTING_CARD_DESKTOP}
                delay={0.06}
                icon={<SkipForward className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />}
                title={isAr ? "التنقل بين الأسئلة" : "Question navigation"}
                desc={isAr ? "انتقال تلقائي أو يدوي بين الأسئلة" : "Auto or manual advance"}
              >
                <SegmentedGold
                  isAr={isAr}
                  value={autoAdvance}
                  onChange={onSetAutoAdvance}
                  options={[
                    { val: true, ar: "تلقائي", en: "Auto" },
                    { val: false, ar: "يدوي", en: "Manual" },
                  ]}
                />
              </SettingCard>

              <SettingCard
                className={SETTING_CARD_DESKTOP}
                delay={0.08}
                icon={<Gift className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />}
                title={isAr ? "الهدايا" : "Gifts"}
                desc={isAr ? "هدية لكل ٣ إجابات صحيحة متتالية" : "Gift every 3 correct answers"}
              >
                <GoldToggle on={giftsEnabled} onClick={onToggleGifts} disabled={hackMode} dir={dir} large />
              </SettingCard>

              {/* لعبة الاختراق — مميزة */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  SETTING_CARD_DESKTOP,
                  "flex min-h-[188px] flex-col rounded-[20px] border-2 p-4 backdrop-blur-sm sm:min-h-[200px] sm:rounded-[22px] sm:p-5",
                  "lg:hover:-translate-y-1 lg:transition-transform",
                  hackMode
                    ? "border-[#3dff8a]/65 bg-gradient-to-b from-[#021a10] to-[#010805]"
                    : "border-[rgba(61,255,138,0.3)] bg-gradient-to-b from-[#031510] to-[#021408]",
                )}
                style={{
                  boxShadow: hackMode
                    ? "0 0 40px rgba(61,255,138,0.2), inset 0 0 28px rgba(61,255,138,0.06)"
                    : "0 0 20px rgba(61,255,138,0.08), 0 8px 28px rgba(0,0,0,0.35)",
                }}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full border-2 sm:h-14 sm:w-14",
                    hackMode && "shadow-[0_0_24px_rgba(61,255,138,0.35)]",
                  )}
                  style={{
                    borderColor: hackMode ? "rgba(61,255,138,0.65)" : "rgba(61,255,138,0.28)",
                    background: hackMode
                      ? "linear-gradient(145deg, rgba(61,255,138,0.15), rgba(0,0,0,0.5))"
                      : "rgba(0,0,0,0.4)",
                  }}
                >
                  {hackMode ? (
                    <Terminal className="h-7 w-7 text-[#3dff8a]" strokeWidth={2} />
                  ) : (
                    <LockKeyhole className="h-6 w-6 text-[#3dff8a]/75" strokeWidth={2} />
                  )}
                </div>
                <h3 className="mt-3 text-sm font-black text-white sm:mt-4 sm:text-[15px]">{isAr ? "لعبة الاختراق" : "Hack game"}</h3>
                {!hackMode ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#9fb89f] sm:text-xs">
                    {isAr ? "كلمات سر وصناديق غامضة" : "Passwords & mystery boxes"}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-end pt-4">
                  <GoldToggle on={hackMode} onClick={onToggleHackMode} dir={dir} large />
                </div>
              </motion.div>

              <SettingCard
                className={SETTING_CARD_DESKTOP}
                delay={0.12}
                icon={<Mic className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />}
                title={isAr ? "قراءة صوتية" : "Voice reading"}
                desc={isAr ? "قراءة نص السؤال بصوت واضح" : "Read question text aloud"}
              >
                <GoldToggle on={ttsEnabled} onClick={onToggleTts} dir={dir} large />
              </SettingCard>

              <SettingCard
                className={SETTING_CARD_DESKTOP}
                delay={0.16}
                icon={
                  roomLocked ? (
                    <Lock className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />
                  ) : (
                    <Unlock className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />
                  )
                }
                title={isAr ? "قفل الغرفة" : "Lock room"}
                desc={isAr ? "منع انضمام طلاب جدد للغرفة" : "Block new players from joining"}
              >
                <GoldToggle on={roomLocked} onClick={onToggleRoomLock} dir={dir} large />
              </SettingCard>

              <SettingCard
                className={SETTING_CARD_DESKTOP}
                delay={0.18}
                icon={<Bot className="h-6 w-6 text-[#f4c95d]" strokeWidth={2} />}
                title={isAr ? "لاعبون وهميون" : "Bot players"}
                desc={isAr ? "للتجربة والاختبار السريع" : "For quick testing"}
              >
                <motion.div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSetBotCount((c) => Math.max(0, c - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold"
                    style={{ borderColor: P.border, color: P.text }}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-black text-[#f4c95d]">{botCount}</span>
                  <button
                    type="button"
                    onClick={() => onSetBotCount((c) => Math.min(10, c + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold"
                    style={{ borderColor: P.border, color: P.text }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={onAddBots}
                    disabled={isAddingBots || botCount === 0}
                    className="rounded-xl px-3 py-2 text-[11px] font-black disabled:opacity-40"
                    style={{ background: P.primary, color: P.goldLight }}
                  >
                    {isAddingBots ? "…" : isAr ? "إضافة" : "Add"}
                  </button>
                </motion.div>
              </SettingCard>
            </div>
            </div>
          </section>

          {/* لوحة ماراثون الاختراق */}
          {hackMode && (
            <motion.section
              ref={hackPanelRef}
              id="hack-settings-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[22px] border-2 border-[#3dff8a]/30 p-5 sm:p-6"
              style={{
                background: "linear-gradient(180deg, #031a0f 0%, #02140c 100%)",
                boxShadow: "0 0 40px rgba(61,255,138,0.08)",
              }}
            >
              <p className="mb-4 flex items-center gap-2 text-sm font-black text-[#3dff8a]">
                <Terminal className="h-4 w-4" />
                {isAr ? "إعدادات ماراثون الاختراق" : "Hack marathon settings"}
              </p>
              <div className="mb-5 flex flex-wrap gap-2">
                {[5, 7, 10, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onSetHackDurationMin(m);
                      onSetHackCustomMin("");
                    }}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm font-bold transition-all",
                      !hackCustomMin && hackDurationMin === m
                        ? "border-[#3dff8a] bg-[#3dff8a] text-[#031b11]"
                        : "border-[#3dff8a]/25 text-[#9fb89f] hover:border-[#3dff8a]/50",
                    )}
                  >
                    {m} {isAr ? "دقيقة" : "min"}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={hackCustomMin}
                  onChange={(e) => onSetHackCustomMin(e.target.value)}
                  placeholder={isAr ? "مخصص" : "Custom"}
                  className="w-24 rounded-xl border border-[#3dff8a]/25 bg-[#02140c] px-3 py-2.5 text-sm text-white focus:border-[#3dff8a]/50 focus:outline-none"
                />
              </div>
              <motion.div className="border-t border-[#3dff8a]/20 pt-4">
                <p className="mb-2 text-xs font-bold text-[#9fb89f]">{isAr ? "بث رسالة للطلاب" : "Broadcast to students"}</p>
                <div className="flex gap-2">
                  <input
                    value={broadcastMessage}
                    onChange={(e) => onBroadcastMessageChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSendBroadcast()}
                    placeholder={isAr ? "تلميح أو رسالة…" : "Hint or message…"}
                    className="min-w-0 flex-1 rounded-xl border border-[#3dff8a]/20 bg-[#02140c] px-3 py-2.5 text-sm text-white placeholder:text-[#9fb89f]/50 focus:border-[#3dff8a]/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={onSendBroadcast}
                    disabled={!broadcastMessage.trim()}
                    className="shrink-0 rounded-xl bg-[#3dff8a] px-5 py-2.5 text-sm font-black text-[#031b11] disabled:opacity-40"
                  >
                    {broadcastSent ? (isAr ? "✓ أُرسل" : "✓ Sent") : isAr ? "بث" : "Send"}
                  </button>
                </div>
                {sentMessages.length > 0 && (
                  <motion.div className="mt-3 max-h-36 space-y-1 overflow-y-auto">
                    <motion.div className="mb-1 flex justify-between">
                      <span className="text-[10px] text-[#9fb89f]">{isAr ? "سجل الرسائل" : "Log"}</span>
                      <button type="button" onClick={onClearSentMessages} className="text-[10px] text-rose-400">
                        {isAr ? "مسح" : "Clear"}
                      </button>
                    </motion.div>
                    {sentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="flex gap-2 rounded-lg border border-[#3dff8a]/15 bg-[#02140c]/80 px-2 py-1.5 text-xs"
                      >
                        <span className="shrink-0 font-mono text-[#9fb89f]/60">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="flex-1 break-all text-white/90">{msg.text}</span>
                        <button type="button" onClick={() => onRemoveSentMessage(msg.id)} className="text-rose-400">
                          ×
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
              {players.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#3dff8a]/20 pt-4">
                  {players.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => onKickPlayer(p.name)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold",
                        p.hasPassword ? "border-[#3dff8a]/50 text-[#3dff8a]" : "border-[#3dff8a]/20 text-[#9fb89f]",
                      )}
                    >
                      <AvatarDisplay avatar={p.avatar} size="md" fallback="🧑" />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {/* ── منطقة اللاعبين ── */}
          {!hackMode && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="relative overflow-hidden rounded-[24px] border p-6 sm:rounded-[28px] sm:p-10"
              style={{
                borderColor: P.border,
                background: `linear-gradient(145deg, #021408 0%, ${P.card} 38%, #031510 100%)`,
                boxShadow: "0 16px 56px rgba(0,0,0,0.5), inset 0 1px 0 rgba(244,201,93,0.06), 0 0 40px rgba(212,166,58,0.04)",
                minHeight: 300,
              }}
            >
              <PlayersZoneDecor />
              <div className="relative z-10 flex min-h-[280px] flex-col">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-white sm:text-xl">{isAr ? "منطقة اللاعبين" : "Players zone"}</h2>
                  <span
                    className="rounded-xl border px-4 py-2 text-xs font-black sm:text-sm"
                    style={{
                      borderColor: P.border,
                      color: P.goldLight,
                      background: "rgba(3,27,17,0.8)",
                      boxShadow: "0 0 20px rgba(212,166,58,0.08)",
                    }}
                  >
                    {players.length} / {MAX_LOBBY_PLAYERS} {isAr ? "لاعب حاضر" : "players present"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-center">
                {players.length === 0 ? (
                  <div className="flex flex-col items-center py-4 sm:py-10">
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="relative mb-6 flex h-36 w-36 items-center justify-center sm:h-28 sm:w-28"
                    >
                      <motion.span
                        className="absolute inset-0 rounded-full border-2 border-dashed"
                        style={{ borderColor: "rgba(212,166,58,0.35)" }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                      />
                      <div
                        className="flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-full sm:h-24 sm:w-24"
                        style={{
                          background: "linear-gradient(180deg, #062415 0%, #021408 100%)",
                          boxShadow: "0 0 56px rgba(212,166,58,0.15), inset 0 1px 0 rgba(244,201,93,0.12)",
                          border: "2px solid rgba(212,166,58,0.28)",
                        }}
                      >
                        <Users className="h-14 w-14 text-[#f4c95d]/95 sm:h-12 sm:w-12" strokeWidth={1.5} />
                      </div>
                    </motion.div>
                    <p className="text-center text-xl font-black text-white sm:text-2xl">
                      {isAr ? "بانتظار انضمام اللاعبين..." : "Waiting for players to join…"}
                    </p>
                    <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-[#9fb89f]">
                      {isAr ? "شارك كود اللعبة أو امسح رمز QR للانضمام" : "Share the game code or scan the QR code to join"}
                    </p>
                  </div>
                ) : currentGameMode === "teams" && teamNames.length > 0 ? (
                  <div className="space-y-4">
                    {teamNames.map((teamName) => {
                      const teamPlayers = players.filter((p) => p.teamName === teamName);
                      const isLocked = lockedTeams.includes(teamName);
                      return (
                        <div
                          key={teamName}
                          className="rounded-2xl border p-4"
                          style={{ borderColor: "rgba(212,166,58,0.15)", background: "rgba(2,20,12,0.5)" }}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span
                              className="rounded-full px-3 py-1 text-xs font-black"
                              style={{ background: P.primary, color: P.goldLight }}
                            >
                              {teamName} · {teamPlayers.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => onToggleTeamLock(teamName)}
                              className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                              style={{ borderColor: P.border, color: P.muted }}
                            >
                              {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                              {isLocked ? (isAr ? "مقفل" : "Locked") : isAr ? "مفتوح" : "Open"}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {teamPlayers.map((p) => (
                              <PlayerChip
                                key={p.name}
                                player={p}
                                isAr={isAr}
                                teamNames={teamNames}
                                onKick={() => onKickPlayer(p.name)}
                                onMove={(tn) => onMovePlayer(p.name, tn)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
                    <AnimatePresence>
                      {players.map((p, i) => (
                        <motion.div
                          key={p.name}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <PlayerChip player={p} isAr={isAr} onKick={() => onKickPlayer(p.name)} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {humanCount > 0 && players.length > 0 && (
                  <p className="mt-6 text-center text-xs font-bold text-[#9fb89f]">
                    {isAr ? `${humanCount} لاعب بشري جاهز للبدء` : `${humanCount} human player(s) ready`}
                  </p>
                )}
                </div>

                <div className="mt-6 h-3 overflow-hidden rounded-full border border-[rgba(212,166,58,0.15)] bg-[#010a06] sm:mt-8 sm:h-3.5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, #0a4d26, ${P.goldLight}, ${P.gold})`,
                      boxShadow: "0 0 16px rgba(212,166,58,0.45)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(playerProgressPct, players.length === 0 ? 3 : 10)}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.section>
          )}
        </main>

        {/* زر ابدأ اللعبة — sticky (mobile / tablet) */}
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 border-t px-4 pt-3 backdrop-blur-xl lg:hidden"
          style={{
            borderColor: P.border,
            background: "rgba(3,27,17,0.94)",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          <motion.button
            type="button"
            onClick={onStartGame}
            disabled={players.length === 0}
            whileTap={players.length > 0 ? { scale: 0.98 } : undefined}
            className={cn(
              "flex w-full min-h-[56px] items-center justify-center gap-3 rounded-[20px] text-lg font-black transition-opacity",
              "disabled:cursor-not-allowed disabled:opacity-45",
            )}
            style={{
              background: `linear-gradient(135deg, ${P.goldLight} 0%, ${P.gold} 55%, #b8892a 100%)`,
              color: "#031b11",
              boxShadow: players.length > 0 ? "0 6px 32px rgba(212,166,58,0.45), inset 0 1px 0 rgba(255,255,255,0.28)" : undefined,
            }}
          >
            <Play className="h-6 w-6 fill-current" />
            {isAr ? "ابدأ اللعبة" : "Start game"}
          </motion.button>
        </motion.div>
      </motion.div>
    </Layout>
  );
}

function PlayerChip({
  player: p,
  isAr,
  teamNames,
  onKick,
  onMove,
}: {
  player: LobbyPlayer;
  isAr: boolean;
  teamNames?: string[];
  onKick: () => void;
  onMove?: (teamName: string) => void;
}) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onKick}
      onKeyDown={(e) => e.key === "Enter" && onKick()}
      whileHover={{ scale: 1.02 }}
      className="group flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors hover:border-[rgba(212,166,58,0.35)]"
      style={{
        borderColor: "rgba(212,166,58,0.18)",
        background: "rgba(2,20,12,0.7)",
      }}
    >
      <AvatarDisplay avatar={p.avatar} size="lg" fallback="🧑" />
      <span className="text-sm font-bold text-white">{p.name}</span>
      {p.isBot && (
        <span className="rounded-full bg-[rgba(212,166,58,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#9fb89f]">🤖</span>
      )}
      {p.teamName && !onMove && (
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: P.primary, color: P.goldLight }}>
          {p.teamName}
        </span>
      )}
      {onMove && teamNames && (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <select
            value={p.teamName || ""}
            onChange={(e) => {
              const target = e.target.value;
              if (target && target !== p.teamName) onMove(target);
            }}
            className="appearance-none rounded-lg border py-1 pe-7 ps-2 text-[11px] font-bold text-white"
            style={{ borderColor: "rgba(212,166,58,0.2)", background: P.cardDeep }}
          >
            {teamNames.map((tn) => (
              <option key={tn} value={tn}>
                {tn}
              </option>
            ))}
          </select>
          <ArrowRightLeft className="pointer-events-none absolute end-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#9fb89f]" />
        </div>
      )}
      <Ban className="h-3.5 w-3.5 text-rose-400/80 opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.div>
  );
}
