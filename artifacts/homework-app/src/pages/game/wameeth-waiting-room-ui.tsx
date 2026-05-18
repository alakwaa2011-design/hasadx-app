/**
 * وميض — غرفة الانتظار (واجهة فقط)
 * المنطق والـ handlers تُمرَّر من teacher.tsx دون تغيير.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { ClassSelector } from "@/components/teacher/class-selector";
import { GameQRCode } from "@/components/game-qr-code";
import { AvatarDisplay } from "@/components/avatar-display";
import {
  PlayCircle,
  Home,
  Languages,
  Users,
  User,
  UsersRound,
  SkipForward,
  Gift,
  Mic,
  GraduationCap,
  Lock,
  Unlock,
  Ban,
  Copy,
  CheckCircle,
  Link2,
  ArrowRightLeft,
  Zap,
  Settings2,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const C = {
  primary: "#0a4d26",
  gold: "#d4a63a",
  bg: "#061b12",
  card: "#0d2818",
  border: "#1a3a25",
  text: "#ffffff",
  muted: "#8aab8a",
} as const;

const MAX_LOBBY_PLAYERS = 20;

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

function PremiumToggle({
  on,
  onClick,
  disabled,
  dir,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  dir: "rtl" | "ltr";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
        disabled && "cursor-not-allowed opacity-40",
        on ? "bg-[#d4a63a]" : "bg-[#1a3a25]",
      )}
      aria-pressed={on}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200"
        style={
          dir === "rtl"
            ? { right: 2, transform: on ? "translateX(-20px)" : "translateX(0)" }
            : { left: 2, transform: on ? "translateX(20px)" : "translateX(0)" }
        }
      />
    </button>
  );
}

function SettingCard({
  icon,
  title,
  desc,
  children,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={cn(
        "flex min-h-[148px] flex-col rounded-2xl border p-4 backdrop-blur-md",
        "border-[#1a3a25] bg-[#0d2818]/85 transition-colors hover:border-[#d4a63a]/30",
      )}
    >
      <motion.div
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-[#d4a63a]"
        style={{ background: `${C.primary}99` }}
      >
        {icon}
      </motion.div>
      <h3 className="text-sm font-black text-white">{title}</h3>
      {desc ? <p className="mt-1 text-[11px] leading-relaxed text-[#8aab8a]">{desc}</p> : null}
      <div className="mt-auto flex items-center justify-end pt-3">{children}</div>
    </motion.div>
  );
}

function GoldParticles() {
  const spots = [
    { top: "12%", left: "8%", delay: 0 },
    { top: "68%", left: "15%", delay: 0.4 },
    { top: "22%", right: "12%", delay: 0.8 },
    { top: "78%", right: "18%", delay: 1.2 },
    { top: "45%", left: "42%", delay: 0.6 },
    { top: "35%", right: "38%", delay: 1 },
  ];
  return (
    <>
      {spots.map((s, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#d4a63a]"
          style={{ top: s.top, left: s.left, right: s.right }}
          animate={{ opacity: [0.15, 0.45, 0.15], y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </>
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
    targetClassEditing,
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
    onSetTargetClassEditing,
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

  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}game/join/${pin}`;
  const playerProgressPct = Math.min(100, (players.length / MAX_LOBBY_PLAYERS) * 100);
  const humanCount = players.filter((p) => !p.isBot).length;

  const Segmented = ({
    options,
    value,
    onChange,
  }: {
    options: readonly { val: boolean; ar: string; en: string }[];
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <motion.div
      className="flex rounded-xl border border-[#1a3a25] bg-[#061b12]/60 p-0.5"
      role="group"
    >
      {options.map((opt) => (
        <button
          key={String(opt.val)}
          type="button"
          onClick={() => onChange(opt.val)}
          className={cn(
            "rounded-[10px] px-3 py-1.5 text-xs font-bold transition-all",
            value === opt.val ? "bg-[#d4a63a] text-[#061b12]" : "text-[#8aab8a] hover:text-white",
          )}
        >
          {isAr ? opt.ar : opt.en}
        </button>
      ))}
    </motion.div>
  );

  return (
    <Layout noHeader>
      <div className="min-h-screen bg-[#061b12] text-white" dir={dir} style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
        {/* ── Header ── */}
        <header className="sticky top-0 z-50 border-b border-[#1a3a25] bg-[#061b12]/92 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-5">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <img
                  src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                  alt={isAr ? "حصاد" : "Hasad"}
                  className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-[#d4a63a]/20"
                />
                <span className="hidden text-sm font-black text-white sm:inline">{isAr ? "حصاد" : "Hasad"}</span>
              </div>
              <button
                type="button"
                onClick={onHome}
                className="flex items-center gap-1.5 rounded-xl border border-[#1a3a25] bg-[#0d2818]/80 px-2.5 py-1.5 text-xs font-bold text-[#8aab8a] transition-colors hover:border-[#d4a63a]/30 hover:text-white sm:px-3"
              >
                <Home className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">{isAr ? "الرئيسية" : "Home"}</span>
              </button>
              <button
                type="button"
                onClick={onToggleLang}
                className="flex items-center gap-1 rounded-xl border border-[#1a3a25] bg-[#0d2818]/80 px-2 py-1.5 text-[11px] font-bold text-[#8aab8a] hover:text-white"
              >
                <Languages className="h-3.5 w-3.5" />
                {isAr ? "EN" : "ع"}
              </button>
            </div>

            <div className="absolute start-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-center sm:block">
              <p className="text-base font-black text-[#d4a63a] sm:text-lg">{isAr ? "غرفة الانتظار" : "Waiting Room"}</p>
              <p className="text-[10px] text-[#8aab8a]">{isAr ? "وميض — لعبة المعرفة المباشرة" : "Wameeth live quiz"}</p>
            </div>

            <motion.div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={onEndGame}
                className="rounded-xl border border-[#1a3a25] bg-[#0d2818]/90 px-2.5 py-2 text-[11px] font-bold text-[#8aab8a] transition-colors hover:border-rose-500/40 hover:text-rose-300 sm:px-3.5 sm:text-xs"
              >
                {isAr ? "إنهاء اللعبة" : "End game"}
              </button>
              <motion.button
                type="button"
                onClick={onStartGame}
                disabled={players.length === 0}
                whileHover={players.length > 0 ? { scale: 1.03 } : undefined}
                whileTap={players.length > 0 ? { scale: 0.97 } : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black shadow-lg transition-all sm:px-5 sm:py-2.5 sm:text-sm",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
                style={{
                  background: `linear-gradient(135deg, ${C.gold} 0%, #b8892a 100%)`,
                  color: "#061b12",
                  boxShadow: players.length > 0 ? "0 4px 24px rgba(212,166,58,0.35)" : undefined,
                }}
              >
                <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                {isAr ? "ابدأ اللعبة" : "Start game"}
              </motion.button>
            </motion.div>
          </div>
          <p className="pb-2 text-center text-sm font-black text-[#d4a63a] sm:hidden">{isAr ? "غرفة الانتظار" : "Waiting Room"}</p>
        </header>

        <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-5 sm:py-6">
          {/* ── Hero ── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-[#1a3a25]"
            style={{
              background: `linear-gradient(145deg, ${C.primary} 0%, #061b12 55%, #041009 100%)`,
              boxShadow: "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(212,166,58,0.08)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: `
                  linear-gradient(118deg, transparent 42%, rgba(212,166,58,0.07) 50%, transparent 58%),
                  linear-gradient(72deg, transparent 30%, rgba(212,166,58,0.04) 48%, transparent 65%)
                `,
              }}
            />
            <GoldParticles />

            <div dir="ltr" className="relative z-10 grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-8">
              {/* QR — يسار */}
              <div className="flex flex-col items-center gap-2 lg:items-start">
                <div className="rounded-2xl bg-white p-2 shadow-lg ring-1 ring-[#d4a63a]/20">
                  <GameQRCode url={joinUrl} pin={pin} size={108} />
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#8aab8a]">
                  <Smartphone className="h-3 w-3 text-[#d4a63a]" />
                  {isAr ? "امسح للانضمام" : "Scan to join"}
                </span>
              </div>

              {/* PIN — وسط */}
              <motion.div className="flex flex-col items-center gap-3 text-center" dir={dir}>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8aab8a]">
                  {isAr ? "كود اللعبة" : "Game code"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onCopyPin}
                    className="rounded-xl border border-[#d4a63a]/25 bg-[#d4a63a]/10 p-2 transition-colors hover:bg-[#d4a63a]/20"
                    aria-label={isAr ? "نسخ الكود" : "Copy code"}
                  >
                    {copied ? (
                      <CheckCircle className="h-5 w-5 text-[#d4a63a]" />
                    ) : (
                      <Copy className="h-5 w-5 text-[#d4a63a]" />
                    )}
                  </button>
                  <span
                    className="select-all font-black tabular-nums tracking-[0.2em] text-[#d4a63a] sm:tracking-[0.28em]"
                    style={{ fontSize: "clamp(2.25rem, 8vw, 3.75rem)", lineHeight: 1.05 }}
                    dir="ltr"
                  >
                    {pin}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="flex items-center gap-2 rounded-xl border border-[#1a3a25] bg-[#0d2818]/60 px-4 py-2 text-xs font-semibold text-[#8aab8a] transition-all hover:border-[#d4a63a]/30 hover:text-white"
                >
                  {linkCopied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
                  {linkCopied ? (isAr ? "تم النسخ!" : "Copied!") : isAr ? "نسخ رابط الانضمام" : "Copy join link"}
                </button>
              </motion.div>

              {/* اللاعبون — يمين */}
              <motion.div className="flex flex-col items-center gap-3 lg:items-end" dir={dir}>
                <motion.div
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#d4a63a]/35 bg-[#0d2818]/80 shadow-[0_0_32px_rgba(212,166,58,0.12)]"
                >
                  <Users className="h-9 w-9 text-[#d4a63a]" />
                </motion.div>
                <div className="text-center lg:text-end">
                  <p className="text-2xl font-black text-white">{players.length}</p>
                  <p className="text-xs font-bold text-[#8aab8a]">{isAr ? "لاعب متصل" : "players joined"}</p>
                </div>
                <span className="rounded-full border border-[#1a3a25] bg-[#061b12]/80 px-3 py-1 text-[10px] font-bold text-[#8aab8a]">
                  {isAr ? `الحد ${MAX_LOBBY_PLAYERS} لاعب` : `Max ${MAX_LOBBY_PLAYERS} players`}
                </span>
              </motion.div>
            </div>
          </motion.section>

          {/* ── إعدادات اللعبة ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-[#d4a63a]" />
              <h2 className="text-sm font-black text-white sm:text-base">{isAr ? "إعدادات اللعبة" : "Game settings"}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SettingCard
                delay={0.02}
                icon={
                  currentGameMode === "teams" ? (
                    <UsersRound className="h-5 w-5" />
                  ) : (
                    <User className="h-5 w-5" />
                  )
                }
                title={isAr ? "وضع اللعبة" : "Game mode"}
                desc={isAr ? "فردي أو فرق" : "Solo or teams"}
              >
                <span className="rounded-full border border-[#d4a63a]/30 bg-[#0a4d26] px-3 py-1.5 text-xs font-black text-[#d4a63a]">
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
                delay={0.04}
                icon={<SkipForward className="h-5 w-5" />}
                title={isAr ? "التنقل بين الأسئلة" : "Question navigation"}
                desc={isAr ? "تلقائي أو يدوي" : "Auto or manual"}
              >
                <Segmented
                  value={autoAdvance}
                  onChange={onSetAutoAdvance}
                  options={[
                    { val: true, ar: "تلقائي", en: "Auto" },
                    { val: false, ar: "يدوي", en: "Manual" },
                  ]}
                />
              </SettingCard>

              <SettingCard
                delay={0.06}
                icon={<Gift className="h-5 w-5" />}
                title={isAr ? "الهدايا" : "Gifts"}
                desc={isAr ? "هدية لكل ٣ إجابات صحيحة" : "Gift every 3 correct answers"}
              >
                <PremiumToggle on={giftsEnabled} onClick={onToggleGifts} disabled={hackMode} dir={dir} />
              </SettingCard>

              <SettingCard
                delay={0.08}
                icon={<span className="text-lg">🔐</span>}
                title={isAr ? "لعبة الاختراق" : "Hack game"}
                desc={isAr ? "كلمات سر وصناديق غامضة" : "Passwords & mystery boxes"}
              >
                <PremiumToggle on={hackMode} onClick={onToggleHackMode} dir={dir} />
              </SettingCard>

              <SettingCard
                delay={0.1}
                icon={<Mic className="h-5 w-5" />}
                title={isAr ? "قراءة صوتية" : "Voice reading"}
                desc={isAr ? "قراءة الأسئلة صوتياً" : "Read questions aloud"}
              >
                <PremiumToggle on={ttsEnabled} onClick={onToggleTts} dir={dir} />
              </SettingCard>

              <SettingCard
                delay={0.12}
                icon={<GraduationCap className="h-5 w-5" />}
                title={isAr ? "الصف المستهدف" : "Target grade"}
                desc={isAr ? "تقييد اللعبة بصف معيّن" : "Restrict to one class"}
              >
                <button
                  type="button"
                  onClick={() => onSetTargetClassEditing((v) => !v)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                    targetClass
                      ? "border-[#d4a63a]/40 bg-[#0a4d26] text-[#d4a63a]"
                      : "border-[#1a3a25] bg-[#061b12] text-[#8aab8a] hover:text-white",
                  )}
                >
                  {targetClass || (isAr ? "أي صف" : "Any grade")}
                </button>
              </SettingCard>

              <SettingCard
                delay={0.14}
                icon={roomLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                title={isAr ? "قفل الغرفة" : "Lock room"}
                desc={isAr ? "منع انضمام طلاب جدد" : "Block new joins"}
              >
                <PremiumToggle on={roomLocked} onClick={onToggleRoomLock} dir={dir} />
              </SettingCard>

              <SettingCard
                delay={0.16}
                icon={<span className="text-lg">🤖</span>}
                title={isAr ? "لاعبون وهميون" : "Bot players"}
                desc={isAr ? "للتجربة السريعة" : "For quick testing"}
              >
                <div className="flex w-full flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onSetBotCount((c) => Math.max(0, c - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3a25] text-sm font-bold text-white"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-xs font-black text-[#d4a63a]">{botCount}</span>
                  <button
                    type="button"
                    onClick={() => onSetBotCount((c) => Math.min(10, c + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3a25] text-sm font-bold text-white"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={onAddBots}
                    disabled={isAddingBots || botCount === 0}
                    className="rounded-lg bg-[#0a4d26] px-2.5 py-1.5 text-[11px] font-black text-[#d4a63a] disabled:opacity-40"
                  >
                    {isAddingBots ? "…" : isAr ? "إضافة" : "Add"}
                  </button>
                </div>
              </SettingCard>
            </div>

            {targetClassEditing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 overflow-hidden rounded-2xl border border-[#1a3a25] bg-[#0d2818]/90 p-4"
              >
                <ClassSelector
                  value={targetClass}
                  onChange={onUpdateTargetClass}
                  accent={C.gold}
                  label={isAr ? "اختر الصف المستهدف" : "Choose target class"}
                />
                {targetClass && (
                  <button
                    type="button"
                    onClick={() => onUpdateTargetClass("")}
                    className="mt-2 text-xs font-bold text-[#8aab8a] underline"
                  >
                    {isAr ? "إزالة تحديد الصف" : "Clear class"}
                  </button>
                )}
              </motion.div>
            )}
          </section>

          {/* Hack marathon panel */}
          {hackMode && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[#1a3a25] bg-[#0d2818]/90 p-5"
            >
              <p className="mb-3 text-xs font-bold text-[#d4a63a]">{isAr ? "⏱ مدة الماراثون" : "⏱ Marathon duration"}</p>
              <motion.div className="mb-4 flex flex-wrap gap-2">
                {[5, 7, 10, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onSetHackDurationMin(m);
                      onSetHackCustomMin("");
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-bold transition-colors",
                      !hackCustomMin && hackDurationMin === m
                        ? "border-[#d4a63a] bg-[#d4a63a] text-[#061b12]"
                        : "border-[#1a3a25] text-[#8aab8a] hover:border-[#d4a63a]/40",
                    )}
                  >
                    {m} {isAr ? "د" : "min"}
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={hackCustomMin}
                    onChange={(e) => onSetHackCustomMin(e.target.value)}
                    placeholder={isAr ? "مخصص" : "custom"}
                    className="w-20 rounded-lg border border-[#1a3a25] bg-[#061b12] px-3 py-2 text-sm text-white focus:border-[#d4a63a]/50 focus:outline-none"
                  />
                </div>
              </motion.div>
              <div className="border-t border-[#1a3a25] pt-4">
                <p className="mb-2 text-xs font-bold text-[#8aab8a]">
                  {isAr ? "إرسال رسالة للجميع" : "Broadcast to all"}
                </p>
                <div className="flex gap-2">
                  <input
                    value={broadcastMessage}
                    onChange={(e) => onBroadcastMessageChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSendBroadcast()}
                    placeholder={isAr ? "تلميح أو رسالة للطلاب…" : "Hint or message…"}
                    className="min-w-0 flex-1 rounded-xl border border-[#1a3a25] bg-[#061b12] px-3 py-2 text-sm text-white placeholder:text-[#8aab8a]/60 focus:border-[#d4a63a]/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={onSendBroadcast}
                    disabled={!broadcastMessage.trim()}
                    className="shrink-0 rounded-xl bg-[#d4a63a] px-4 py-2 text-sm font-black text-[#061b12] disabled:opacity-40"
                  >
                    {broadcastSent ? (isAr ? "✓ أُرسل" : "✓ Sent") : isAr ? "بث" : "Send"}
                  </button>
                </div>
                {sentMessages.length > 0 && (
                  <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
                    <div className="mb-1 flex justify-between">
                      <span className="text-[10px] text-[#8aab8a]">{isAr ? "سجل الرسائل" : "Message log"}</span>
                      <button type="button" onClick={onClearSentMessages} className="text-[10px] text-rose-400">
                        {isAr ? "مسح" : "Clear"}
                      </button>
                    </div>
                    {sentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="flex gap-2 rounded-lg border border-[#1a3a25] bg-[#061b12]/80 px-2 py-1.5 text-xs text-[#8aab8a]"
                      >
                        <span className="shrink-0 font-mono opacity-60">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="flex-1 break-all text-white/90">{msg.text}</span>
                        <button type="button" onClick={() => onRemoveSentMessage(msg.id)} className="text-rose-400">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {players.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#1a3a25] pt-4">
                  {players.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => onKickPlayer(p.name)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold",
                        p.hasPassword ? "border-[#d4a63a]/40 text-[#d4a63a]" : "border-[#1a3a25] text-[#8aab8a]",
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-3xl border border-[#1a3a25] bg-[#0d2818]/80 p-5 sm:p-7"
            >
              <GoldParticles />
              <motion.div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-black text-white sm:text-lg">{isAr ? "منطقة اللاعبين" : "Players zone"}</h2>
                <span className="rounded-full border border-[#1a3a25] bg-[#061b12] px-3 py-1 text-xs font-black text-[#d4a63a]">
                  {players.length} / {MAX_LOBBY_PLAYERS}
                </span>
              </motion.div>

              <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#061b12]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.gold})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(playerProgressPct, players.length === 0 ? 4 : 8)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {players.length === 0 ? (
                <div className="relative flex flex-col items-center py-8 sm:py-12">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-[#d4a63a]/35 bg-[#0a4d26]/40"
                  >
                    <Users className="h-11 w-11 text-[#d4a63a]/80" />
                    <motion.span
                      className="absolute inset-0 rounded-full border border-[#d4a63a]/20"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    />
                  </motion.div>
                  <p className="text-center text-sm font-black text-white sm:text-base">
                    {isAr ? "بانتظار انضمام اللاعبين..." : "Waiting for players to join…"}
                  </p>
                  <p className="mt-2 max-w-sm text-center text-xs text-[#8aab8a]">
                    {isAr
                      ? `شارك الكود ${pin} أو امسح رمز QR للانضمام`
                      : `Share code ${pin} or scan the QR code to join`}
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-4 text-[10px] font-bold text-[#8aab8a]">
                    <span className="flex items-center gap-1">
                      <Smartphone className="h-3.5 w-3.5 text-[#d4a63a]" />
                      {isAr ? "انضمام سهل" : "Easy join"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-[#d4a63a]" />
                      {isAr ? "تجربة تفاعلية" : "Interactive"}
                    </span>
                  </div>
                </div>
              ) : currentGameMode === "teams" && teamNames.length > 0 ? (
                <div className="space-y-3">
                  {teamNames.map((teamName) => {
                    const teamPlayers = players.filter((p) => p.teamName === teamName);
                    const isLocked = lockedTeams.includes(teamName);
                    return (
                      <div key={teamName} className="rounded-2xl border border-[#1a3a25] bg-[#061b12]/50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="rounded-full bg-[#0a4d26] px-2.5 py-0.5 text-xs font-black text-[#d4a63a]">
                            {teamName} · {teamPlayers.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleTeamLock(teamName)}
                            className="flex items-center gap-1 rounded-lg border border-[#1a3a25] px-2 py-1 text-[11px] font-bold text-[#8aab8a]"
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
                <div className="flex flex-wrap justify-center gap-2.5 sm:justify-start">
                  <AnimatePresence>
                    {players.map((p, i) => (
                      <motion.div
                        key={p.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <PlayerChip player={p} isAr={isAr} onKick={() => onKickPlayer(p.name)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {humanCount > 0 && (
                <p className="mt-4 text-center text-[11px] font-bold text-[#8aab8a]">
                  {isAr ? `${humanCount} لاعب جاهز` : `${humanCount} player(s) ready`}
                </p>
              )}
            </motion.section>
          )}

          {/* تلميح سفلي */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 rounded-2xl border border-[#1a3a25] bg-[#0d2818]/60 px-4 py-3"
          >
            <Zap className="h-4 w-4 shrink-0 text-[#d4a63a]" />
            <p className="flex-1 text-center text-xs font-semibold text-[#8aab8a]">
              {isAr ? (
                <>
                  اللعبة جاهزة! انتظر انضمام المشاركين ثم اضغط{" "}
                  <strong className="text-[#d4a63a]">ابدأ اللعبة</strong> في الأعلى.
                </>
              ) : (
                <>
                  Game ready! When players join, press <strong className="text-[#d4a63a]">Start game</strong> above.
                </>
              )}
            </p>
          </motion.div>
        </main>
      </div>
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
    <div
      role="button"
      tabIndex={0}
      onClick={onKick}
      onKeyDown={(e) => e.key === "Enter" && onKick()}
      className="group flex cursor-pointer items-center gap-2 rounded-xl border border-[#1a3a25] bg-[#061b12]/80 px-3 py-2 transition-colors hover:border-[#d4a63a]/30"
    >
      <AvatarDisplay avatar={p.avatar} size="lg" fallback="🧑" />
      <span className="text-sm font-bold text-white">{p.name}</span>
      {p.isBot && (
        <span className="rounded-full bg-[#1a3a25] px-1.5 py-0.5 text-[10px] font-bold text-[#8aab8a]">🤖</span>
      )}
      {p.teamName && !onMove && (
        <span className="rounded-full bg-[#0a4d26] px-2 py-0.5 text-[10px] font-bold text-[#d4a63a]">{p.teamName}</span>
      )}
      {onMove && teamNames && (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <select
            value={p.teamName || ""}
            onChange={(e) => {
              const target = e.target.value;
              if (target && target !== p.teamName) onMove(target);
            }}
            className="appearance-none rounded-lg border border-[#1a3a25] bg-[#0d2818] py-1 pe-6 ps-2 text-[11px] font-bold text-white"
          >
            {teamNames.map((tn) => (
              <option key={tn} value={tn}>
                {tn}
              </option>
            ))}
          </select>
          <ArrowRightLeft className="pointer-events-none absolute end-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#8aab8a]" />
        </div>
      )}
      <Ban className="h-3.5 w-3.5 text-rose-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
