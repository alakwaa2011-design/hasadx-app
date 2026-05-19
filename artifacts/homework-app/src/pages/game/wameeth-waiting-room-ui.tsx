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
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Palette (cinematic reference) ── */
const P = {
  bg: "#010c08",
  bgMid: "#021410",
  primary: "#0a4d26",
  card: "#041a0e",
  cardAlt: "#062415",
  cardDeep: "#010805",
  gold: "#d4a63a",
  goldLight: "#f4c95d",
  goldBright: "#ffe08a",
  text: "#ffffff",
  muted: "#a8c4ad",
  mutedDim: "#7a9a82",
  border: "rgba(212,166,58,0.25)",
  neon: "#3dff8a",
  neonDim: "rgba(61,255,138,0.4)",
} as const;

const PAGE_BG =
  "radial-gradient(ellipse 80% 50% at 50% -8%, rgba(10,58,34,0.32) 0%, transparent 48%), radial-gradient(ellipse 120% 90% at 50% 50%, transparent 18%, rgba(0,0,0,0.9) 100%), linear-gradient(180deg, #000503 0%, #010907 38%, #02140c 100%)";

const HERO_CTA_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, #ffe08a 0%, #f4c95d 16%, #d4a63a 48%, #9a7020 100%)",
  color: "#1a1008",
  border: "2px solid #1a1208",
  boxShadow:
    "0 0 28px rgba(244,201,93,0.5), 0 0 56px rgba(212,166,58,0.22), 0 12px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -4px 10px rgba(0,0,0,0.32), inset 0 0 28px rgba(255,224,138,0.28)",
};

const NOISE_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

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
        "mx-auto flex h-[46px] w-[46px] items-center justify-center rounded-full border lg:h-[50px] lg:w-[50px]",
        "border-[rgba(212,166,58,0.32)] bg-gradient-to-b from-[#0d3d22] to-[#021408]",
        "shadow-[inset_0_1px_0_rgba(244,201,93,0.2),0_0_28px_rgba(212,166,58,0.14)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function HeroStartButton({
  onClick,
  disabled,
  isAr,
  className,
}: {
  onClick: () => void;
  disabled: boolean;
  isAr: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative inline-flex", className)}>
      {!disabled && (
        <span
          className="pointer-events-none absolute -inset-2 rounded-2xl opacity-70 blur-lg transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: "radial-gradient(ellipse 90% 70% at 50% 50%, rgba(244,201,93,0.45) 0%, rgba(212,166,58,0.12) 55%, transparent 75%)",
          }}
          aria-hidden
        />
      )}
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.05, y: -1 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={cn(
          "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-black sm:px-7 sm:py-3 sm:text-[15px]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          !disabled &&
            "hover:shadow-[0_0_44px_rgba(244,201,93,0.62),0_0_72px_rgba(212,166,58,0.28),0_14px_40px_rgba(0,0,0,0.5)]",
        )}
        style={disabled ? { ...HERO_CTA_STYLE, opacity: 0.45 } : HERO_CTA_STYLE}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-xl opacity-55"
          style={{ background: "radial-gradient(ellipse 85% 55% at 50% 15%, rgba(255,255,255,0.5) 0%, transparent 62%)" }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-[2px] rounded-[10px] opacity-40"
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(255,224,138,0.35) 0%, transparent 70%)" }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: "linear-gradient(105deg, transparent 26%, rgba(255,255,255,0.55) 50%, transparent 74%)" }}
          aria-hidden
        />
        <Play className="relative h-4 w-4 fill-current sm:h-5 sm:w-5" />
        <span className="relative">{isAr ? "ابدأ اللعبة" : "Start game"}</span>
      </motion.button>
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
        "flex min-h-[160px] flex-1 flex-col items-center rounded-[20px] border p-4 text-center backdrop-blur-sm sm:min-h-[172px]",
        "lg:min-h-[178px] lg:rounded-[22px] lg:p-5 lg:transition-transform lg:hover:-translate-y-0.5",
        "lg:hover:shadow-[0_16px_48px_rgba(0,0,0,0.45),0_0_32px_rgba(212,166,58,0.1)]",
        "overflow-visible border-[rgba(212,166,58,0.28)] bg-gradient-to-b from-[#062415] via-[#041a0e] to-[#010805]",
        "transition-[border-color,box-shadow] duration-300 lg:hover:border-[rgba(212,166,58,0.42)]",
        className,
      )}
    >
      <motion.div className="flex w-full flex-1 flex-col items-center justify-between">
        <motion.div className="flex w-full flex-col items-center">
        <IconCircle>{icon}</IconCircle>
        <h3 className="mt-3.5 text-sm font-black tracking-tight text-white sm:text-[15px]">{title}</h3>
        {desc ? (
          <p className="mt-2 max-w-[92%] text-[11px] leading-relaxed text-[#bdd4c4] sm:text-xs">{desc}</p>
        ) : (
          <motion.div className="mt-2 h-3" aria-hidden />
        )}
        </motion.div>
        <motion.div className="mt-4 flex w-full items-center justify-center pb-0.5 pt-1">{children}</motion.div>
      </motion.div>
    </motion.div>
  );
}

