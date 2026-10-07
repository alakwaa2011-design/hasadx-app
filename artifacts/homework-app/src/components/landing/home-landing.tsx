import { Link } from "wouter";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  Check,
  Menu,
  MessageSquarePlus,
  Pencil,
  Presentation,
  Quote,
  Star,
  Video,
  X,
} from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { SocialLinksBar } from "@/components/social-links-bar";
import { HOME_COPY, type LandingLang } from "./home-copy";

/**
 * الصفحة الرئيسية العامة — تنفيذ لتصميم المصممة (Home Page.pdf).
 * مكوّن عرض فقط: منطق الانضمام بالرمز وماسح QR وبوابة الضيف يأتي من home.tsx.
 * الصور في public/images/landing مقصوصة من التصميم مؤقتاً إلى أن تُصدَّر الأصول الأصلية.
 */

const GREEN = "#267949";
const GREEN_BTN = "#1f7a45";
const INK = "#10281c";
const GOLD = "#f2b01e";
const FONT_SHADOW = "0 8px 24px rgba(31,122,69,0.10)";

const img = (name: string) => `${import.meta.env.BASE_URL}images/landing/${name}`;

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 1024px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

/**
 * مسرح بعرض ثابت (1440) يُصغَّر ليلائم الشاشة. يضمن أن الأقسام التي تقوم على صورة
 * وبطاقات فوقها تطابق التصميم بالبكسل على الشاشات الكبيرة. الإحداثيات فيزيائية
 * (من اليسار) ولا تنعكس في الإنجليزية؛ اتجاه النص داخل البطاقات فقط يتبع اللغة.
 */
function FitStage({
  width,
  height,
  dir,
  children,
}: {
  width: number;
  height: number;
  dir: "rtl" | "ltr";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="relative mx-auto w-full" style={{ maxWidth: width, height: height * scale }}>
      <div
        dir={dir}
        className="absolute left-0 top-0"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}

function Box({
  x,
  y,
  w,
  h,
  children,
  className = "",
  style,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`absolute ${className}`} style={{ left: x, top: y, width: w, height: h, ...style }}>
      {children}
    </div>
  );
}

function Title({
  line1,
  accent,
  size = "text-[28px] sm:text-[34px]",
  className = "",
}: {
  line1: string;
  accent: string;
  size?: string;
  className?: string;
}) {
  return (
    <h2 className={`font-extrabold leading-[1.25] ${size} ${className}`} style={{ color: INK }}>
      <span className="block">{line1}</span>
      <span className="block" style={{ color: GREEN }}>
        {accent}
      </span>
    </h2>
  );
}

function Watermark({ className = "" }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`}
      alt=""
      aria-hidden
      className={`pointer-events-none absolute select-none opacity-[0.06] ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* pin boxes (منطق الإدخال نفسه الموجود سابقاً في home.tsx)              */
/* ------------------------------------------------------------------ */

export interface JoinProps {
  slots: string[];
  setSlots: (s: string[]) => void;
  pin: string;
  setPin: (p: string) => void;
  digitRefs: RefObject<HTMLInputElement | null>[];
  onJoin: () => void;
  scanner: {
    active: boolean;
    error: string | null;
    success: boolean;
    videoRef: RefObject<HTMLVideoElement | null>;
    canvasRef: RefObject<HTMLCanvasElement | null>;
    start: () => void;
    stop: () => void;
  };
}

function PinBoxes({ join, boxClass, style }: { join: JoinProps; boxClass: string; style?: React.CSSProperties }) {
  const { slots, setSlots, setPin, digitRefs, onJoin, pin } = join;
  return (
    <>
      {slots.map((slotVal, i) => (
        <input
          key={i}
          ref={digitRefs[i]}
          dir="ltr"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={slotVal}
          placeholder="-"
          aria-label={`${i + 1}`}
          className={boxClass}
          style={style}
          onChange={(e) => {
            const val = e.target.value.slice(-1).replace(/\D/g, "");
            const next = [...slots];
            next[i] = val;
            setSlots(next);
            setPin(next.join("").trimEnd());
            if (val && i < 5) setTimeout(() => digitRefs[i + 1].current?.focus(), 0);
          }}
          onKeyDown={(e) => {
            if (
              !/^[0-9]$/.test(e.key) &&
              !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key) &&
              !e.ctrlKey &&
              !e.metaKey
            ) {
              e.preventDefault();
            }
            if (e.key === "Backspace") {
              if (slotVal) {
                const next = [...slots];
                next[i] = "";
                setSlots(next);
                setPin(next.join("").trimEnd());
              } else if (i > 0) {
                digitRefs[i - 1].current?.focus();
              }
            }
            if (e.key === "Enter" && pin.trim().length >= 1) onJoin();
          }}
          onPaste={(e) => {
            const raw = e.clipboardData.getData("text").trim();
            const millionMatch = raw.match(/\/game\/million\/join\/([a-zA-Z0-9]+)/);
            const urlMatch = raw.match(/\/game\/(?:join|[a-z]+\/join)\/([a-zA-Z0-9]+)/);
            const code = millionMatch?.[1] ?? urlMatch?.[1] ?? raw;
            const chars = code.slice(0, 6).split("");
            const next: string[] = ["", "", "", "", "", ""];
            chars.forEach((c, idx) => {
              next[idx] = c;
            });
            setSlots(next);
            setPin(next.join("").trimEnd());
            const focusIdx = Math.min(chars.length - 1, 5);
            setTimeout(() => digitRefs[focusIdx]?.current?.focus(), 0);
            e.preventDefault();
          }}
        />
      ))}
    </>
  );
}

