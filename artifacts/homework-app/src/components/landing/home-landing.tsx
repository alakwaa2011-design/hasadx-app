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
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquarePlus,
  MousePointerClick,
  Pencil,
  Presentation,
  Quote,
  Rocket,
  Star,
  TrendingUp,
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
  games: { flags: boolean; color: boolean; memory: boolean };
  onPlayGame: (href: string) => void;
  join: JoinProps;
  /** آراء المشتركين: تظهر فقط حين تُمرَّر آراء حقيقية */
  testimonial?: { text: string; name: string; role: string; org: string; date: string; stars: number } | null;
}

export function HomeLanding({ lang, setLang, teacherCount, games, onPlayGame, join, testimonial }: HomeLandingProps) {
  const c = HOME_COPY[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const desktop = useIsDesktop();
  const theme = useTheme();
  const [scanOpen, setScanOpen] = useState(false);
  const Forward = isRtl ? ArrowLeft : ArrowRight;
  const Next = isRtl ? ChevronLeft : ChevronRight;

  const trust =
    teacherCount && teacherCount > 0
      ? teacherCount >= 1000
        ? `+${Math.floor(teacherCount / 1000)}k`
        : `+${teacherCount}`
      : null;

  const btnOutline =
    "inline-flex items-center justify-center rounded-full border-[1.5px] px-6 text-[15px] font-bold transition hover:bg-emerald-50";

  return (
    <main dir={dir} className="overflow-hidden bg-white font-display" style={{ color: INK }}>
      {scanOpen && <ScannerModal join={join} copy={c} onClose={() => setScanOpen(false)} />}

      {/* ---------------------------------------------------------- 1 · HERO */}
      <section
        id="top"
        className="relative isolate overflow-hidden"
        style={{ background: "linear-gradient(100deg,#e6f1e9 0%,#eef5ec 38%,#f7f6e4 72%,#fbf0cf 100%)" }}
      >
        <Header c={c} lang={lang} setLang={setLang} />
        <div className="relative mx-auto flex w-full max-w-[1340px] flex-col px-5 pb-24 pt-8 lg:min-h-[590px] lg:justify-start lg:px-8 lg:pb-28 lg:pt-12">
          <div className="relative z-10 w-full lg:max-w-[600px]">
            <h1 className="text-[34px] font-extrabold leading-[1.22] sm:text-[44px] lg:text-[58px] lg:leading-[1.2]" style={{ color: INK }}>
              {c.hero.l1}
              <br />
              {c.hero.l2} <span style={{ color: GREEN }}>{c.hero.accent}</span>
            </h1>
            <p className="mt-5 max-w-[470px] text-[16px] leading-[1.75] text-neutral-800 lg:mt-7 lg:text-[18px]">{c.hero.sub}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4 lg:mt-9">
              <Link
                href="/register?role=teacher"
                className="inline-flex h-[58px] items-center justify-center rounded-2xl bg-white px-9 text-[18px] font-extrabold shadow-[0_10px_30px_rgba(31,122,69,0.15)] transition hover:shadow-lg"
                style={{ color: GREEN }}
              >
                {c.hero.start}
              </Link>
              <a
                href="#tools"
                className="inline-flex h-[58px] items-center justify-center rounded-2xl border px-8 text-[18px] font-extrabold transition hover:bg-white/60"
                style={{ color: INK, borderColor: GREEN }}
              >
                {c.hero.tools}
              </a>
            </div>
            {trust && (
              <div className="mt-10 flex items-center gap-4 lg:mt-14">
                <img
                  src={img("hero-people.jpg")}
                  alt=""
                  className="h-[72px] w-auto select-none lg:h-[84px]"
                  style={{ mixBlendMode: "multiply" }}
                />
                <div className="leading-tight">
                  <div className="text-[34px] font-extrabold lg:text-[40px]" style={{ color: INK }}>
                    {trust}
                  </div>
                  <div className="text-[13px] font-semibold text-neutral-700">{c.hero.trust}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* صورة الغلاف */}
        <div className="pointer-events-none relative -mt-14 px-2 lg:absolute lg:bottom-0 lg:end-0 lg:mt-0 lg:w-[55%] lg:max-w-[790px] lg:px-0">
          <img
            src={img("hero.jpg")}
            alt=""
            className="mx-auto h-auto w-full max-w-[560px] select-none lg:max-w-none"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0, #000 10%, #000 88%, transparent 100%), linear-gradient(to left, transparent 0, #000 9%)",
              WebkitMaskComposite: "source-in",
              maskImage:
                "linear-gradient(to bottom, transparent 0, #000 10%, #000 88%, transparent 100%), linear-gradient(to left, transparent 0, #000 9%)",
              maskComposite: "intersect",
            }}
          />
        </div>
        <svg viewBox="0 0 1440 52" preserveAspectRatio="none" className="absolute -bottom-px start-0 z-[5] h-9 w-full lg:h-[52px]" aria-hidden>
          <path d="M0 52 C 520 52 900 22 1440 0 L1440 52 Z" fill="#fff" />
        </svg>
      </section>

      {/* ------------------------------------------------ 2 · WHAT IS HASAAD */}
      <section className="relative bg-white py-14 lg:py-20">
        <Watermark className="-top-6 right-0 w-[260px] lg:right-[4%] lg:w-[330px]" />
        <div className="relative mx-auto flex w-full max-w-[1340px] flex-col gap-10 px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="lg:w-[330px] lg:shrink-0">
            <Title line1={c.what.t1} accent={c.what.t2} size="text-[32px] lg:text-[36px]" />
            <p className="mt-6 text-[17px] leading-[1.9] text-neutral-800 lg:text-[18px]">{c.what.body}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:w-[850px] lg:gap-[38px]">
            {[
              { Icon: MousePointerClick, ...c.what.cards[0] },
              { Icon: TrendingUp, ...c.what.cards[1] },
              { Icon: Rocket, ...c.what.cards[2] },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-[#cfe0e6] bg-white px-5 pb-6 pt-7 text-center lg:h-[205px]">
                <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#e2f3e8]" style={{ color: GREEN }}>
                  <card.Icon className="h-6 w-6" />
                </span>
                <h3 className="text-[19px] font-extrabold">{card.title}</h3>
                <p className="mt-2 text-[16px] leading-[1.7] text-neutral-700">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- 3 · AUDIENCE */}
      <section className="relative bg-white pb-16 pt-4 lg:pb-24">
        <div className="mx-auto w-full max-w-[1340px] px-5 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <Title line1={c.audience.t1} accent={c.audience.t2} size="text-[32px] lg:text-[36px]" />
            <p className="max-w-[830px] text-[17px] leading-[1.9] text-neutral-800 lg:text-[18px]">{c.audience.body}</p>
          </div>
          <div className="mt-8 flex flex-col items-center gap-8 lg:mt-12 lg:flex-row lg:items-end lg:justify-between lg:gap-0">
            {[
              { src: "aud-teachers.png", w: 355, h: 290, right: 38, titleY: 164, descY: 204, box: 220, color: GREEN },
              { src: "aud-organizers.png", w: 445, h: 318, right: 30, titleY: 192, descY: 231, box: 275, color: "#e1a21b" },
              { src: "aud-students.png", w: 404, h: 292, right: 36, titleY: 166, descY: 190, box: 205, color: "#2d6f78" },
            ].map((it, i) => {
              const card = c.audience.cards[i];
              const u = (n: number) => `calc(${n} / ${it.w} * 100cqw)`;
              return (
                <div
                  key={it.src}
                  className="relative w-full"
                  style={{ aspectRatio: `${it.w} / ${it.h}`, maxWidth: it.w, containerType: "inline-size" }}
                >
                  <img src={img(it.src)} alt="" className="absolute inset-0 h-full w-full select-none" />
                  <h3
                    className="absolute font-extrabold leading-none"
                    style={{ right: u(it.right), top: u(it.titleY), transform: "translateY(-50%)", fontSize: u(24), color: it.color }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="absolute text-start"
                    style={{ right: u(it.right), top: u(it.descY), width: u(it.box), fontSize: u(19), lineHeight: 1.4, color: "#16241c" }}
                  >
                    {card.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ 4 · CREATE */}
      <section className="relative pb-16 pt-20 lg:pb-24 lg:pt-28" style={{ background: "linear-gradient(180deg,#d9e9e3 0%,#e9f3ee 38%,#f6faf7 100%)" }}>
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="absolute inset-x-0 -top-px h-[60px] w-full lg:h-[90px]" aria-hidden>
          <path d="M0 0 H1440 V18 Q720 150 0 18 Z" fill="#fff" />
        </svg>
        <Watermark className="start-[3%] top-24 hidden w-[300px] lg:block" />
        <Watermark className="end-[2%] top-24 hidden w-[240px] lg:block" />
        <div className="relative mx-auto w-full max-w-[1440px] px-3 lg:px-1">
          <div className="text-center">
            <Title line1={c.create.t1} accent={c.create.t2} size="text-[30px] sm:text-[40px]" className="mx-auto" />
            <p className="mt-6 text-[17px] font-bold" style={{ color: GREEN }}>
              {c.create.sub1}
            </p>
            <p className="mt-1 text-[18px] text-neutral-800">{c.create.sub2}</p>
          </div>
          <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-3 lg:gap-[33px]">
            {[
              { key: "activity", src: "shot-activity.jpg", color: GREEN, href: "/register?role=teacher", gold: false },
              { key: "video", src: "shot-video.jpg", color: "#e2a216", href: "/register?role=teacher", gold: true },
              { key: "contest", src: "shot-contest.jpg", color: GREEN, href: "/game/arena", gold: false },
            ].map((it, i) => {
              const card = c.create.cards[i];
              return (
                <article key={it.key} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_34px_rgba(20,60,40,0.10)]">
                  <img src={img(it.src)} alt="" className="block w-full select-none" />
                  <div className="flex flex-1 flex-col px-8 pb-7 pt-5">
                    <h3 className="text-[21px] font-extrabold leading-snug" style={{ color: it.color }}>
                      {card.title}
                    </h3>
                    <p className="mt-3 text-[16px] leading-[1.8] text-neutral-800">{card.desc}</p>
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {card.chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full px-4 py-1.5 text-[14px] font-medium"
                          style={it.gold ? { background: "#fdf0cf", color: "#7a5a0a" } : { background: "#e7f4ec", color: "#2f7a52" }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="relative mt-auto pt-6">
                      <Link
                        href={it.href}
                        className={`${btnOutline} h-[46px] w-full ${it.gold ? "border-transparent text-white shadow-md hover:!bg-[#e0a010]" : ""}`}
                        style={it.gold ? { background: "#eaa90e" } : { borderColor: INK, color: INK }}
                      >
                        {card.cta}
                      </Link>
                      {it.gold && (
                        <MousePointerClick className="pointer-events-none absolute -start-3 bottom-4 h-9 w-9" style={{ color: GREEN }} />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- 5 · TOOLS */}
      <section id="tools" className="relative bg-white pb-6 pt-16 lg:pt-24">
        {desktop ? (
          <FitStage width={1440} height={650} dir={dir}>
            <img
              src={img("tools-teacher.jpg")}
              alt=""
              className="absolute left-0 top-0 select-none"
              style={{
                width: 720,
                height: 640,
                WebkitMaskImage: "linear-gradient(to right, #000 82%, transparent 100%)",
                maskImage: "linear-gradient(to right, #000 82%, transparent 100%)",
              }}
            />
            <Box x={960} y={14} w={420} className="text-start">
              <h2 className="text-[40px] font-extrabold leading-[1.18]" style={{ color: "#12402a" }}>
                {c.tools.title}
              </h2>
            </Box>
            {c.tools.items.map((tool, i) => {
              const geo = [
                { x: 1043, y: 172, w: 333, h: 216 },
                { x: 667, y: 172, w: 332, h: 216 },
                { x: 285, y: 172, w: 335, h: 216 },
                { x: 1043, y: 403, w: 333, h: 217 },
                { x: 667, y: 403, w: 332, h: 217 },
              ][i];
              const Icon = [BookOpen, Brain, Presentation, Video, Pencil][i];
              const bg = ["rgba(255,255,255,0.92)", "#d6f1e1", "rgba(255,255,255,0.94)", "#bde9cf", "#fbe9c0"][i];
              const tint = ["#c9e3dc", "#ffffff", "#c6ecd6", "#f2f9f5", "#f8cf5c"][i];
              const titleColor = ["#1b7a47", "#1b7a47", "#1b7a47", "#1b7a47", "#1b7a47"][i];
              return (
                <Box key={tool.title} x={geo.x} y={geo.y} w={geo.w} h={geo.h} className="rounded-[26px] px-[18px] pt-[16px]" style={{ background: bg }}>
                  <div className="text-[19px] font-extrabold" style={{ color: titleColor }}>
                    {tool.title}
                  </div>
                  <div className="mt-[10px] flex items-center gap-4">
                    <p className="flex-1 text-[17px] leading-[1.55]" style={{ color: "#1d3126" }}>
                      {tool.desc}
                    </p>
                    <span className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-2xl" style={{ background: tint, color: i === 4 ? "#7a5a0a" : "#2a8a58" }}>
                      <Icon className="h-9 w-9" />
                    </span>
                  </div>
                  <Link
                    href={tool.href}
                    className="absolute inset-x-[16px] bottom-[16px] flex h-[48px] items-center justify-center rounded-full border-[1.5px] text-[16px] font-bold hover:bg-white/60"
                    style={{ borderColor: i === 4 ? "#d9b052" : "#3a9a6a", color: INK }}
                  >
                    {c.tools.cta}
                  </Link>
                </Box>
              );
            })}
            <Box x={258} y={547} w={366} h={61} className="flex items-center gap-2">
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
                const Icon = [BookOpen, Brain, Presentation, Video, Pencil][i];
                return (
                  <div key={tool.title} className="rounded-3xl p-5" style={{ background: ["#f1f8f4", "#d6f1e1", "#f1f8f4", "#bde9cf", "#fbe9c0"][i] }}>
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

      {/* ------------------------------------------------------- 6 · STEPS */}
      <section id="how-it-works" className="relative bg-white pb-10 pt-12 lg:pt-16">
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

      {/* -------------------------------------------------------- 7 · JOIN */}
      <section id="join" className="relative bg-white pb-10 pt-4 lg:pb-16">
        {desktop ? (
          <FitStage width={1440} height={680} dir={dir}>
            <img
              src={img("student-tablet.jpg")}
              alt=""
              className="absolute left-0 top-0 select-none"
              style={{
                width: 705,
                height: 670,
                WebkitMaskImage: "linear-gradient(to right, #000 82%, transparent 100%)",
                maskImage: "linear-gradient(to right, #000 82%, transparent 100%)",
              }}
            />
            <Box x={700} y={88} w={640} className="text-start">
              <h2 className="text-[38px] font-extrabold leading-[1.15]" style={{ color: "#12402a" }}>
                {c.join.t1}
                <br />
                <span style={{ color: GREEN }}>{c.join.t2}</span>
              </h2>
              <p className="mt-9 max-w-[625px] text-[19px] leading-[1.45] text-neutral-900">{c.join.body}</p>
            </Box>
            <div className="absolute flex gap-[23px]" style={{ left: 478, top: 297, width: 865, flexDirection: "row-reverse" }}>
              <PinBoxes
                join={join}
                boxClass="h-[112px] w-[125px] rounded-[18px] border-0 bg-white text-center text-[46px] font-extrabold text-neutral-900 shadow-[0_10px_26px_rgba(20,70,45,0.10)] outline-none placeholder:text-neutral-900 focus:ring-4 focus:ring-amber-300/60"
              />
            </div>
            <Box x={933} y={446} w={410} h={60} className="flex items-center gap-3">
              <button
                onClick={join.onJoin}
                disabled={!join.pin.trim()}
                className="h-[60px] flex-1 rounded-[16px] border-[1.5px] bg-white/90 text-[19px] font-extrabold transition enabled:hover:bg-amber-50 disabled:opacity-80"
                style={{ borderColor: GOLD, color: INK }}
              >
                {c.join.btn}
              </button>
              <button
                onClick={join.onJoin}
                aria-label={c.join.btn}
                className="flex h-[53px] w-[53px] shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: GOLD }}
              >
                <Forward className="h-6 w-6" />
              </button>
            </Box>
            <Box x={994} y={522} w={349}>
              <button onClick={() => setScanOpen(true)} className="flex items-center gap-2 text-[15px] font-bold underline-offset-4 hover:underline" style={{ color: GREEN }}>
                <Camera className="h-5 w-5" />
                {c.join.qr}
              </button>
            </Box>
          </FitStage>
        ) : (
          <div className="mx-auto max-w-[560px] px-5">
            <h2 className="text-[32px] font-extrabold leading-[1.15]" style={{ color: "#12402a" }}>
              {c.join.t1} <span style={{ color: GREEN }}>{c.join.t2}</span>
            </h2>
            <p className="mt-4 text-[17px] leading-[1.7] text-neutral-800">{c.join.body}</p>
            <div className="mt-6 grid grid-cols-6 gap-2" dir="ltr">
              <PinBoxes
                join={join}
                boxClass="aspect-[4/5] w-full min-w-0 rounded-2xl border-0 bg-white text-center text-[26px] font-extrabold text-neutral-900 shadow-[0_8px_20px_rgba(20,70,45,0.12)] outline-none placeholder:text-neutral-900 focus:ring-4 focus:ring-amber-300/60"
              />
            </div>
            <button
              onClick={join.onJoin}
              disabled={!join.pin.trim()}
              className="mt-5 h-[54px] w-full rounded-2xl border-[1.5px] bg-white text-[18px] font-extrabold disabled:opacity-80"
              style={{ borderColor: GOLD, color: INK }}
            >
              {c.join.btn}
            </button>
            <button onClick={() => setScanOpen(true)} className="mt-4 flex items-center gap-2 text-[15px] font-bold" style={{ color: GREEN }}>
              <Camera className="h-5 w-5" />
              {c.join.qr}
            </button>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- 8 · GAMES */}
      <section id="games" className="relative bg-white pb-16 pt-6 lg:pb-24">
        <Watermark className="start-[1%] top-24 hidden w-[340px] lg:block" />
        <div className="relative mx-auto w-full max-w-[1340px] px-5 lg:px-8">
          <Title line1={c.games.t1} accent={c.games.t2} size="text-[32px] lg:text-[36px]" />
          <div className="mt-10 flex flex-col gap-8 lg:mt-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-6 sm:grid-cols-3 lg:w-[900px] lg:gap-[34px]">
              {[
                { href: "/game/flags", src: "game-flags.jpg", on: games.flags },
                { href: "/game/color", src: "game-colors.jpg", on: games.color },
                { href: "/game/memory", src: "game-memory.jpg", on: games.memory },
              ]
                .map((g, i) => ({ ...g, ...c.games.items[i] }))
                .filter((g) => g.on)
                .map((g) => (
                  <article key={g.href} className="rounded-2xl bg-white p-3 pb-6 text-center shadow-[0_10px_30px_rgba(20,70,45,0.10)]">
                    <div className="overflow-hidden rounded-xl bg-[#eaf4f4] p-1.5">
                      <img src={img(g.src)} alt="" className="block w-full rounded-lg select-none" />
                    </div>
                    <h3 className="mt-6 px-3 text-start text-[20px] font-extrabold">{g.title}</h3>
                    <p className="mt-3 px-3 text-start text-[15px] text-neutral-700">{g.desc}</p>
                    <button
                      onClick={() => onPlayGame(g.href)}
                      className={`${btnOutline} mx-auto mt-5 h-[46px] w-[200px]`}
                      style={{ borderColor: GREEN, color: INK }}
                    >
                      {c.games.play}
                    </button>
                  </article>
                ))}
            </div>
            <div className="flex w-full flex-col gap-5 lg:w-[260px]">
              <Link href="/games" className="flex h-[61px] items-center justify-center rounded-2xl text-[19px] font-extrabold text-white shadow-lg" style={{ background: "#25804d" }}>
                {c.games.more}
              </Link>
              <Link href="/public/games" className="flex h-[61px] items-center justify-center rounded-2xl text-[19px] font-extrabold shadow-lg" style={{ background: GOLD, color: "#4a3500" }}>
                {c.games.quizzes}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- 9 · TESTIMONIAL (اختياري) */}
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
            <div className="mt-6 hidden justify-end gap-2" aria-hidden>
              <Next className="h-5 w-5" />
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- 10 · CTA */}
      <section className="relative bg-white px-3 pb-16 pt-6 lg:pb-24">
        {desktop ? (
          <FitStage width={1051} height={165} dir={dir}>
            <img src={img("cta-band.png")} alt="" className="absolute left-0 top-0 select-none" style={{ width: 1051, height: 165 }} />
            <Box x={618} y={34} w={400} className="text-start">
              <h2 className="text-[37px] font-extrabold leading-[1.2]" style={{ color: "#0d3320" }}>
                {c.cta.title}
              </h2>
            </Box>
            <Box x={366} y={54} w={326} className="text-start">
              <p className="text-[15px] leading-[1.65] text-neutral-800">{c.cta.body}</p>
            </Box>
            <Box x={100} y={98} w={223} h={44}>
              <Link
                href="/register?role=teacher"
                className="flex h-[44px] w-full items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                style={{ background: "#257f4b" }}
              >
                {c.cta.btn}
              </Link>
            </Box>
            <Box x={405} y={131} w={240} className="text-center">
              <Link href="/guest/create" className="text-[14px] font-semibold text-neutral-800 underline-offset-4 hover:underline">
                {c.cta.guest}
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