function GoldDust({ dense }: { dense?: boolean }) {
  const pts = dense
    ? [
        { t: "6%", l: "4%", d: 0, s: 2.5, blur: 4 },
        { t: "14%", r: "6%", d: 0.4, s: 1.5, blur: 2 },
        { t: "72%", l: "10%", d: 0.6, s: 2, blur: 3 },
        { t: "88%", r: "8%", d: 1, s: 3, blur: 5 },
        { t: "38%", l: "42%", d: 0.8, s: 1, blur: 2 },
        { t: "52%", r: "38%", d: 1.2, s: 2.5, blur: 4 },
        { t: "28%", l: "78%", d: 0.2, s: 1.5, blur: 3 },
        { t: "92%", l: "62%", d: 1.5, s: 2, blur: 3 },
        { t: "48%", l: "18%", d: 0.9, s: 1, blur: 2 },
        { t: "18%", l: "28%", d: 1.1, s: 2, blur: 4 },
        { t: "78%", r: "22%", d: 0.5, s: 1.5, blur: 2 },
      ]
    : [
        { t: "10%", l: "8%", d: 0, s: 2, blur: 3 },
        { t: "75%", r: "10%", d: 0.5, s: 1.5, blur: 2 },
        { t: "45%", l: "55%", d: 0.8, s: 1, blur: 2 },
        { t: "85%", r: "35%", d: 1.2, s: 2, blur: 3 },
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
            filter: `blur(${p.blur}px)`,
            boxShadow: "0 0 6px rgba(244,201,93,0.5)",
          }}
          animate={{ opacity: [0.06, 0.45, 0.06], scale: [1, 1.2, 1] }}
          transition={{ duration: 3.5 + i * 0.25, repeat: Infinity, delay: p.d, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

function CinematicArcs({ id, strong }: { id: string; strong?: boolean }) {
  const op = strong ? [0.48, 0.4, 0.44] : [0.38, 0.32, 0.36];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}-arc`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d4a63a" stopOpacity="0" />
          <stop offset="45%" stopColor="#f4c95d" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#d4a63a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-40 90 Q 220 20 480 110" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="1" opacity={op[0]} />
      <path d="M 40 300 Q 320 230 600 290" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="0.85" opacity={op[1]} />
      <path d="M 720 40 Q 980 120 1240 60" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="0.9" opacity={op[2]} />
      {strong && (
        <path d="M 900 280 Q 1100 200 1280 260" fill="none" stroke={`url(#${id}-arc)`} strokeWidth="0.7" opacity="0.3" />
      )}
    </svg>
  );
}

function GlobalAmbientMotion() {
  const floats = [
    { t: "12%", l: "8%", d: 0, s: 1.5 },
    { t: "68%", l: "15%", d: 1.2, s: 1 },
    { t: "42%", r: "10%", d: 0.6, s: 1.2 },
    { t: "82%", r: "18%", d: 1.8, s: 0.8 },
    { t: "28%", l: "72%", d: 0.4, s: 1 },
    { t: "55%", l: "88%", d: 1.4, s: 1.3 },
  ];
  const stars = [
    { t: "8%", l: "22%", s: 10, d: 0 },
    { t: "22%", r: "28%", s: 8, d: 0.5 },
    { t: "75%", l: "35%", s: 9, d: 1 },
    { t: "88%", r: "12%", s: 7, d: 1.6 },
    { t: "48%", l: "5%", s: 8, d: 0.8 },
  ];
  return (
  <>
      {floats.map((p, i) => (
        <motion.span
          key={`f-${i}`}
          className="pointer-events-none absolute rounded-full bg-[#f4c95d]"
          style={{
            top: p.t,
            left: p.l,
            right: p.r,
            width: p.s,
            height: p.s,
            filter: "blur(2px)",
            opacity: 0.2,
          }}
          animate={{ y: [0, -12, 0], opacity: [0.08, 0.22, 0.08] }}
          transition={{ duration: 6 + i, repeat: Infinity, delay: p.d, ease: "easeInOut" }}
        />
      ))}
      {stars.map((s, i) => (
        <motion.svg
          key={`s-${i}`}
          viewBox="0 0 24 24"
          className="pointer-events-none absolute text-[#f4c95d]"
          style={{
            top: s.t,
            left: s.l,
            right: s.r,
            width: s.s,
            height: s.s,
            opacity: 0.35,
            filter: "drop-shadow(0 0 4px rgba(244,201,93,0.6))",
          }}
          animate={{ opacity: [0.15, 0.55, 0.15], scale: [0.9, 1.1, 0.9], rotate: [0, 8, 0] }}
          transition={{ duration: 3 + i * 0.35, repeat: Infinity, delay: s.d }}
          aria-hidden
        >
          <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </motion.svg>
      ))}
    </>
  );
}