function ScannerModal({ join, copy, onClose }: { join: JoinProps; copy: (typeof HOME_COPY)[LandingLang]; onClose: () => void }) {
  const { scanner } = join;
  useEffect(() => {
    scanner.start();
    return () => scanner.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal>
      <div className="relative w-[min(92vw,420px)] rounded-3xl bg-white p-5 text-center shadow-2xl">
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute end-3 top-3 rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="mb-3 text-lg font-extrabold" style={{ color: INK }}>
          {copy.join.qrTitle}
        </p>
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-2xl bg-black">
          <video ref={scanner.videoRef} className="h-full w-full object-cover" playsInline muted />
          <canvas ref={scanner.canvasRef} className="hidden" />
          {scanner.success && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-500/90 text-lg font-black text-white">
              <span className="text-5xl">✅</span>
              {copy.join.qrDone}
            </div>
          )}
        </div>
        {scanner.error && <p className="mt-3 text-sm text-red-600">{scanner.error}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* header                                                             */
/* ------------------------------------------------------------------ */

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5">
      <img
        src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`}
        alt="حصاد"
        className="h-11 w-11 object-contain lg:h-12 lg:w-12"
      />
      <span className="flex flex-col items-center leading-none" style={{ color: "#b98a22" }}>
        <span className="text-[26px] font-extrabold lg:text-[30px]">حصاد</span>
        <span className="text-[11px] font-black tracking-[0.42em] lg:text-[13px]" style={{ marginInlineEnd: "-0.42em" }}>
          HASSAD
        </span>
      </span>
    </a>
  );
}

function Header({ c, lang, setLang }: { c: (typeof HOME_COPY)[LandingLang]; lang: LandingLang; setLang: (l: LandingLang) => void }) {
  const [open, setOpen] = useState(false);
  const links: [string, string, boolean?][] = [
    ["#top", c.nav.home],
    ["#games", c.nav.games],
    ["#tools", c.nav.tools],
    ["#how-it-works", c.nav.how],
    ["#contact", c.nav.contact, true],
  ];
  return (
    <div className="relative z-30 mx-auto w-full max-w-[1340px] px-3 pt-3 lg:px-0 lg:pt-11">
      <header className="flex items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/60 px-4 py-2.5 shadow-[0_10px_34px_rgba(31,122,69,0.08)] backdrop-blur-md lg:px-8 lg:py-3.5">
        <Logo />
        <nav className="hidden items-center gap-8 lg:flex">
          {links.map(([href, label, accent]) => (
            <a
              key={href}
              href={href}
              className="text-[15px] font-semibold transition-colors hover:text-emerald-700"
              style={{ color: accent ? GREEN : INK }}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-white/80"
          >
            {lang === "ar" ? "EN" : "عربي"}
          </button>
          <Link
            href="/login"
            className="hidden rounded-full px-5 py-2 text-sm font-bold text-white shadow-md sm:inline-block"
            style={{ background: GREEN_BTN }}
          >
            {c.nav.login}
          </Link>
          <Link
            href="/register?role=teacher"
            className="hidden rounded-full bg-white/80 px-5 py-2 text-sm font-bold shadow-sm sm:inline-block"
            style={{ color: INK }}
          >
            {c.nav.start}
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl p-2 text-neutral-700 hover:bg-white/80 lg:hidden"
            aria-label="menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>
      {open && (
        <div className="mt-2 rounded-3xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur-md lg:hidden">
          <nav className="flex flex-col">
            {links.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-bold" style={{ color: INK }}>
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            <Link href="/login" className="flex-1 rounded-full py-2.5 text-center text-sm font-bold text-white" style={{ background: GREEN_BTN }}>
              {c.nav.login}
            </Link>
            <Link href="/register?role=teacher" className="flex-1 rounded-full border border-neutral-200 py-2.5 text-center text-sm font-bold" style={{ color: INK }}>
              {c.nav.start}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* main component                                                     */
/* ------------------------------------------------------------------ */

export interface HomeLandingProps {
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  /** عدد المعلمين الحقيقي من إحصاءات المنصة؛ null يُخفي شارة الثقة */
  teacherCount: number | null;
  /** ظهور ألعاب الفرق في قسم الألعاب (حسب إعدادات الإدارة) */
  games: { tug: boolean; xo: boolean; rocket: boolean };
  onPlayGame: (href: string) => void;
  join: JoinProps;
  /** آراء المشتركين: تظهر فقط حين تُمرَّر آراء حقيقية */
  testimonial?: { text: string; name: string; role: string; org: string; date: string; stars: number } | null;
}

const TOOL_ICONS = [BookOpen, Brain, Presentation, Video, Pencil];

export function HomeLanding({ lang, setLang, teacherCount, games, onPlayGame, join, testimonial }: HomeLandingProps) {
  const c = HOME_COPY[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const desktop = useIsDesktop();
  const theme = useTheme();
  const [scanOpen, setScanOpen] = useState(false);
  const Forward = isRtl ? ArrowLeft : ArrowRight;

  const trust =
    teacherCount && teacherCount > 0
      ? teacherCount >= 1000
        ? `+${Math.floor(teacherCount / 1000)}k`
        : `+${teacherCount}`
      : null;

  const btnOutline =
    "inline-flex items-center justify-center rounded-full border-[1.5px] px-6 text-[15px] font-bold transition hover:bg-emerald-50";

  const gameCards = [
    { href: "/game/tug/create", src: "game-tug.jpg", on: games.tug },
    { href: "/game/xo/create", src: "game-xo.jpg", on: games.xo },
    { href: "/game/rocket/create", src: "game-rocket.jpg", on: games.rocket },
  ]
    .map((g, i) => ({ ...g, ...c.games.items[i] }))
    .filter((g) => g.on);

  return (
    <main dir={dir} className="overflow-hidden bg-white font-display" style={{ color: INK }}>
      {scanOpen && <ScannerModal join={join} copy={c} onClose={() => setScanOpen(false)} />}

      {/* ---------------------------------------------------------- 1 · HERO */}
      <section
        id="top"
        className="relative isolate overflow-hidden pb-10 lg:h-[770px] lg:pb-0"
        style={{
          background:
            "radial-gradient(900px 560px at 0% 28%, #e2f1de 0%, rgba(226,241,222,0) 72%), radial-gradient(760px 420px at 100% 0%, #fbf3dc 0%, rgba(251,243,220,0) 70%), #fcfdfb",
        }}
      >
        <Header c={c} lang={lang} setLang={setLang} />
        <div className="relative mx-auto w-full max-w-[1440px]">
          <div className="relative z-10 px-5 pb-6 pt-8 lg:w-[700px] lg:px-0 lg:ps-[75px] lg:pt-[48px]">
            <h1 className="font-extrabold leading-[1.18]">
              <span className="block text-[44px] sm:text-[52px] lg:text-[58px]" style={{ color: GREEN }}>
                {c.hero.l0}
              </span>
              <span className="block text-[27px] sm:text-[38px] lg:text-[45px]" style={{ color: INK }}>
                {c.hero.l1}
              </span>
              <span className="block text-[27px] sm:text-[38px] lg:text-[45px]" style={{ color: GREEN }}>
                {c.hero.accent}
              </span>
            </h1>
            <p className="mt-6 max-w-[520px] text-[16px] leading-[1.9] text-neutral-800 lg:mt-8 lg:text-[18px]">{c.hero.sub}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4 lg:mt-12">
              <Link
                href="/register?role=teacher"
                className="inline-flex h-[58px] items-center justify-center rounded-2xl px-9 text-[18px] font-extrabold shadow-[0_10px_26px_rgba(214,160,20,0.28)] transition hover:brightness-95"
                style={{ background: GOLD, color: "#4a3500" }}
              >
                {c.hero.start}
              </Link>
              <a
                href="#tools"
                className="inline-flex h-[58px] items-center justify-center rounded-2xl border bg-white/70 px-8 text-[18px] font-extrabold transition hover:bg-white"
                style={{ color: INK, borderColor: GREEN }}
              >
                {c.hero.tools}
              </a>
            </div>
            {trust && (
              <div className="mt-9 flex items-center gap-4 lg:mt-10">
                <img src={img("hero-people.jpg")} alt="" className="h-[72px] w-auto select-none lg:h-[84px]" style={{ mixBlendMode: "multiply" }} />
                <div className="leading-tight">
                  <div className="text-[34px] font-extrabold lg:text-[40px]" style={{ color: INK }}>
                    {trust}
                  </div>
                  <div className="max-w-[120px] text-[13px] font-semibold text-neutral-700">{c.hero.trust}</div>
                </div>
              </div>
            )}
          </div>
          <div className="pointer-events-none relative px-2 lg:absolute lg:end-0 lg:top-[-10px] lg:w-[830px] lg:px-0">
            <img
              src={img("hero.jpg")}
              alt=""
              className="mx-auto h-auto w-full max-w-[520px] select-none lg:max-w-none"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0, #000 6%, #000 90%, transparent 100%), linear-gradient(to left, transparent 0, #000 8%)",
                WebkitMaskComposite: "source-in",
                maskImage:
                  "linear-gradient(to bottom, transparent 0, #000 6%, #000 90%, transparent 100%), linear-gradient(to left, transparent 0, #000 8%)",
                maskComposite: "intersect",
              }}
            />
          </div>
        </div>
        <svg viewBox="0 0 1440 52" preserveAspectRatio="none" className="absolute -bottom-px start-0 z-[5] h-9 w-full lg:h-[52px]" aria-hidden>
          <path d="M0 52 C 520 52 900 22 1440 0 L1440 52 Z" fill="#fff" />
        </svg>
      </section>

      {/* ------------------------------------------------ 2 · WHAT CAN YOU DO */}
      <section className="relative bg-white pb-8 pt-12 lg:pb-14 lg:pt-16">
        <Watermark className="-top-6 start-0 w-[260px] lg:start-[2%] lg:w-[330px]" />
        <div className="relative mx-auto w-full max-w-[1260px] px-5 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <Title line1={c.what.t1} accent={c.what.t2} size="text-[32px] lg:text-[38px]" />
            <p className="max-w-[660px] text-[17px] leading-[1.9] text-neutral-800 lg:text-[18px]">{c.what.body}</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3 lg:mt-16 lg:gap-8">
            {[
              { icon: "icon-puzzle.png", bg: "linear-gradient(180deg,#dcf2e5 0%,rgba(232,246,238,0.5) 100%)", color: "#1b7a47" },
              { icon: "icon-map.png", bg: "linear-gradient(180deg,#fcefc6 0%,rgba(253,246,224,0.5) 100%)", color: "#d99a12" },
              { icon: "icon-trophy.png", bg: "linear-gradient(180deg,#e3eef0 0%,rgba(238,245,246,0.5) 100%)", color: "#1f4d3a" },
            ].map((card, i) => (
              <div key={card.icon} className="rounded-[26px] px-6 pb-8 pt-6 lg:min-h-[190px]" style={{ background: card.bg }}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[20px] font-extrabold leading-snug lg:text-[22px]" style={{ color: card.color }}>
                    {c.what.cards[i].title}
                  </h3>
                  <img src={img(card.icon)} alt="" className="h-[64px] w-auto shrink-0 select-none" style={{ mixBlendMode: "multiply" }} />
                </div>
                <p className="mt-3 text-[16px] leading-[1.8] text-neutral-800 lg:text-[17px]">{c.what.cards[i].desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ 3 · PRESENT & INTERACT */}
      <section className="relative bg-white pt-10 lg:pt-14">
        <h2 className="text-center text-[34px] font-extrabold lg:text-[44px]" style={{ color: INK }}>
          {c.show.title1} <span style={{ color: GREEN }}>{c.show.title2}</span>
        </h2>
        {desktop ? (
          <FitStage width={1440} height={662} dir={dir}>
            <img src={img("show-strip.jpg")} alt="" className="absolute left-0 top-0 select-none" style={{ width: 1440, height: 662 }} />
            <Box x={160} y={160} w={412} className="text-start">
              <h3 className="text-[38px] font-extrabold leading-[1.25]" style={{ color: INK }}>
                {c.show.head}
              </h3>
            </Box>
            <Box x={160} y={290} w={412} className="text-start">
              <p className="text-[19px] leading-[1.7] text-neutral-900">{c.show.body}</p>
            </Box>
            <Box x={160} y={372} w={412} className={isRtl ? "flex justify-start" : "flex justify-start"}>
              <Link
                href="/teacher/presentations/new"
                className="inline-flex h-[46px] items-center justify-center rounded-full px-8 text-[16px] font-extrabold text-white shadow-md"
                style={{ background: GREEN_BTN }}
              >
                {c.show.btn}
              </Link>
            </Box>
          </FitStage>
        ) : (
          <div className="mt-6">
            <div className="px-5" style={{ background: "linear-gradient(180deg,#e8f3e6 0%,#f4f1da 100%)", paddingTop: 28, paddingBottom: 20 }}>
              <h3 className="text-[26px] font-extrabold leading-[1.25]">{c.show.head}</h3>
              <p className="mt-3 text-[16px] leading-[1.8] text-neutral-800">{c.show.body}</p>
              <Link href="/teacher/presentations/new" className="mt-5 inline-flex h-[46px] items-center justify-center rounded-full px-7 text-[15px] font-extrabold text-white" style={{ background: GREEN_BTN }}>
                {c.show.btn}
              </Link>
            </div>
            <div className="relative h-[250px] overflow-hidden" style={{ background: "linear-gradient(180deg,#f4f1da 0%,#fff 90%)" }}>
              <img src={img("show-strip.jpg")} alt="" className="absolute right-0 top-0 h-full w-auto max-w-none select-none" />
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- 4 · TOOLS */}
      <section id="tools" className="relative bg-white pb-6 pt-14 lg:pt-20">
        {desktop ? (
          <FitStage width={1440} height={780} dir={dir}>
            <img
              src={img("tools-teacher.jpg")}
              alt=""
              className="absolute left-0 select-none"
              style={{
                top: 40,
                width: 660,
                height: 760,
                WebkitMaskImage: "linear-gradient(to right, #000 84%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 6%, #000 88%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage: "linear-gradient(to right, #000 84%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 6%, #000 88%, transparent 100%)",
                maskComposite: "intersect",
              }}
            />
            <Box x={1000} y={12} w={378} className="text-start">
              <h2 className="text-[40px] font-extrabold leading-[1.2]" style={{ color: "#12402a" }}>
                {c.tools.title}
              </h2>
            </Box>
            {c.tools.items.map((tool, i) => {
              const geo = [
                { x: 1035, y: 158 },
                { x: 660, y: 158 },
                { x: 283, y: 158 },
                { x: 1035, y: 393 },
                { x: 660, y: 393 },
              ][i];
              const Icon = TOOL_ICONS[i];
              const bg = ["#fbf6e8", "#d6f1e1", "#fbfcf9", "#e6f5ec", "#fbe5ae"][i];
              const tint = ["#c6e3dc", "#f4fbf7", "#c8ecd8", "#bfe8d0", "#f6c953"][i];
              return (
                <Box
                  key={tool.title}
                  x={geo.x}
                  y={geo.y}
                  w={338}
                  h={217}
                  className="rounded-[26px] px-[20px] pt-[18px] shadow-[0_8px_24px_rgba(20,70,45,0.07)]"
                  style={{ background: bg }}
                >
                  <div className="text-[18px] font-extrabold" style={{ color: "#1b7a47" }}>
                    {tool.title}
                  </div>
                  <div className="mt-[10px] flex items-center gap-4">
                    <p className="flex-1 text-[16px] leading-[1.6]" style={{ color: "#1d3126" }}>
                      {tool.desc}
                    </p>
                    <span className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-2xl" style={{ background: tint, color: i === 4 ? "#7a5a0a" : "#2a8a58" }}>
                      <Icon className="h-9 w-9" />
                    </span>
                  </div>
                  <Link
                    href={tool.href}
                    className="absolute inset-x-[18px] bottom-[16px] flex h-[48px] items-center justify-center rounded-full border-[1.5px] bg-white/40 text-[16px] font-bold hover:bg-white/80"
                    style={{ borderColor: i === 4 ? "#d9b052" : "#3a9a6a", color: INK }}
                  >
                    {c.tools.cta}
                  </Link>
                </Box>
              );
            })}
            <Box x={253} y={548} w={367} h={61} className="flex items-center gap-2">
              <Link
                href="/teacher/new"
                className="flex h-[61px] flex-1 items-center justify-center rounded-[18px] text-[19px] font-extrabold text-white shadow-lg"
                style={{ background: GREEN_BTN }}
              >
                {c.tools.all}
              </Link>
              <Link
                href="/teacher/new"
                aria-label={c.tools.all}
                className="flex h-[53px] w-[53px] shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: GREEN_BTN }}
              >
                <Forward className="h-6 w-6" />
              </Link>
            </Box>
          </FitStage>
        ) : (
          <div className="mx-auto max-w-[640px] px-5">
            <h2 className="text-[32px] font-extrabold leading-[1.2]" style={{ color: "#12402a" }}>
              {c.tools.title}
            </h2>
            <div className="mt-6 grid gap-4">
              {c.tools.items.map((tool, i) => {
                const Icon = TOOL_ICONS[i];
                return (
                  <div key={tool.title} className="rounded-3xl p-5" style={{ background: ["#fbf6e8", "#d6f1e1", "#f1f8f4", "#e6f5ec", "#fbe5ae"][i] }}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80" style={{ color: GREEN }}>
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="text-[19px] font-extrabold" style={{ color: "#1b7a47" }}>
                        {tool.title}
                      </span>
                    </div>
                    <p className="mt-3 text-[16px] leading-[1.7] text-neutral-800">{tool.desc}</p>
                    <Link href={tool.href} className={`${btnOutline} mt-4 h-[46px] w-full`} style={{ borderColor: "#3a9a6a", color: INK }}>
                      {c.tools.cta}
                    </Link>
                  </div>
                );
              })}
              <Link href="/teacher/new" className="flex h-[56px] items-center justify-center gap-2 rounded-2xl text-[18px] font-extrabold text-white" style={{ background: GREEN_BTN }}>
                {c.tools.all}
                <Forward className="h-5 w-5" />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- 5 · STEPS */}
      <section id="how-it-works" className="relative bg-white pb-6 pt-8 lg:pt-10">
        <div className="mx-auto w-full max-w-[1340px] px-5 lg:px-8">
          <div className="text-center">
            <h2 className="text-[30px] font-extrabold lg:text-[36px]" style={{ color: "#12402a" }}>
              {c.steps.title}
            </h2>
            <p className="mt-4 text-[17px] text-neutral-800">{c.steps.sub}</p>
          </div>
          <div
            className="mx-auto mt-10 flex max-w-[1200px] flex-col items-stretch gap-8 rounded-[32px] px-6 py-8 shadow-[0_16px_40px_rgba(20,80,50,0.07)] lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:px-14 lg:py-9"
            style={{ background: "#eef6f1" }}
          >
            {c.steps.items.map((s, i) => (
              <div key={s.title} className="flex flex-1 items-center justify-center lg:justify-start">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-start">
                  <span
                    className="mb-3 flex h-[62px] w-[62px] items-center justify-center rounded-full text-[38px] font-black"
                    style={{ background: "#cdeedd", color: "#0e2a1a" }}
                  >
                    {i + 1}
                  </span>
                  <div className="text-[30px] font-extrabold leading-tight" style={{ color: "#0e2a1a" }}>
                    {s.title}
                  </div>
                  <div className="mt-1 text-[16px] text-neutral-800">{s.desc}</div>
                </div>
                {i < 2 && (
                  <div className="mx-auto hidden items-center gap-2 px-6 lg:flex" aria-hidden>
                    <Forward className="h-9 w-9" strokeWidth={1.6} style={{ color: INK }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: INK }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- 6 · RESULTS */}
      <section className="relative bg-white pb-6 pt-10 lg:pt-6">
        {desktop ? (
          <FitStage width={1440} height={730} dir={dir}>
            <img
              src={img("results.jpg")}
              alt=""
              className="absolute select-none"
              style={{
                left: 590,
                top: 0,
                width: 850,
                height: 730,
                WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 6%), linear-gradient(to bottom, #000 82%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage: "linear-gradient(to right, transparent 0, #000 6%), linear-gradient(to bottom, #000 82%, transparent 100%)",
                maskComposite: "intersect",
              }}
            />
            <Box x={130} y={214} w={352} className="text-start">
              <h2 className="text-[40px] font-extrabold leading-[1.2]" style={{ color: INK }}>
                {c.results.title}
              </h2>
              <p className="mt-6 text-[18px] leading-[1.75] text-neutral-900">{c.results.body}</p>
              <Link
                href="/teacher/new"
                className="mt-7 inline-flex h-[46px] items-center justify-center rounded-full px-8 text-[16px] font-extrabold text-white shadow-md"
                style={{ background: GREEN_BTN }}
              >
                {c.results.btn}
              </Link>
            </Box>
          </FitStage>
        ) : (
          <div className="mx-auto max-w-[640px] px-5">
            <h2 className="text-[30px] font-extrabold leading-[1.2]">{c.results.title}</h2>
            <p className="mt-4 text-[16px] leading-[1.8] text-neutral-800">{c.results.body}</p>
            <Link href="/teacher/new" className="mt-5 inline-flex h-[46px] items-center justify-center rounded-full px-7 text-[15px] font-extrabold text-white" style={{ background: GREEN_BTN }}>
              {c.results.btn}
            </Link>
            <img src={img("results.jpg")} alt="" className="mt-6 block w-full select-none rounded-2xl" />
          </div>
        )}
      </section>

      {/* -------------------------------------------------- 7 · MOTIVATION */}
      <section className="relative bg-white pb-8 pt-8 lg:pt-4">
        {desktop ? (
          <FitStage width={1440} height={860} dir={dir}>
            <Box x={270} y={50} w={900} className="text-center">
              <h2 className="text-[38px] font-extrabold leading-[1.25]" style={{ color: INK }}>
                {c.motivation.t1} <span style={{ color: GREEN }}>{c.motivation.t2}</span>
              </h2>
            </Box>
            <Box x={340} y={130} w={760} className="text-center">
              <p className="text-[18px] leading-[1.75] text-neutral-900">{c.motivation.body}</p>
            </Box>
            <img
              src={img("motivation.jpg")}
              alt=""
              className="absolute left-0 select-none"
              style={{
                top: 210,
                width: 870,
                height: 640,
                WebkitMaskImage: "linear-gradient(to right, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 8%, #000 90%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage: "linear-gradient(to right, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 8%, #000 90%, transparent 100%)",
                maskComposite: "intersect",
              }}
            />
            {c.motivation.items.map((it, i) => {
              const y = [285, 392, 520][i];
              return (
                <div key={it.title}>
                  <Box x={860} y={y} w={380} className="text-start">
                    <div className="text-[24px] font-extrabold leading-tight" style={{ color: GREEN }}>
                      {it.title}
                    </div>
                    <p className="mt-2 text-[17px] leading-[1.6] text-neutral-800">{it.desc}</p>
                  </Box>
                  <Box x={1262} y={y + 4} className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-white" style={{ background: GREEN }}>
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </Box>
                </div>
              );
            })}
          </FitStage>
        ) : (
          <div className="mx-auto max-w-[640px] px-5">
            <h2 className="text-[28px] font-extrabold leading-[1.3]">
              {c.motivation.t1} <span style={{ color: GREEN }}>{c.motivation.t2}</span>
            </h2>
            <p className="mt-4 text-[16px] leading-[1.8] text-neutral-800">{c.motivation.body}</p>
            <img src={img("motivation.jpg")} alt="" className="mt-6 block w-full select-none" />
            <ul className="mt-6 space-y-5">
              {c.motivation.items.map((it) => (
                <li key={it.title} className="flex items-start gap-3">
                  <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: GREEN }}>
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </span>
                  <div>
                    <div className="text-[19px] font-extrabold" style={{ color: GREEN }}>
                      {it.title}
                    </div>
                    <p className="mt-1 text-[15px] leading-[1.7] text-neutral-800">{it.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- 8 · JOIN */}
      <section id="join" className="relative bg-white pb-12 pt-6 lg:pb-16">
        <Watermark className="start-[2%] top-2 hidden w-[360px] lg:block" />
        <div className="relative mx-auto w-full max-w-[1290px] px-5 lg:px-8">
          <div className="lg:w-[640px]">
            <h2 className="text-[32px] font-extrabold leading-[1.2] lg:text-[40px]" style={{ color: INK }}>
              {c.join.t1}
              <br />
              <span style={{ color: GREEN }}>{c.join.t2}</span>
            </h2>
            <p className="mt-5 text-[17px] leading-[1.8] text-neutral-800 lg:text-[18px]">{c.join.body}</p>
          </div>
          <div
            className="relative mt-8 overflow-hidden rounded-[32px] px-4 py-8 lg:mt-10 lg:rounded-[40px] lg:px-10 lg:py-[62px]"
            style={{ background: "linear-gradient(100deg,#e7c25d 0%,#f1d789 45%,#f7e6ad 100%)" }}
          >
            <span className="pointer-events-none absolute -start-8 bottom-0 h-40 w-40 rounded-full bg-white/25 blur-xl" aria-hidden />
            <span className="pointer-events-none absolute -end-6 -top-8 h-36 w-36 rounded-full bg-white/25 blur-xl" aria-hidden />
            <div className="relative flex justify-center gap-2 sm:gap-3 lg:gap-[23px]" dir="ltr">
              <PinBoxes
                join={join}
                boxClass="h-[58px] w-full min-w-0 max-w-[125px] flex-1 rounded-xl border-0 bg-[#fbf0cc]/80 text-center text-[24px] font-extrabold text-neutral-900 shadow-[0_8px_20px_rgba(120,80,0,0.12)] outline-none placeholder:text-neutral-900 focus:bg-white focus:ring-4 focus:ring-white/60 sm:h-[80px] sm:text-[34px] lg:h-[112px] lg:rounded-[18px] lg:text-[46px]"
              />
            </div>
            <div className="relative mt-7 flex items-center justify-center gap-3 lg:mt-12">
              <button
                onClick={join.onJoin}
                disabled={!join.pin.trim()}
                className="h-[56px] rounded-2xl border-[1.5px] border-white/90 bg-white/10 px-6 text-[17px] font-extrabold text-white transition enabled:hover:bg-white/25 disabled:opacity-90 lg:w-[348px] lg:text-[19px]"
              >
                {c.join.btn}
              </button>
              <button
                onClick={join.onJoin}
                aria-label={c.join.btn}
                className="flex h-[53px] w-[53px] shrink-0 items-center justify-center rounded-full bg-white/90 transition hover:bg-white"
                style={{ color: "#d9a014" }}
              >
                <Forward className="h-6 w-6" />
              </button>
            </div>
            <div className="relative mt-5 flex justify-center">
              <button onClick={() => setScanOpen(true)} className="flex items-center gap-2 text-[15px] font-bold underline-offset-4 hover:underline" style={{ color: "#5a3f00" }}>
                <Camera className="h-5 w-5" />
                {c.join.qr}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- 9 · GAMES */}
      <section id="games" className="relative pb-14 pt-16 lg:pb-0 lg:pt-20">
        {desktop ? (
          <>
            <div
              className="absolute inset-x-0 bottom-0 top-[70px]"
              style={{ background: "linear-gradient(100deg,#dbeedf 0%,#f7f0db 48%,#eaf4ee 100%)" }}
              aria-hidden
            >
              <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-x-0 -top-px h-[76px] w-full" aria-hidden>
                <path d="M0 0 H1440 V0 C 1100 8 800 76 720 76 C 520 70 250 20 0 0 Z" fill="#fff" />
              </svg>
            </div>
            <FitStage width={1440} height={720} dir={dir}>
              <Watermark className="start-[4%] top-[160px] w-[340px]" />
              <Box x={420} y={4} w={600} className="text-center">
                <Title line1={c.games.t1} accent={c.games.t2} size="text-[38px]" />
              </Box>
              {gameCards.map((g, i) => {
                const big = i === 0;
                const geo = [
                  { x: 975, y: 190, w: 392, h: 488 },
                  { x: 675, y: 303, w: 277, h: 375 },
                  { x: 375, y: 303, w: 277, h: 375 },
                ][i];
                return (
                  <Box key={g.href} x={geo.x} y={geo.y} w={geo.w} h={geo.h} className="flex flex-col rounded-[16px] bg-[#f1f8f4] p-[10px] shadow-[0_10px_28px_rgba(20,70,45,0.10)]">
                    <img src={img(g.src)} alt="" className="block w-full select-none rounded-[8px] object-cover" style={{ height: big ? 292 : 160 }} />
                    <h3 className={`px-3 font-extrabold ${big ? "mt-6 text-[22px]" : "mt-5 text-[20px]"}`}>{g.title}</h3>
                    <p className="mt-2 px-3 text-[15px] leading-[1.6] text-neutral-700">{g.desc}</p>
                    <button
                      onClick={() => onPlayGame(g.href)}
                      className={`${btnOutline} mx-3 mb-3 mt-auto h-[46px] bg-transparent`}
                      style={{ borderColor: GREEN, color: INK }}
                    >
                      {c.games.play}
                    </button>
                  </Box>
                );
              })}
              <Box x={67} y={531} w={260} className="flex flex-col gap-5">
                <Link href="/games" className="flex h-[61px] items-center justify-center rounded-2xl text-[19px] font-extrabold text-white shadow-lg" style={{ background: "#25804d" }}>
                  {c.games.more}
                </Link>
                <Link href="/public/games" className="flex h-[61px] items-center justify-center rounded-2xl text-[19px] font-extrabold shadow-lg" style={{ background: GOLD, color: "#4a3500" }}>
                  {c.games.quizzes}
                </Link>
              </Box>
            </FitStage>
          </>
        ) : (
          <div className="px-5" style={{ background: "linear-gradient(180deg,#e3f1e6 0%,#f7f0db 100%)", paddingTop: 36, paddingBottom: 36 }}>
            <Title line1={c.games.t1} accent={c.games.t2} size="text-[30px]" />
            <div className="mx-auto mt-8 grid max-w-[560px] gap-6">
              {gameCards.map((g) => (
                <article key={g.href} className="rounded-2xl bg-[#f1f8f4] p-3 pb-5 shadow-[0_10px_30px_rgba(20,70,45,0.10)]">
                  <img src={img(g.src)} alt="" className="block aspect-[1.6] w-full select-none rounded-lg object-cover" />
                  <h3 className="mt-4 px-2 text-[20px] font-extrabold">{g.title}</h3>
                  <p className="mt-2 px-2 text-[15px] text-neutral-700">{g.desc}</p>
                  <button onClick={() => onPlayGame(g.href)} className={`${btnOutline} mx-2 mt-4 h-[46px] w-[calc(100%-1rem)]`} style={{ borderColor: GREEN, color: INK }}>
                    {c.games.play}
                  </button>
                </article>
              ))}
              <Link href="/games" className="flex h-[56px] items-center justify-center rounded-2xl text-[18px] font-extrabold text-white" style={{ background: "#25804d" }}>
                {c.games.more}
              </Link>
              <Link href="/public/games" className="flex h-[56px] items-center justify-center rounded-2xl text-[18px] font-extrabold" style={{ background: GOLD, color: "#4a3500" }}>
                {c.games.quizzes}
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------- 10 · TESTIMONIAL (اختياري) */}
      {testimonial && (
        <section className="relative bg-[#fbfcfe] pb-16 pt-14 lg:pb-24">
          <div className="mx-auto w-full max-w-[1100px] px-5">
            <h2 className="text-center text-[32px] font-extrabold lg:text-[38px]">{c.testimonials.title}</h2>
            <div className="mt-12 flex flex-col gap-6 lg:flex-row">
              <div className="relative overflow-hidden rounded-3xl lg:w-[396px] lg:shrink-0">
                <img src={img("testi-photo.jpg")} alt="" className="block h-full w-full object-cover" />
                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-full bg-white px-3 py-2 text-[15px] font-extrabold">
                  <span>{testimonial.org}</span>
                  <span className="rounded-full px-3 py-1 text-xs text-white" style={{ background: GREEN }}>
                    {testimonial.date}
                  </span>
                </div>
              </div>
              <div className="relative flex-1 rounded-3xl border-2 bg-white p-8" style={{ borderColor: "#1f6b43" }}>
                <div className="flex items-start justify-between">
                  <div className="flex gap-1" style={{ color: "#1f6b43" }}>
                    {Array.from({ length: testimonial.stars }).map((_, i) => (
                      <Star key={i} className="h-6 w-6 fill-current" />
                    ))}
                  </div>
                  <Quote className="h-9 w-9 text-neutral-700" />
                </div>
                <p className="mt-5 text-[18px] leading-[1.9]">{testimonial.text}</p>
                <div className="mt-6 flex items-center gap-4">
                  <img src={img("testi-avatar.jpg")} alt="" className="h-[68px] w-[68px] rounded-full object-cover" />
                  <div>
                    <div className="text-[18px] font-extrabold">{testimonial.name}</div>
                    <div className="text-[14px] text-neutral-700">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- 11 · CTA */}
      <section className="relative bg-white px-3 pb-16 pt-14 lg:pb-24">
        {desktop ? (
          <FitStage width={1051} height={155} dir={dir}>
            <img src={img("cta-band.png")} alt="" className="absolute left-0 top-0 select-none rounded-[18px]" style={{ width: 1051, height: 155 }} />
            <Box x={640} y={14} w={380} className="text-start">
              <h2 className="text-[37px] font-extrabold leading-[1.2]" style={{ color: "#0d3320" }}>
                {c.cta.title}
              </h2>
            </Box>
            <Box x={360} y={28} w={312} className="text-start">
              <p className="text-[15px] leading-[1.65] text-neutral-800">{c.cta.body}</p>
            </Box>
            <Box x={140} y={44} w={170} className="text-center">
              <Link href="/guest/create" className="text-[14px] font-semibold text-neutral-800 underline-offset-4 hover:underline">
                {c.cta.guest}
              </Link>
            </Box>
            <Box x={84} y={85} w={223} h={44}>
              <Link href="/register?role=teacher" className="flex h-[44px] w-full items-center justify-center rounded-full text-[15px] font-extrabold text-white">
                {c.cta.btn}
              </Link>
            </Box>
          </FitStage>
        ) : (
          <div
            className="mx-auto flex max-w-[640px] flex-col items-center gap-5 rounded-[22px] px-6 py-8 text-center"
            style={{ background: "linear-gradient(95deg,#b7d1b8 0%,#d8dfc1 45%,#f9ebc4 100%)" }}
          >
            <h2 className="text-[30px] font-extrabold leading-[1.25]" style={{ color: "#0d3320" }}>
              {c.cta.title}
            </h2>
            <p className="text-[15px] leading-[1.8] text-neutral-800">{c.cta.body}</p>
            <Link href="/register?role=teacher" className="flex h-[48px] w-full max-w-[280px] items-center justify-center rounded-full text-[16px] font-extrabold text-white shadow-md" style={{ background: GREEN_BTN }}>
              {c.cta.btn}
            </Link>
            <Link href="/guest/create" className="text-[14px] font-semibold text-neutral-800 underline-offset-4 hover:underline">
              {c.cta.guest}
            </Link>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ 11 · FOOTER */}
      <footer id="contact" className="relative overflow-hidden text-white" style={{ background: "linear-gradient(100deg,#2f6b58 0%,#2a7752 45%,#257f4b 100%)" }}>
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[34px] w-full lg:h-[60px]" aria-hidden>
          <path d="M0 0 H1440 V4 C1100 6 800 56 720 58 C 520 52 250 10 0 6 Z" fill="#fff" />
        </svg>
        <Watermark className="start-[1%] top-16 w-[400px] opacity-[0.07]" />
        <div className="relative mx-auto w-full max-w-[1240px] px-6 pb-8 pt-20 lg:pt-28">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <img src={`${import.meta.env.BASE_URL}images/logo-mark-transparent.png`} alt="" className="h-14 w-14 object-contain" />
              <span className="flex flex-col items-center leading-none" style={{ color: "#e1b44e" }}>
                <span className="text-[36px] font-extrabold">حصاد</span>
                <span className="text-[16px] font-black tracking-[0.42em]" style={{ marginInlineEnd: "-0.42em" }}>
                  HASSAD
                </span>
              </span>
            </div>
            <div className="w-full max-w-[670px]">
              <div className="text-[22px] font-extrabold" style={{ color: GOLD }}>
                {c.footer.share}
              </div>
              <Link
                href="/feedback"
                className="mt-5 flex h-[56px] items-center justify-center gap-2 rounded-xl border border-white/70 px-4 text-[17px] font-extrabold shadow-lg"
                style={{ color: GOLD }}
              >
                <MessageSquarePlus className="h-5 w-5" />
                {c.footer.feedback}
              </Link>
            </div>
          </div>
          <div className="my-10 h-px w-full bg-white/30 lg:mx-auto lg:w-[calc(100%-120px)]" />
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[22px] font-bold">{c.footer.name}</div>
              <p className="mt-5 max-w-[230px] text-[15px] leading-[1.9] text-white/85">{c.footer.about}</p>
            </div>
            <div>
              <div className="text-[22px] font-bold">{c.footer.linksTitle}</div>
              <ul className="mt-5 space-y-3 text-[15px] text-white/85">
                <li><Link href="/register" className="hover:text-white">{c.footer.links[0]}</Link></li>
                <li><Link href="/login" className="hover:text-white">{c.footer.links[1]}</Link></li>
                <li><Link href="/public/games" className="hover:text-white">{c.footer.links[2]}</Link></li>
                <li><Link href="/games" className="hover:text-white">{c.footer.links[3]}</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-[22px] font-bold">{c.footer.featuresTitle}</div>
              <ul className="mt-5 space-y-3 text-[15px] text-white/85">
                {c.footer.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[22px] font-bold">{c.footer.contact}</div>
              <SocialLinksBar links={theme.socialLinks} variant="icon" tone="gold" className="mt-5" />
            </div>
          </div>
          <div className="mt-10 border-t border-white/30 pt-6 text-center text-[14px] text-white/85">
            © {new Date().getFullYear()} {c.footer.rights}
          </div>
        </div>
      </footer>
    </main>
  );
}
