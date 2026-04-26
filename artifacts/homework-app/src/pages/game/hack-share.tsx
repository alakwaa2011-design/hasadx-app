import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  Link2,
  Home,
  Languages,
  PlayCircle,
  DoorOpen,
  User,
  Shuffle,
  Mic,
  Bot,
  Plus,
  UsersRound,
  Zap,
  Lock,
  Gift,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

type NavMode = "auto" | "manual";

export default function HackShare() {
  const { pin } = useParams<{ pin: string }>();
  const { lang, setLang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isAr = lang === "ar";

  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [origin, setOrigin] = useState("");

  const [navMode, setNavMode] = useState<NavMode>("auto");
  const [giftsOn, setGiftsOn] = useState(true);
  const [hackOn, setHackOn] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [bots, setBots] = useState(4);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = origin ? `${origin}/game/hack/join/${pin}` : "";

  const copy = async (value: string, kind: "pin" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      if (kind === "pin") {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 1500);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1500);
      }
      toast.success(isAr ? "تم النسخ" : "Copied");
    } catch {
      toast.error(isAr ? "فشل النسخ" : "Copy failed");
    }
  };

  return (
    <Layout noHeader>
      <div
        className="min-h-screen"
        style={{ background: "#F0F4F1", direction: dir }}
      >
        {/* ── NAVBAR (fixed, always visible) ── */}
        <nav
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-3 sm:px-6 h-14"
          style={{
            background: "#1A3A28",
            boxShadow: "0 2px 16px rgba(26,58,40,0.35)",
            direction: dir,
          }}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/teacher">
              <button
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-[13px] font-bold transition-colors"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.75)",
                }}
                data-testid="button-home"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {isAr ? "الرئيسية" : "Home"}
                </span>
              </button>
            </Link>
            <button
              onClick={() => setLang(isAr ? "en" : "ar")}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.75)",
              }}
              data-testid="button-lang"
            >
              <Languages className="w-4 h-4" />
              {isAr ? "EN" : "ع"}
            </button>
          </div>

          <div
            className="hidden sm:flex items-center gap-1.5 text-[14px] font-bold tracking-wide"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <DoorOpen className="w-4 h-4" />
            {isAr ? "غرفة الانتظار" : "Waiting Room"}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href={`/teacher/game/${pin}`}>
              <button
                className="px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold border transition-colors hover:bg-red-500/20"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.7)",
                }}
                data-testid="button-cancel"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </Link>
            <Link href={`/teacher/game/${pin}`}>
              <button
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-[10px] text-xs sm:text-sm font-black transition-all hover:-translate-y-px active:scale-95"
                style={{
                  background:
                    "linear-gradient(135deg, #E8B84B, #C9960C)",
                  color: "#1A3A28",
                  boxShadow: "0 3px 12px rgba(201,150,12,0.45)",
                }}
                data-testid="button-start-game"
              >
                <PlayCircle className="w-4 h-4" />
                {isAr ? "ابدأ اللعبة!" : "Start!"}
              </button>
            </Link>
          </div>
        </nav>

        {/* ── PAGE CONTENT ── (pt-[76px] = navbar h-14 + 20px breathing) */}
        <div className="max-w-[660px] mx-auto px-3 sm:px-4 pt-[76px] pb-14 flex flex-col gap-3">
          {/* Hero Join Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[18px]"
            style={{
              background:
                "linear-gradient(135deg, #1A3A28 0%, #2D6A44 100%)",
              boxShadow: "0 4px 24px rgba(26,58,40,0.25)",
            }}
          >
            {/* decorative circles */}
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                width: 200,
                height: 200,
                background: "rgba(255,255,255,0.04)",
                top: -60,
                insetInlineStart: -60,
              }}
            />
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                width: 140,
                height: 140,
                background: "rgba(201,150,12,0.08)",
                bottom: -40,
                insetInlineEnd: -20,
              }}
            />

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-[auto_1fr]">
              {/* QR side */}
              <div
                className="flex flex-col items-center gap-2 px-5 py-5 sm:py-6 sm:border-b-0 border-b sm:border-l"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              >
                <div
                  className="bg-white rounded-xl p-1.5 flex items-center justify-center"
                  style={{
                    width: 110,
                    height: 110,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  }}
                >
                  {joinUrl ? (
                    <QRCodeSVG
                      value={joinUrl}
                      size={96}
                      bgColor="#ffffff"
                      fgColor="#1A3A28"
                      level="M"
                      includeMargin={false}
                    />
                  ) : (
                    <div className="w-[96px] h-[96px]" />
                  )}
                </div>
                <div
                  className="text-[13px] font-extrabold tracking-[3px]"
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "'Almarai', 'Cairo', sans-serif",
                    direction: "ltr",
                  }}
                >
                  {pin}
                </div>
              </div>

              {/* Code side */}
              <div className="px-5 sm:px-6 py-5 sm:py-6 flex flex-col gap-3">
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.07em] mb-1"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {isAr ? "كود اللعبة" : "Game Code"}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="font-extrabold leading-none"
                      style={{
                        fontFamily: "'Almarai', 'Cairo', sans-serif",
                        fontSize: "clamp(32px, 9vw, 44px)",
                        color: "#E8B84B",
                        letterSpacing: "8px",
                        direction: "ltr",
                        textShadow: "0 2px 16px rgba(232,184,75,0.5)",
                      }}
                      data-testid="text-game-pin"
                    >
                      {pin}
                    </div>
                    <button
                      onClick={() => copy(pin || "", "pin")}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                      style={{
                        background: "rgba(232,184,75,0.2)",
                        border: "1px solid rgba(232,184,75,0.45)",
                        color: "#E8B84B",
                      }}
                      aria-label="copy pin"
                      data-testid="button-copy-pin"
                    >
                      {copiedPin ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => copy(joinUrl, "link")}
                  className="flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-bold transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                  data-testid="button-copy-link"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  {isAr ? "نسخ رابط الانضمام" : "Copy join link"}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Settings Card */}
          <div
            className="rounded-2xl overflow-hidden bg-white"
            style={{
              border: "1px solid #E2E8E3",
              boxShadow: "0 1px 8px rgba(26,58,40,0.05)",
            }}
          >
            {/* mode (info pill) */}
            <SettingRow
              icon={
                <IconBox bg="#EEF3EC" color="#1A3A28">
                  <User className="w-4 h-4" />
                </IconBox>
              }
              name={isAr ? "وضع اللعب" : "Play mode"}
            >
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ background: "#EEF3EC", color: "#1A3A28" }}
              >
                <User className="w-3 h-3" />
                {isAr ? "فردي" : "Solo"}
              </span>
            </SettingRow>

            {/* navigation segmented */}
            <SettingRow
              icon={
                <IconBox bg="#EEF3EC" color="#1A3A28">
                  <Shuffle className="w-4 h-4" />
                </IconBox>
              }
              name={isAr ? "التنقل بين الأسئلة" : "Question navigation"}
            >
              <Segmented
                value={navMode}
                onChange={setNavMode}
                options={[
                  { value: "auto", label: isAr ? "تلقائي" : "Auto" },
                  { value: "manual", label: isAr ? "يدوي" : "Manual" },
                ]}
              />
            </SettingRow>

            {/* gifts (default ON) */}
            <SettingRow
              icon={
                <IconBox bg="#FFF8EE" color="#C9960C">
                  <Gift className="w-4 h-4" />
                </IconBox>
              }
              name={isAr ? "الهدايا" : "Gifts"}
              desc={
                isAr ? "هدية لكل ٣ إجابات صحيحة" : "Gift every 3 correct"
              }
            >
              <Toggle
                checked={giftsOn}
                onChange={setGiftsOn}
                testid="toggle-gifts"
              />
            </SettingRow>

            {/* hack mode */}
            <SettingRow
              icon={
                <IconBox bg="#F0F8F2" color="#1A3A28">
                  <Lock className="w-4 h-4" />
                </IconBox>
              }
              name={isAr ? "لعبة الاختراق" : "Hack mode"}
              desc={
                isAr
                  ? "كلمات سر وصناديق غامضة"
                  : "Passwords & mystery boxes"
              }
            >
              <Toggle
                checked={hackOn}
                onChange={setHackOn}
                testid="toggle-hack"
              />
            </SettingRow>

            {/* voice */}
            <SettingRow
              icon={
                <IconBox bg="#EEF3EC" color="#1A3A28">
                  <Mic className="w-4 h-4" />
                </IconBox>
              }
              name={isAr ? "قراءة صوتية" : "Voice reading"}
              desc={isAr ? "قراءة الأسئلة صوتياً" : "Read questions aloud"}
            >
              <Toggle
                checked={voiceOn}
                onChange={setVoiceOn}
                testid="toggle-voice"
              />
            </SettingRow>

            {/* bots */}
            <SettingRow
              icon={
                <IconBox bg="#EEF3EC" color="#1A3A28">
                  <Bot className="w-4 h-4" />
                </IconBox>
              }
              name={isAr ? "لاعبون وهميون" : "Bot players"}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[13px] font-extrabold w-5 text-center"
                  style={{ color: "#1A3A28" }}
                  data-testid="text-bot-count"
                >
                  {bots}
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={bots}
                  onChange={(e) => setBots(Number(e.target.value))}
                  className="hack-share-slider"
                  data-testid="slider-bots"
                />
                <button
                  onClick={() => setBots((b) => Math.min(10, b + 1))}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors hover:text-white"
                  style={{ background: "#EEF3EC", color: "#1A3A28" }}
                  data-testid="button-add-bot"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#1A3A28")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#EEF3EC")
                  }
                >
                  <Plus className="w-3 h-3" />
                  {isAr ? "إضافة" : "Add"}
                </button>
              </div>
            </SettingRow>
          </div>

          {/* Players Card */}
          <div
            className="rounded-2xl overflow-hidden bg-white"
            style={{
              border: "1px solid #E2E8E3",
              boxShadow: "0 1px 8px rgba(26,58,40,0.05)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid #F2F5F2" }}
            >
              <div
                className="flex items-center gap-1.5 text-[13px] font-bold"
                style={{ color: "#1A3A28" }}
              >
                <UsersRound className="w-4 h-4" />
                {isAr ? "اللاعبون المتصلون" : "Connected players"}
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-[12px] font-extrabold"
                style={{ background: "#EEF3EC", color: "#1A3A28" }}
                data-testid="text-player-count"
              >
                {bots}
              </span>
            </div>

            <div className="flex flex-col items-center gap-2 px-5 py-7">
              <motion.div
                animate={{ scale: [1, 1.07, 1], opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="w-[50px] h-[50px] rounded-full flex items-center justify-center"
                style={{ background: "#EEF3EC", color: "#6A9E72" }}
              >
                <UsersRound className="w-6 h-6" />
              </motion.div>
              <div
                className="text-[13px] font-semibold"
                style={{ color: "#9AB09C" }}
              >
                {isAr ? "في انتظار انضمام اللاعبين…" : "Waiting for players…"}
              </div>
              <div
                className="text-[11px] leading-[1.65] text-center max-w-[230px]"
                style={{ color: "#B5C8B7" }}
              >
                {isAr ? (
                  <>
                    شارك الكود{" "}
                    <strong
                      style={{ color: "#1A3A28", fontWeight: 800 }}
                    >
                      {pin}
                    </strong>{" "}
                    مع المشاركين للانضمام إلى اللعبة
                  </>
                ) : (
                  <>
                    Share code{" "}
                    <strong style={{ color: "#1A3A28", fontWeight: 800 }}>
                      {pin}
                    </strong>{" "}
                    with participants to join the game
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom hint strip */}
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3"
            style={{
              background: "linear-gradient(135deg, #1A3A28, #2D6A44)",
              boxShadow: "0 2px 12px rgba(26,58,40,0.2)",
            }}
          >
            <Zap
              className="w-5 h-5 flex-shrink-0"
              style={{ color: "#E8B84B" }}
            />
            <div
              className="text-[12px] font-semibold leading-[1.5]"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {isAr ? (
                <>
                  اللعبة جاهزة! انتظر انضمام المشاركين ثم اضغط{" "}
                  <strong
                    style={{ color: "#E8B84B", fontWeight: 800 }}
                  >
                    ابدأ اللعبة
                  </strong>{" "}
                  في الأعلى لبدء التحدي.
                </>
              ) : (
                <>
                  Game ready! Wait for players, then press{" "}
                  <strong style={{ color: "#E8B84B", fontWeight: 800 }}>
                    Start
                  </strong>{" "}
                  above to begin.
                </>
              )}
            </div>
          </div>
        </div>

        {/* slider styling */}
        <style>{`
          .hack-share-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 70px;
            height: 4px;
            border-radius: 999px;
            background: #D5DDD6;
            outline: none;
            cursor: pointer;
          }
          .hack-share-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #1A3A28;
            border: 2.5px solid white;
            box-shadow: 0 1px 5px rgba(26,58,40,0.3);
            cursor: pointer;
          }
          .hack-share-slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #1A3A28;
            border: 2.5px solid white;
            box-shadow: 0 1px 5px rgba(26,58,40,0.3);
            cursor: pointer;
            border-style: solid;
          }
        `}</style>
      </div>
    </Layout>
  );
}

/* ─────── helpers ─────── */

function IconBox({
  bg,
  color,
  children,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0"
      style={{ background: bg, color }}
    >
      {children}
    </div>
  );
}

function SettingRow({
  icon,
  name,
  desc,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3"
      style={{ borderBottom: "1px solid #F2F5F2" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="min-w-0">
          <div
            className="text-[13px] font-bold"
            style={{ color: "#1A1A1A" }}
          >
            {name}
          </div>
          {desc && (
            <div
              className="text-[11px] mt-0.5 truncate"
              style={{ color: "#9AB09C" }}
            >
              {desc}
            </div>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  testid,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  testid?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testid}
      className="relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? "#1A3A28" : "#D5DDD6" }}
    >
      <span
        className="absolute top-[3px] w-4 h-4 rounded-full bg-white transition-transform"
        style={{
          insetInlineEnd: 3,
          transform: checked ? "translateX(18px)" : "translateX(0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="flex p-[3px] gap-[2px] rounded-lg"
      style={{ background: "#F0F4F1" }}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1 rounded-md text-[12px] font-bold transition-colors"
            style={{
              background: on ? "white" : "transparent",
              color: on ? "#1A3A28" : "#9AB09C",
              boxShadow: on ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
            data-testid={`seg-${opt.value}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