function HeroLightRays() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-[140%] w-24 -translate-x-1/2 -translate-y-1/2 origin-center"
          style={{
            background: `linear-gradient(180deg, transparent, rgba(244,201,93,${0.04 + i * 0.02}) 45%, transparent)`,
            transform: `translate(-50%, -50%) rotate(${-18 + i * 18}deg)`,
            filter: "blur(8px)",
          }}
          animate={{ opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.7, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function GameCodeGlow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <motion.div
        className="pointer-events-none absolute -inset-x-12 -inset-y-8"
        style={{
          background:
            "radial-gradient(ellipse 75% 60% at 50% 50%, rgba(244,201,93,0.32) 0%, rgba(212,166,58,0.12) 38%, transparent 72%)",
        }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.03, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-x-6 -inset-y-3 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(255,224,138,0.18) 0%, transparent 68%)",
        }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function PersonSilhouette({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 72 160" className={className} style={style} aria-hidden>
      <ellipse cx="36" cy="24" rx="18" ry="20" fill="currentColor" />
      <path d="M10 52 Q36 42 62 52 L68 160 H4 Z" fill="currentColor" />
    </svg>
  );
}

type SparkleSpec = { top: string; left?: string; right?: string; size: number; delay: number; rotate?: number };

const SPARKLE_SETS: Record<"players" | "heroQr" | "heroPlayers", SparkleSpec[]> = {
  players: [
    { top: "12%", right: "8%", size: 14, delay: 0 },
    { top: "28%", right: "22%", size: 10, delay: 0.4, rotate: 15 },
    { top: "55%", right: "5%", size: 12, delay: 0.8 },
    { top: "18%", left: "12%", size: 11, delay: 0.2 },
    { top: "72%", left: "18%", size: 9, delay: 1.1 },
    { top: "42%", left: "6%", size: 13, delay: 0.6 },
  ],
  heroQr: [
    { top: "8%", left: "4%", size: 12, delay: 0 },
    { top: "22%", left: "18%", size: 9, delay: 0.5 },
    { top: "65%", left: "8%", size: 11, delay: 0.9 },
    { top: "15%", right: "12%", size: 10, delay: 0.3 },
  ],
  heroPlayers: [
    { top: "0%", right: "0%", size: 11, delay: 0.2 },
    { top: "18%", left: "0%", size: 9, delay: 0.7 },
    { top: "8%", left: "28%", size: 10, delay: 0.4 },
  ],
};

function SparkleStars({ variant }: { variant: keyof typeof SPARKLE_SETS }) {
  return (
    <>
      {SPARKLE_SETS[variant].map((s, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          className="pointer-events-none absolute text-[#f4c95d]"
          style={{
            top: s.top,
            left: s.left,
            right: s.right,
            width: s.size,
            height: s.size,
            filter: "drop-shadow(0 0 6px rgba(244,201,93,0.9)) drop-shadow(0 0 14px rgba(212,166,58,0.5))",
            rotate: s.rotate ?? 0,
          }}
          animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 2.2 + i * 0.2, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
          aria-hidden
        >
          <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
          <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
          <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.45" />
          <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.45" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </motion.svg>
      ))}
    </>
  );
}

function GatheredSilhouettes({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const figures = compact
    ? [
        { scale: 0.5, offset: -28, z: 1 },
        { scale: 0.56, offset: -8, z: 2 },
        { scale: 0.58, offset: 12, z: 3 },
        { scale: 0.52, offset: 32, z: 2 },
        { scale: 0.48, offset: 50, z: 1 },
      ]
    : [
        { scale: 0.82, offset: -52, z: 1 },
        { scale: 0.96, offset: -18, z: 2 },
        { scale: 1.04, offset: 18, z: 3 },
        { scale: 1, offset: 54, z: 2 },
        { scale: 0.9, offset: 88, z: 1 },
        { scale: 0.82, offset: 118, z: 1 },
      ];
  const h = compact ? 84 : 155;
  const w = compact ? 160 : 275;

  return (
    <div
      className={cn("pointer-events-none relative flex items-end justify-center", className)}
      style={{ width: w, height: h }}
      aria-hidden
    >
      {figures.map((f, i) => (
        <PersonSilhouette
          key={i}
          className="absolute bottom-0 text-[#010805]"
          style={{
            left: `calc(50% + ${f.offset}px)`,
            transform: "translateX(-50%)",
            height: `${160 * f.scale}px`,
            width: `${72 * f.scale}px`,
            opacity: compact ? 0.3 : 0.26,
            zIndex: f.z,
            marginLeft: i > 0 ? -12 : 0,
          }}
        />
      ))}
    </div>
  );
}

function PlayersZoneCenterGlow() {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[48%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-72 sm:w-72"
      style={{
        background:
          "radial-gradient(circle, rgba(244,201,93,0.14) 0%, rgba(212,166,58,0.05) 45%, transparent 70%)",
      }}
      animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.06, 1] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

function PlayersWaveLines() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-40" aria-hidden>
      <defs>
        <linearGradient id="wameeth-wave-gold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d4a63a" stopOpacity="0" />
          <stop offset="50%" stopColor="#f4c95d" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d4a63a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 48 Q 120 28 240 44 T 480 40 T 720 46 T 960 38 T 1200 42" fill="none" stroke="url(#wameeth-wave-gold)" strokeWidth="0.9" />
      <path d="M0 68 Q 160 52 320 64 T 640 58 T 960 66 T 1280 60" fill="none" stroke="url(#wameeth-wave-gold)" strokeWidth="0.65" opacity="0.7" />
    </svg>
  );
}

function PlayersProgressRing({ pct, size = 52 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(212,166,58,0.15)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#wameeth-ring-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ filter: "drop-shadow(0 0 6px rgba(244,201,93,0.45))" }}
      />
      <defs>
        <linearGradient id="wameeth-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d4a63a" />
          <stop offset="100%" stopColor="#ffe08a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PageAtmosphere() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: NOISE_TEXTURE, backgroundSize: "180px 180px" }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 100% 85% at 50% 50%, transparent 25%, rgba(0,0,0,0.75) 100%)",
        }}
        aria-hidden
      />
    </>
  );
}

function PlayersZoneDecor() {
  return (
    <>
      <CinematicArcs id="wameeth-zone" strong />
      <PlayersWaveLines />
      <GoldDust dense />
      <SparkleStars variant="players" />
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% 50%, transparent 35%, rgba(0,0,0,0.45) 100%), radial-gradient(ellipse 55% 45% at 50% 48%, rgba(212,166,58,0.08) 0%, transparent 68%)",
        }}
        aria-hidden
      />
      <PlayersZoneCenterGlow />
      <GatheredSilhouettes className="absolute bottom-2 end-0 z-[2] sm:bottom-4 sm:end-4 md:end-8" />
      <GatheredSilhouettes
        compact
        className="absolute bottom-6 end-[12%] z-[2] hidden scale-[1.15] opacity-100 sm:flex"
      />
    </>
  );
}

function HeroPlayersSideDecor() {
  return (
    <div className="pointer-events-none absolute -right-2 top-1/2 z-0 h-[148px] w-[88px] -translate-y-1/2 sm:-right-4" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 88 148">
        <defs>
          <linearGradient id="wameeth-hero-players-arc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4a63a" stopOpacity="0" />
            <stop offset="50%" stopColor="#f4c95d" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#d4a63a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 8 24 Q 52 8 78 48" fill="none" stroke="url(#wameeth-hero-players-arc)" strokeWidth="1" opacity="0.55" />
        <path d="M 12 92 Q 48 72 82 118" fill="none" stroke="url(#wameeth-hero-players-arc)" strokeWidth="0.85" opacity="0.4" />
        <circle cx="72" cy="36" r="1.5" fill="#f4c95d" opacity="0.65" />
        <circle cx="80" cy="78" r="1.2" fill="#f4c95d" opacity="0.5" />
        <circle cx="64" cy="112" r="1.4" fill="#d4a63a" opacity="0.55" />
      </svg>
      <GatheredSilhouettes compact className="absolute bottom-0 right-0 scale-[0.72] opacity-[0.38]" />
    </div>
  );
}

function ConnectedPlayersBadge({
  count,
  isAr,
}: {
  count: number;
  isAr: boolean;
}) {
  return (
    <div className="relative flex min-w-[120px] flex-col items-center px-3 py-2 text-center">
      <HeroPlayersSideDecor />
      <SparkleStars variant="heroPlayers" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex h-[72px] w-full items-end justify-center">
          <GatheredSilhouettes
            compact
            className="absolute bottom-0 left-1/2 z-0 -translate-x-1/2 scale-[0.62] opacity-[0.42]"
          />
          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(212,166,58,0.15)",
                "0 0 28px rgba(244,201,93,0.28)",
                "0 0 20px rgba(212,166,58,0.15)",
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full border-2"
            style={{
              borderColor: "rgba(212,166,58,0.5)",
              background: "radial-gradient(145deg, rgba(10,77,38,0.92) 0%, #021408 85%)",
            }}
          >
            <Users className="h-[26px] w-[26px] text-[#f4c95d]" strokeWidth={1.75} />
          </motion.div>
        </div>

        <p
          className="mt-3 font-black tabular-nums text-white"
          style={{
            fontSize: "clamp(2.25rem, 4vw, 2.75rem)",
            lineHeight: 1,
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          {count}
        </p>
        <p className="mt-1.5 text-sm font-bold text-white/95">{isAr ? "لاعب متصل" : "Connected"}</p>
      </div>
    </div>
  );
}

function BrandLogoBlock({ isAr }: { isAr: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-self-start gap-3">
      <div
        className="shrink-0 rounded-xl p-0.5"
        style={{
          background: "linear-gradient(145deg, rgba(244,201,93,0.35), rgba(212,166,58,0.08))",
          boxShadow: "0 0 20px rgba(212,166,58,0.15)",
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
          alt={isAr ? "حصاد" : "Hasad"}
          className="h-11 w-11 rounded-[10px] object-cover ring-1 ring-[rgba(212,166,58,0.35)]"
        />
      </div>
      <div className="hidden flex-col sm:flex">
        <span className="text-lg font-black leading-tight tracking-tight text-white">{isAr ? "حصاد" : "Hasad"}</span>
        <span className="text-[11px] font-bold tracking-[0.22em] text-[#f4c95d]/95">HASADX</span>
      </div>
    </div>
  );
}

function HeroAtmosphere() {
  return (
    <>
      <CinematicArcs id="wameeth-hero" strong />
      <HeroLightRays />
      <GoldDust dense />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 42% at 50% 40%, rgba(244,201,93,0.14) 0%, transparent 65%), radial-gradient(ellipse 95% 75% at 50% 50%, transparent 28%, rgba(0,0,0,0.58) 100%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(0,0,0,0.55) 0%, transparent 55%)",
        }}
        aria-hidden
      />
    </>
  );
}

function HackCyberTexture({ active }: { active?: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: active ? 0.09 : 0.045 }}
      aria-hidden
    >
      <defs>
        <pattern id="wameeth-cyber-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#3dff8a" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wameeth-cyber-grid)" />
    </svg>
  );
}

function HackSettingCard({
  hackMode,
  isAr,
  dir,
  onToggle,
  className,
}: {
  hackMode: boolean;
  isAr: boolean;
  dir: "rtl" | "ltr";
  onToggle: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={cn(
        SETTING_CARD_DESKTOP,
        "group relative flex min-h-[160px] flex-1 flex-col items-center justify-between overflow-hidden rounded-[20px] border-2 p-4 text-center sm:min-h-[172px] sm:rounded-[22px] lg:min-h-[178px] lg:p-5",
        "transition-[box-shadow,border-color] duration-300 lg:hover:-translate-y-0.5",
        hackMode ? "border-[#3dff8a]/85" : "border-[#3dff8a]/45",
        "bg-gradient-to-b from-[#000805] via-[#010a06] to-[#000503]",
        className,
      )}
      style={{
        boxShadow: hackMode
          ? "0 0 48px rgba(61,255,138,0.28), inset 0 0 36px rgba(61,255,138,0.08)"
          : "0 0 22px rgba(61,255,138,0.14), 0 8px 32px rgba(0,0,0,0.45)",
      }}
    >
      <HackCyberTexture active={hackMode} />
      <motion.span
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[2px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(61,255,138,0.85), transparent)",
        }}
        animate={{ y: ["-100%", "4200%"] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-[#3dff8a]"
            style={{
              top: `${14 + i * 18}%`,
              left: `${12 + i * 16}%`,
              width: i % 2 === 0 ? 2 : 1.5,
              height: i % 2 === 0 ? 2 : 1.5,
            }}
            animate={{ opacity: hackMode ? [0.1, 0.38, 0.1] : [0.05, 0.2, 0.05] }}
            transition={{ duration: 2.2 + i * 0.45, repeat: Infinity }}
          />
        ))}
      </div>
      <motion.div
        className={cn(
          "relative z-10 flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 lg:h-[50px] lg:w-[50px]",
          hackMode && "shadow-[0_0_32px_rgba(61,255,138,0.45)]",
        )}
        style={{
          borderColor: hackMode ? "rgba(61,255,138,0.75)" : "rgba(61,255,138,0.35)",
          background: hackMode
            ? "linear-gradient(145deg, rgba(61,255,138,0.2), rgba(0,0,0,0.65))"
            : "rgba(0,0,0,0.5)",
        }}
      >
        {hackMode ? (
          <Terminal className="h-7 w-7 text-[#3dff8a]" strokeWidth={2} />
        ) : (
          <LockKeyhole className="h-6 w-6 text-[#3dff8a]/80" strokeWidth={2} />
        )}
      </motion.div>
      <h3 className="relative z-10 mt-3.5 text-sm font-black text-white sm:text-[15px]">
        {isAr ? "لعبة الاختراق" : "Hack game"}
      </h3>
      {!hackMode ? (
        <p className="relative z-10 mt-2 max-w-[90%] text-[11px] leading-relaxed text-[#9ec4a8] sm:text-xs">
          {isAr ? "كلمات سر وصناديق غامضة" : "Passwords & mystery boxes"}
        </p>
      ) : (
        <div className="relative z-10 mt-2 h-3" aria-hidden />
      )}
      <div className="relative z-10 mt-4 flex w-full justify-center pb-0.5">
        <GoldToggle on={hackMode} onClick={onToggle} dir={dir} large />
      </div>
    </motion.div>
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
        className="relative min-h-screen text-white"
        dir={dir}
        style={{
          fontFamily: "'Cairo', 'Tajawal', sans-serif",
          background: PAGE_BG,
        }}
      >
        <motion.div
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 100% 80% at 50% 50%, transparent 22%, rgba(0,0,0,0.78) 100%)",
          }}
        />
        <PageAtmosphere />
        <GlobalAmbientMotion />
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
              <p className="text-[15px] font-black leading-tight text-[#f4c95d]">{isAr ? "غرفة الانتظار" : "Waiting Room"}</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-semibold text-[#a8c4ad]">
                <Zap className="h-3 w-3 text-[#d4a63a]" strokeWidth={2.5} />
                {isAr ? "وميض — لعبة المعرفة السريعة" : "Wameeth — fast knowledge"}
              </p>
            </div>
            <motion.div className="flex items-center gap-1.5">
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
            </motion.div>
          </motion.div>
        </header>

        {/* ── Header (desktop) ── */}
        <header
          className="sticky top-0 z-50 hidden border-b backdrop-blur-xl lg:block"
          style={{ borderColor: P.border, background: "rgba(1,12,8,0.92)" }}
        >
          <div className="mx-auto grid h-[72px] max-w-[1500px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 lg:px-10">
            <BrandLogoBlock isAr={isAr} />

            <div className="justify-self-center text-center">
              <p className="text-xl font-black tracking-tight text-[#f4c95d] lg:text-[22px]">
                {isAr ? "غرفة الانتظار" : "Waiting Room"}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#a8c4ad]">
                <Zap className="h-3.5 w-3.5 shrink-0 text-[#d4a63a]" strokeWidth={2.5} />
                {isAr ? "وميض — لعبة المعرفة السريعة" : "Wameeth — fast knowledge game"}
              </p>
            </div>

            <div className="flex shrink-0 items-center justify-self-end gap-2.5 sm:gap-3">
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
              <HeroStartButton
                onClick={onStartGame}
                disabled={players.length === 0}
                isAr={isAr}
              />
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-[1500px] space-y-4 px-4 py-5 pb-28 sm:space-y-5 sm:px-5 sm:py-6 lg:space-y-6 lg:px-10 lg:py-8 lg:pb-8">
          {/* ── Hero (mobile) ── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[24px] border lg:hidden"
            style={{
              borderColor: "rgba(212,166,58,0.32)",
              background: "linear-gradient(165deg, #031408 0%, #021a0e 35%, #010805 100%)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 64px rgba(212,166,58,0.1), inset 0 1px 0 rgba(244,201,93,0.1)",
            }}
          >
            <HeroAtmosphere />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-[min(100%,480px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(244,201,93,0.22) 0%, rgba(212,166,58,0.06) 45%, transparent 72%)" }}
              aria-hidden
            />
            <div className="relative z-10 flex flex-col items-center px-5 py-7 sm:py-8" dir={dir}>
              <p className="text-xs font-bold tracking-[0.2em] text-[#9fb89f]">{isAr ? "كود اللعبة" : "Game code"}</p>
              <GameCodeGlow className="mt-3 w-full">
                <span
                  className="block select-all text-center font-black tabular-nums text-[#f4c95d]"
                  dir="ltr"
                  style={{
                    fontSize: "clamp(3rem, 14vw, 4.25rem)",
                    letterSpacing: "0.2em",
                    lineHeight: 1,
                    textShadow: "0 0 56px rgba(244,201,93,0.5), 0 0 100px rgba(212,166,58,0.2), 0 2px 0 rgba(0,0,0,0.35)",
                  }}
                >
                  {pin}
                </span>
              </GameCodeGlow>
              <div className="relative mt-6 flex w-full max-w-[140px] flex-col items-center">
                <SparkleStars variant="heroQr" />
                <div
                  className="relative rounded-2xl bg-white p-3"
                  style={{
                    boxShadow:
                      "0 14px 42px rgba(0,0,0,0.5), 0 0 56px rgba(212,166,58,0.38), 0 0 96px rgba(244,201,93,0.16), inset 0 0 24px rgba(244,201,93,0.06)",
                    border: "1px solid rgba(212,166,58,0.32)",
                  }}
                >
                  <GameQRCode url={joinUrl} pin={pin} size={108} />
                </div>
                <span className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-[#a8c4ad]">
                  <Smartphone className="h-4 w-4 shrink-0 text-[#d4a63a]" strokeWidth={2} />
                  {isAr ? "امسح للانضمام" : "Scan to join"}
                </span>
              </div>
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
              borderColor: "rgba(212,166,58,0.32)",
              background: "linear-gradient(155deg, #031408 0%, #021a0e 32%, #010805 100%)",
              boxShadow: "0 20px 64px rgba(0,0,0,0.55), 0 0 80px rgba(212,166,58,0.08), inset 0 1px 0 rgba(244,201,93,0.08)",
            }}
          >
            <HeroAtmosphere />
            <div
              className="pointer-events-none absolute left-1/2 top-[42%] h-64 w-[min(92%,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(244,201,93,0.24) 0%, rgba(212,166,58,0.08) 42%, transparent 70%)" }}
              aria-hidden
            />

            <div
              dir="ltr"
              className="relative z-10 grid grid-cols-1 items-center gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(140px,auto)_1fr_minmax(160px,auto)] lg:gap-10 lg:p-10"
            >
              {/* QR يسار */}
              <div className="relative flex flex-col items-center gap-3">
                <SparkleStars variant="heroQr" />
                <div
                  className="rounded-2xl bg-white p-3"
                  style={{
                    border: "1px solid rgba(212,166,58,0.22)",
                    boxShadow:
                      "0 14px 44px rgba(0,0,0,0.5), 0 0 60px rgba(212,166,58,0.4), 0 0 100px rgba(244,201,93,0.18), inset 0 0 28px rgba(244,201,93,0.07)",
                  }}
                >
                  <GameQRCode url={joinUrl} pin={pin} size={120} />
                </div>
                <span className="flex w-full items-center justify-center gap-2 text-xs font-bold text-[#a8c4ad]">
                  <Smartphone className="h-4 w-4 shrink-0 text-[#d4a63a]" strokeWidth={2} />
                  {isAr ? "امسح للانضمام" : "Scan to join"}
                </span>
              </div>

              {/* كود — وسط */}
              <div className="flex flex-col items-center gap-4 text-center" dir={dir}>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#9fb89f]">
                  {isAr ? "كود اللعبة" : "Game code"}
                </p>
                <GameCodeGlow>
                  <motion.div className="flex items-center justify-center gap-3" dir="ltr">
                    <span
                      className="select-all font-black tabular-nums text-[#f4c95d]"
                      style={{
                        fontSize: "clamp(2.75rem, 10vw, 4.5rem)",
                        letterSpacing: "0.22em",
                        lineHeight: 1,
                        textShadow:
                          "0 0 56px rgba(244,201,93,0.5), 0 0 100px rgba(212,166,58,0.2), 0 2px 0 rgba(0,0,0,0.3)",
                      }}
                    >
                      {pin}
                    </span>
                    <button
                      type="button"
                      onClick={onCopyPin}
                      className="shrink-0 rounded-full border border-[rgba(212,166,58,0.4)] bg-[rgba(212,166,58,0.08)] p-2.5 transition-all hover:bg-[rgba(212,166,58,0.18)] hover:shadow-[0_0_20px_rgba(212,166,58,0.22)]"
                      aria-label={isAr ? "نسخ كود اللعبة" : "Copy game code"}
                    >
                      {copied ? (
                        <CheckCircle className="h-5 w-5 text-[#f4c95d]" />
                      ) : (
                        <Copy className="h-5 w-5 text-[#d4a63a]" />
                      )}
                    </button>
                  </motion.div>
                </GameCodeGlow>
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
              <div className="relative flex flex-col items-center justify-center border-l border-[rgba(212,166,58,0.2)] pl-6 lg:pl-8">
                <ConnectedPlayersBadge count={players.length} isAr={isAr} />
              </div>
            </div>
          </motion.section>

          {/* ── شريط الصف المستهدف ── */}
          <motion.section
            id="target-class-bar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative overflow-visible rounded-[20px] border px-4 py-4 sm:rounded-[22px] sm:px-6 sm:py-4"
            style={{
              borderColor: "rgba(212,166,58,0.36)",
              background: `linear-gradient(90deg, ${P.card} 0%, #062818 48%, ${P.cardDeep} 100%)`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 32px rgba(212,166,58,0.08), inset 0 1px 0 rgba(244,201,93,0.08)",
              minHeight: 84,
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
                    {isAr
                      ? "اختيار صف من صفوفك يمكنك من معرفة درجات كل طالب في المسابقة"
                      : "Pick one of your classes to track each student's scores in the competition"}
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
                    variant="cinematic"
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

              <HackSettingCard
                className={SETTING_CARD_DESKTOP}
                hackMode={hackMode}
                isAr={isAr}
                dir={dir}
                onToggle={onToggleHackMode}
              />

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
                borderColor: "rgba(212,166,58,0.28)",
                background: "linear-gradient(160deg, #010805 0%, #021408 45%, #031510 100%)",
                boxShadow: "0 20px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(244,201,93,0.06), 0 0 48px rgba(212,166,58,0.05)",
                minHeight: 320,
              }}
            >
              <PlayersZoneDecor />
              <div className="relative z-10 flex min-h-[280px] flex-col">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-white sm:text-xl">{isAr ? "منطقة اللاعبين" : "Players zone"}</h2>
                  <div className="flex items-center gap-3">
                    <PlayersProgressRing pct={playerProgressPct} size={48} />
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
                </div>

                <div className="flex flex-1 flex-col justify-center">
                {players.length === 0 ? (
                  <div className="flex flex-col items-center py-4 sm:py-10">
                    <GatheredSilhouettes compact className="mb-1 opacity-90" />
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="relative -mt-10 mb-4 flex h-36 w-36 items-center justify-center sm:-mt-8 sm:h-28 sm:w-28"
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
                          background: "linear-gradient(180deg, #0a4d26 0%, #021408 100%)",
                          boxShadow:
                            "0 0 80px rgba(244,201,93,0.42), 0 0 140px rgba(212,166,58,0.2), inset 0 1px 0 rgba(244,201,93,0.25)",
                          border: "2px solid rgba(244,201,93,0.45)",
                        }}
                      >
                        <Users className="h-14 w-14 text-[#ffe08a] sm:h-12 sm:w-12" strokeWidth={1.75} />
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

                <div className="mt-6 h-3 overflow-hidden rounded-full border border-[rgba(212,166,58,0.22)] bg-[#010805] sm:mt-8 sm:h-3.5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, #0a4d26, ${P.goldLight}, ${P.goldBright})`,
                      boxShadow: "0 0 20px rgba(244,201,93,0.55), 0 0 40px rgba(212,166,58,0.25)",
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
          <HeroStartButton
            onClick={onStartGame}
            disabled={players.length === 0}
            isAr={isAr}
            className="w-full min-h-[56px] rounded-[20px] text-lg"
          />
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
      whileHover={{
        scale: 1.03,
        boxShadow: "0 0 24px rgba(212,166,58,0.2), 0 4px 20px rgba(0,0,0,0.35)",
      }}
      className="group flex cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2.5 backdrop-blur-md transition-all duration-300 hover:border-[rgba(244,201,93,0.4)]"
      style={{
        borderColor: "rgba(212,166,58,0.22)",
        background: "rgba(3,27,17,0.45)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
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
