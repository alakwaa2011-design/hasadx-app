import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Save,
  Play,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Loader2,
  Sparkles,
  Type,
  ListOrdered,
  HelpCircle,
  MessageSquare,
  Gamepad2,
  Image as ImageIcon,
  Video,
  Target,
  Zap,
  CheckCircle2,
  ArrowLeft,
  Palette,
  StickyNote,
  Layout as LayoutIcon,
  Share2,
  FileDown,
  Globe,
  Link2,
  Wand2,
  Crown,
} from "lucide-react";
import {
  SLIDE_THEMES,
  SLIDE_PATTERNS,
  getTheme,
  getPattern,
  isFreeTheme,
  isFreePattern,
  resolveSlideGradient,
  type CustomBackground,
} from "@/lib/slide-themes";

const API_BASE = import.meta.env.VITE_API_URL || "";

type SlideType =
  | "cover"
  | "content"
  | "bullets"
  | "quiz"
  | "activity"
  | "discussion"
  | "image"
  | "video"
  | "summary"
  | "objectives"
  | "warmup";

type Question = {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  points?: number;
};
type SlideLayout = "default" | "split-right" | "split-left";

type Slide = {
  id: string;
  type: SlideType;
  layout?: SlideLayout | null;
  title?: string | null;

  subtitle?: string | null;
  body?: string | null;
  bullets?: string[] | null;
  emoji?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  speakerNotes?: string | null;
  question?: {
    text: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: "A" | "B" | "C" | "D";
    explanation?: string | null;
  } | null;
  activity?: {
    gameType: "wameed" | "million" | "tug" | "rocket" | "memory" | "scramble";
    instructions?: string | null;
    questions: Question[];
  } | null;
  discussionPrompt?: string | null;
  discussionPoints?: string[] | null;
  /* Per-slide AI-picked background gradient. Only honoured when the
     presentation's pattern is "ai"; otherwise the theme gradient wins. */
  customBackground?: CustomBackground | null;
};

type Presentation = {
  id: number;
  title: string;
  subject: string | null;
  gradeLevel: string | null;
  theme: string;
  pattern: string;
  coverEmoji: string | null;
  description: string | null;
  slides: Slide[];
  isShared?: boolean;
};

const TYPE_META: Record<
  SlideType,
  { ar: string; en: string; icon: typeof Type; color: string }
> = {
  cover: {
    ar: "غلاف",
    en: "Cover",
    icon: LayoutIcon,
    color: "text-emerald-600",
  },
  objectives: {
    ar: "أهداف",
    en: "Objectives",
    icon: Target,
    color: "text-blue-600",
  },
  warmup: { ar: "تنشيط", en: "Warm-up", icon: Zap, color: "text-amber-600" },
  content: { ar: "محتوى", en: "Content", icon: Type, color: "text-slate-600" },
  bullets: {
    ar: "نقاط",
    en: "Bullets",
    icon: ListOrdered,
    color: "text-violet-600",
  },
  quiz: { ar: "اختبر", en: "Quiz", icon: HelpCircle, color: "text-rose-600" },
  activity: {
    ar: "نشاط",
    en: "Activity",
    icon: Gamepad2,
    color: "text-fuchsia-600",
  },
  discussion: {
    ar: "نقاش",
    en: "Discussion",
    icon: MessageSquare,
    color: "text-cyan-600",
  },
  image: { ar: "صورة", en: "Image", icon: ImageIcon, color: "text-orange-600" },
  video: { ar: "فيديو", en: "Video", icon: Video, color: "text-red-600" },
  summary: {
    ar: "ملخص",
    en: "Summary",
    icon: CheckCircle2,
    color: "text-green-600",
  },
};

function newSlide(type: SlideType): Slide {
  const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const base: Slide = { id, type, emoji: "📄", title: "", speakerNotes: "" };
  if (type === "bullets" || type === "summary" || type === "objectives")
    base.bullets = [""];
  if (type === "content" || type === "warmup") base.body = "";
  if (type === "quiz")
    base.question = {
      text: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctAnswer: "A",
      explanation: "",
    };
  if (type === "activity")
    base.activity = { gameType: "wameed", instructions: "", questions: [] };
  if (type === "discussion") {
    base.discussionPrompt = "";
    base.discussionPoints = [""];
  }
  if (type === "image") base.imageUrl = "";
  if (type === "video") base.videoUrl = "";
  return base;
}

export default function PresentationEditPage() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const [pres, setPres] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState<{
    isAdmin?: boolean;
    hasProDesign?: boolean;
  } | null>(null);
  const isPro = Boolean(
    currentTeacher?.isAdmin || currentTeacher?.hasProDesign,
  );
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Load */
  useEffect(() => {
    fetch(`${API_BASE}/api/presentations/${id}`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) {
          setLocation("/login");
          return;
        }
        if (!r.ok) throw new Error();
        const data = await r.json();
        setPres({
          ...data.presentation,
          slides: data.presentation.slides || [],
          pattern: data.presentation.pattern || "solid",
        });
      })
      .catch(() =>
        toast.error(lang === "ar" ? "تعذّر التحميل" : "Failed to load"),
      )
      .finally(() => setLoading(false));

    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(async (r) => {
        if (r.ok) setCurrentTeacher(await r.json());
      })
      .catch(() => {
        /* non-fatal */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* Auto-save (debounced 1.5s after last change) */
  const scheduleSave = () => {
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1500);
  };

  const doSave = async () => {
    if (!pres || !dirty.current) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/presentations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: pres.title,
          subject: pres.subject,
          gradeLevel: pres.gradeLevel,
          theme: pres.theme,
          pattern: pres.pattern,
          coverEmoji: pres.coverEmoji,
          description: pres.description,
          slides: pres.slides,
        }),
      });
      if (!r.ok) throw new Error();
      dirty.current = false;
    } catch {
      toast.error(lang === "ar" ? "فشل الحفظ التلقائي" : "Autosave failed");
    } finally {
      setSaving(false);
    }
  };

  const updateSlide = (idx: number, patch: Partial<Slide>) => {
    setPres((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.slice();
      slides[idx] = { ...slides[idx], ...patch };
      return { ...prev, slides };
    });
    scheduleSave();
  };

  const addSlide = (type: SlideType) => {
    setPres((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.slice();
      slides.splice(activeIdx + 1, 0, newSlide(type));
      setActiveIdx(activeIdx + 1);
      return { ...prev, slides };
    });
    scheduleSave();
    setShowAddMenu(false);
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    setPres((prev) => {
      if (!prev) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.slides.length) return prev;
      const slides = prev.slides.slice();
      [slides[idx], slides[j]] = [slides[j], slides[idx]];
      setActiveIdx(j);
      return { ...prev, slides };
    });
    scheduleSave();
  };

  const duplicateSlide = (idx: number) => {
    setPres((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.slice();
      const dup = JSON.parse(JSON.stringify(slides[idx]));
      dup.id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      slides.splice(idx + 1, 0, dup);
      setActiveIdx(idx + 1);
      return { ...prev, slides };
    });
    scheduleSave();
  };

  const deleteSlide = (idx: number) => {
    if (!confirm(lang === "ar" ? "حذف هذه الشريحة؟" : "Delete this slide?"))
      return;
    setPres((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.slice();
      slides.splice(idx, 1);
      setActiveIdx(Math.max(0, idx - 1));
      return { ...prev, slides };
    });
    scheduleSave();
  };

  const themeMeta = useMemo(() => getTheme(pres?.theme), [pres?.theme]);
  const patternMeta = useMemo(() => getPattern(pres?.pattern), [pres?.pattern]);
  const isAiPattern = pres?.pattern === "ai";

  /* ── Sharing ─────────────────────────────────────────── */
  const [sharePending, setSharePending] = useState(false);
  const toggleShare = async () => {
    if (!pres || sharePending) return;
    const next = !pres.isShared;
    setSharePending(true);
    setPres({ ...pres, isShared: next });
    try {
      const r = await fetch(`${API_BASE}/api/presentations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isShared: next }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(
        next
          ? lang === "ar"
            ? "أصبح العرض متاحاً للمشاركة"
            : "Sharing enabled"
          : lang === "ar"
            ? "تم إيقاف المشاركة"
            : "Sharing disabled",
      );
    } catch {
      /* Rollback optimistic state */
      setPres((p) => (p ? { ...p, isShared: !next } : p));
      toast.error(lang === "ar" ? "فشل تحديث المشاركة" : "Update failed");
    } finally {
      setSharePending(false);
    }
  };
  const publicUrl = pres ? `${window.location.origin}/p/${pres.id}` : "";
  const copyPublicUrl = () => {
    navigator.clipboard
      .writeText(publicUrl)
      .then(() => {
        toast.success(lang === "ar" ? "تم النسخ!" : "Copied!");
      })
      .catch(() => {
        toast.error(
          lang === "ar"
            ? "تعذّر النسخ — انسخ يدويًا"
            : "Copy failed — copy manually",
        );
      });
  };

  /* ── Export PDF (opens a new window with all slides → user prints to PDF) ── */
  const exportPDF = () => {
    if (!pres) return;
    setShowExportMenu(false);
    const themeGrad: Record<string, string> = {
      harvest: "linear-gradient(135deg,#468064,#225739 50%,#d97706)",
      ocean: "linear-gradient(135deg,#0ea5e9,#1d4ed8 50%,#3730a3)",
      sunset: "linear-gradient(135deg,#fbbf24,#f97316 50%,#e11d48)",
      midnight: "linear-gradient(135deg,#1e293b,#312e81 50%,#581c87)",
      rose: "linear-gradient(135deg,#fb7185,#ec4899 50%,#c026d3)",
      royal: "linear-gradient(135deg,#0b1d3a,#1e3a8a 50%,#b08d3a)",
      noor: "linear-gradient(135deg,#111111,#2a1f0a 50%,#a47e2c)",
      sage: "linear-gradient(135deg,#3a5a40,#588157 50%,#a3b18a)",
      sand: "linear-gradient(135deg,#7c5e3c,#b08968 50%,#e6ccb2)",
      obsidian: "linear-gradient(135deg,#0f172a,#1e293b 50%,#334155)",
    };
    const grad = themeGrad[pres.theme] || themeGrad.harvest;

    const escape = (s: string) =>
      s.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c] as string,
      );

    const slidesHtml = pres.slides
      .map((s) => {
        const emoji = escape(s.emoji || "");
        const title = escape(s.title || "");
        let body = "";
        if (s.type === "cover") {
          body = `
          <div style="text-align:center">
            <div style="font-size:120px;margin-bottom:20px">${escape(s.emoji || pres.coverEmoji || "📚")}</div>
            <h1 style="font-size:64px;font-weight:900;margin:0 0 12px">${escape(s.title || pres.title)}</h1>
            ${s.subtitle ? `<p style="font-size:24px;opacity:.9;margin:0">${escape(s.subtitle)}</p>` : ""}
          </div>`;
        } else if (
          s.type === "bullets" ||
          s.type === "objectives" ||
          s.type === "summary"
        ) {
          const items = (s.bullets || [])
            .map(
              (b) =>
                `<li style="margin:12px 0;font-size:24px">${escape(b)}</li>`,
            )
            .join("");
          body = `
          <h2 style="font-size:44px;font-weight:900;margin:0 0 24px">${emoji} ${title}</h2>
          <ul style="padding-inline-start:32px;margin:0">${items}</ul>`;
        } else if (s.type === "content" || s.type === "warmup") {
          body = `
          <h2 style="font-size:44px;font-weight:900;margin:0 0 20px">${emoji} ${title}</h2>
          <p style="font-size:24px;line-height:1.7;white-space:pre-wrap;margin:0">${escape(s.body || "")}</p>`;
        } else if (s.type === "quiz" && s.question) {
          const q = s.question;
          const opts = (["A", "B", "C", "D"] as const)
            .map((k) => {
              const isC = q.correctAnswer === k;
              return `<div style="padding:16px;border-radius:12px;background:${isC ? "rgba(22,163,74,.4)" : "rgba(255,255,255,.1)"};margin:8px 0;font-size:20px;${isC ? "font-weight:bold" : ""}">${k}. ${escape(q[`option${k}` as "optionA"] || "")}${isC ? " ✓" : ""}</div>`;
            })
            .join("");
          body = `
          <div style="font-size:18px;color:#fde047;margin-bottom:12px">❓ سؤال</div>
          <h2 style="font-size:36px;font-weight:900;margin:0 0 24px">${escape(q.text)}</h2>
          ${opts}
          ${q.explanation ? `<div style="margin-top:20px;padding:14px;background:rgba(0,0,0,.25);border-radius:10px;font-size:16px">💡 ${escape(q.explanation)}</div>` : ""}`;
        } else if (s.type === "activity" && s.activity) {
          body = `
          <div style="text-align:center">
            <div style="font-size:80px;margin-bottom:16px">🎮</div>
            <h2 style="font-size:44px;font-weight:900;margin:0 0 16px">${title || "نشاط تفاعلي"}</h2>
            <p style="font-size:22px;opacity:.9;margin:0 0 20px">${escape(s.activity.instructions || "")}</p>
            <div style="display:inline-block;padding:12px 24px;border-radius:12px;background:rgba(255,255,255,.15);font-weight:bold">
              لعبة: ${escape(s.activity.gameType)} · ${s.activity.questions.length} سؤال
            </div>
          </div>`;
        } else if (s.type === "discussion") {
          const points = (s.discussionPoints || [])
            .map(
              (p) =>
                `<li style="margin:10px 0;font-size:22px">${escape(p)}</li>`,
            )
            .join("");
          body = `
          <div style="font-size:18px;color:#fde047;margin-bottom:12px">💬 نقاش</div>
          <h2 style="font-size:38px;font-weight:900;margin:0 0 24px">${escape(s.discussionPrompt || s.title || "")}</h2>
          ${points ? `<ul style="padding-inline-start:32px">${points}</ul>` : ""}`;
        } else if (s.type === "image") {
          body = `
          <div style="text-align:center">
            ${s.imageUrl ? `<img src="${escape(s.imageUrl)}" style="max-width:100%;max-height:60vh;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.4)" />` : `<div style="font-size:80px">🖼️</div>`}
            ${title ? `<p style="margin-top:16px;font-size:20px;font-weight:bold">${title}</p>` : ""}
          </div>`;
        } else if (s.type === "video") {
          body = `
          <div style="text-align:center">
            <div style="font-size:80px;margin-bottom:16px">🎬</div>
            <h2 style="font-size:36px;font-weight:900">${title}</h2>
            ${s.videoUrl ? `<p style="margin-top:14px;font-size:14px;opacity:.8;word-break:break-all">${escape(s.videoUrl)}</p>` : ""}
          </div>`;
        } else {
          body = `<h2 style="font-size:44px;font-weight:900">${emoji} ${title}</h2>`;
        }
        return `
        <section class="slide">
          <div class="slide-inner">${body}</div>
        </section>`;
      })
      .join("");

    const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${escape(pres.title)}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Cairo', 'Segoe UI', sans-serif; color: #fff; }
    .slide { width: 100vw; height: 100vh; background: ${grad}; padding: 56px; display: flex; align-items: center; justify-content: center; page-break-after: always; }
    .slide:last-child { page-break-after: auto; }
    .slide-inner { width: 100%; max-width: 1100px; }
    @media print { .slide { width: 297mm; height: 210mm; } }
  </style>
</head>
<body>
  ${slidesHtml}
  <script>window.onload = () => { setTimeout(() => { window.print(); }, 300); };</script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=1280,height=800");
    if (!w) {
      toast.error(
        lang === "ar"
          ? "السماح بالنوافذ المنبثقة لتصدير PDF"
          : "Please allow pop-ups to export PDF",
      );
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  /* ── Export PowerPoint (pptxgenjs) ────────────────────── */
  const exportPPTX = async () => {
    if (!pres) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.title = pres.title;
      pptx.rtlMode = lang === "ar";

      /* Theme colors */
      const themeColors: Record<
        string,
        { bg1: string; bg2: string; text: string }
      > = {
        harvest: { bg1: "10B981", bg2: "F59E0B", text: "FFFFFF" },
        ocean: { bg1: "0EA5E9", bg2: "4F46E5", text: "FFFFFF" },
        sunset: { bg1: "FBBF24", bg2: "F43F5E", text: "FFFFFF" },
        midnight: { bg1: "334155", bg2: "581C87", text: "FFFFFF" },
        rose: { bg1: "FB7185", bg2: "C026D3", text: "FFFFFF" },
        royal: { bg1: "0B1D3A", bg2: "B08D3A", text: "FFFFFF" },
        noor: { bg1: "111111", bg2: "A47E2C", text: "FFFFFF" },
        sage: { bg1: "3A5A40", bg2: "A3B18A", text: "FFFFFF" },
        sand: { bg1: "7C5E3C", bg2: "E6CCB2", text: "FFFFFF" },
        obsidian: { bg1: "0F172A", bg2: "334155", text: "FFFFFF" },
      };
      const tc = themeColors[pres.theme] || themeColors.harvest;

      pres.slides.forEach((s) => {
        const slide = pptx.addSlide();
        slide.background = { color: tc.bg1 };
        /* Add a coloured stripe at the bottom */
        slide.addShape("rect", {
          x: 0,
          y: 6.7,
          w: 13.33,
          h: 0.8,
          fill: { color: tc.bg2 },
          line: { type: "none" },
        });
        const emoji = s.emoji || "📄";
        const title = s.title || "";

        if (s.type === "cover") {
          slide.addText(emoji, {
            x: 0,
            y: 1.5,
            w: 13.33,
            h: 1.5,
            fontSize: 96,
            align: "center",
            color: tc.text,
          });
          slide.addText(title || pres.title, {
            x: 0.5,
            y: 3.0,
            w: 12.33,
            h: 1.5,
            fontSize: 54,
            bold: true,
            align: "center",
            color: tc.text,
            fontFace: "Arial",
          });
          if (s.subtitle)
            slide.addText(s.subtitle, {
              x: 0.5,
              y: 4.5,
              w: 12.33,
              h: 0.7,
              fontSize: 24,
              align: "center",
              color: tc.text,
            });
        } else if (
          s.type === "bullets" ||
          s.type === "summary" ||
          s.type === "objectives"
        ) {
          slide.addText(`${emoji} ${title}`, {
            x: 0.5,
            y: 0.4,
            w: 12.33,
            h: 0.9,
            fontSize: 36,
            bold: true,
            color: tc.text,
          });
          slide.addText(
            (s.bullets || []).map((b) => ({
              text: b,
              options: { bullet: true, fontSize: 22, color: tc.text },
            })),
            { x: 0.8, y: 1.5, w: 11.5, h: 5.0, color: tc.text },
          );
        } else if (s.type === "content" || s.type === "warmup") {
          slide.addText(`${emoji} ${title}`, {
            x: 0.5,
            y: 0.4,
            w: 12.33,
            h: 0.9,
            fontSize: 36,
            bold: true,
            color: tc.text,
          });
          slide.addText(s.body || "", {
            x: 0.8,
            y: 1.7,
            w: 11.7,
            h: 4.7,
            fontSize: 22,
            color: tc.text,
          });
        } else if (s.type === "quiz" && s.question) {
          const q = s.question;
          slide.addText(`❓ ${title}`, {
            x: 0.5,
            y: 0.3,
            w: 12.33,
            h: 0.7,
            fontSize: 26,
            color: "FBBF24",
          });
          slide.addText(q.text, {
            x: 0.5,
            y: 1.1,
            w: 12.33,
            h: 1.2,
            fontSize: 30,
            bold: true,
            color: tc.text,
          });
          (["A", "B", "C", "D"] as const).forEach((k, i) => {
            const isCorrect = q.correctAnswer === k;
            slide.addText(
              `${k}.  ${q[`option${k}` as "optionA"]}${isCorrect ? "  ✓" : ""}`,
              {
                x: 0.8 + (i % 2) * 6,
                y: 2.7 + Math.floor(i / 2) * 1.5,
                w: 5.5,
                h: 1.0,
                fontSize: 20,
                color: tc.text,
                bold: isCorrect,
                fill: isCorrect
                  ? { color: "16A34A" }
                  : { color: "FFFFFF", transparency: 85 },
                align: "left",
              },
            );
          });
          if (q.explanation) {
            slide.addText(`💡 ${q.explanation}`, {
              x: 0.5,
              y: 5.8,
              w: 12.33,
              h: 0.7,
              fontSize: 16,
              color: tc.text,
              italic: true,
            });
          }
        } else if (s.type === "activity" && s.activity) {
          slide.addText(`🎮 ${title}`, {
            x: 0.5,
            y: 0.5,
            w: 12.33,
            h: 0.9,
            fontSize: 40,
            bold: true,
            color: tc.text,
          });
          slide.addText(s.activity.instructions || "", {
            x: 0.5,
            y: 1.7,
            w: 12.33,
            h: 1.5,
            fontSize: 22,
            color: tc.text,
          });
          slide.addText(
            `${lang === "ar" ? "اللعبة" : "Game"}: ${s.activity.gameType}  ·  ${s.activity.questions.length} ${lang === "ar" ? "سؤال" : "questions"}`,
            {
              x: 0.5,
              y: 5.5,
              w: 12.33,
              h: 0.7,
              fontSize: 22,
              bold: true,
              color: tc.text,
            },
          );
        } else if (s.type === "discussion") {
          slide.addText(
            `💬 ${title || (lang === "ar" ? "نقاش" : "Discussion")}`,
            { x: 0.5, y: 0.4, w: 12.33, h: 0.9, fontSize: 28, color: "FBBF24" },
          );
          slide.addText(s.discussionPrompt || "", {
            x: 0.5,
            y: 1.4,
            w: 12.33,
            h: 1.3,
            fontSize: 32,
            bold: true,
            color: tc.text,
          });
          slide.addText(
            (s.discussionPoints || []).map((p) => ({
              text: p,
              options: { bullet: true, fontSize: 20, color: tc.text },
            })),
            { x: 0.8, y: 3.0, w: 11.5, h: 3.5, color: tc.text },
          );
        } else if (s.type === "image" && s.imageUrl) {
          try {
            slide.addImage({
              path: s.imageUrl,
              x: 1,
              y: 1,
              w: 11.33,
              h: 5.5,
              sizing: { type: "contain", w: 11.33, h: 5.5 },
            });
          } catch {
            /* ignore */
          }
          if (title)
            slide.addText(title, {
              x: 0.5,
              y: 6.0,
              w: 12.33,
              h: 0.6,
              fontSize: 18,
              color: tc.text,
              align: "center",
            });
        } else if (s.type === "video") {
          slide.addText(`🎬 ${title}`, {
            x: 0.5,
            y: 0.5,
            w: 12.33,
            h: 1,
            fontSize: 36,
            bold: true,
            color: tc.text,
          });
          slide.addText(s.videoUrl || "", {
            x: 0.5,
            y: 3,
            w: 12.33,
            h: 1,
            fontSize: 18,
            color: tc.text,
            align: "center",
          });
        } else {
          slide.addText(`${emoji} ${title}`, {
            x: 0.5,
            y: 0.4,
            w: 12.33,
            h: 0.9,
            fontSize: 36,
            bold: true,
            color: tc.text,
          });
        }

        if (s.speakerNotes) slide.addNotes(s.speakerNotes);
      });

      await pptx.writeFile({
        fileName: `${pres.title || "presentation"}.pptx`,
      });
      toast.success(
        lang === "ar" ? "تم تحميل ملف PowerPoint!" : "PowerPoint downloaded!",
      );
    } catch (e) {
      console.error(e);
      toast.error(
        lang === "ar" ? "تعذّر تصدير PowerPoint" : "PowerPoint export failed",
      );
    } finally {
      setExporting(false);
    }
  };

  /* ── AI regenerate questions for the active slide ────── */
  const aiFillSlide = async () => {
    if (!pres) return;
    const slide = pres.slides[activeIdx];
    if (!slide) return;
    if (!slide.title?.trim()) {
      toast.error(
        lang === "ar" ? "اكتب عنوان الشريحة أولاً" : "Add a slide title first",
      );
      return;
    }
    setAiFilling(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/presentations/${id}/ai-fill-slide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slideId: slide.id }),
        },
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || "fail");
      }
      const data = await r.json();
      const patch = (data.patch || {}) as Partial<Slide>;
      updateSlide(activeIdx, patch);
      toast.success(lang === "ar" ? "✨ تم ملء الشريحة!" : "Slide filled!");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message !== "fail"
          ? err.message
          : lang === "ar"
            ? "تعذّر ملء الشريحة"
            : "AI fill failed",
      );
    } finally {
      setAiFilling(false);
    }
  };

  const regenerateQuestions = async () => {
    if (!pres) return;
    const slide = pres.slides[activeIdx];
    if (!slide || (slide.type !== "quiz" && slide.type !== "activity")) return;
    setRegenerating(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/presentations/${id}/regenerate-questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            slideId: slide.id,
            count:
              slide.type === "activity"
                ? Math.max(5, slide.activity?.questions.length || 5)
                : 1,
            topic: slide.title || pres.title,
          }),
        },
      );
      if (!r.ok) throw new Error();
      const data = await r.json();
      const qs = data.questions as Array<{
        text: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctAnswer: "A" | "B" | "C" | "D";
        explanation?: string | null;
      }>;
      if (slide.type === "quiz" && qs[0]) {
        updateSlide(activeIdx, {
          question: { ...qs[0], explanation: qs[0].explanation || "" },
        });
      } else if (slide.type === "activity") {
        updateSlide(activeIdx, {
          activity: {
            gameType: slide.activity?.gameType || "wameed",
            instructions: slide.activity?.instructions || "",
            questions: qs.map((q) => ({
              text: q.text,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              correctAnswer: q.correctAnswer,
            })),
          },
        });
      }
      toast.success(
        lang === "ar" ? "✨ تم توليد الأسئلة!" : "Questions regenerated!",
      );
    } catch {
      toast.error(lang === "ar" ? "تعذّر توليد الأسئلة" : "Generation failed");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading || !pres) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const active = pres.slides[activeIdx];

  return (
    <Layout noHeader>
      {/* Top toolbar */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border overflow-x-hidden">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-5 py-2 flex items-center gap-1 sm:gap-2 min-w-0">
          <Link href="/teacher/presentations">
            <button
              title={lang === "ar" ? "رجوع" : "Back"}
              className="p-2 rounded-lg hover:bg-muted shrink-0"
            >
              <ArrowLeft
                className={lang === "ar" ? "w-5 h-5 rotate-180" : "w-5 h-5"}
              />
            </button>
          </Link>

          <input
            value={pres.title}
            onChange={(e) => {
              setPres({ ...pres, title: e.target.value });
              scheduleSave();
            }}
            className="flex-1 min-w-0 bg-transparent font-bold text-sm sm:text-lg outline-none focus:bg-muted px-1.5 sm:px-2 py-1 rounded-md"
            placeholder={lang === "ar" ? "عنوان العرض" : "Title"}
          />

          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            {saving ? (
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {lang === "ar" ? "حفظ…" : "Saving…"}
              </span>
            ) : !dirty.current ? (
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
                {lang === "ar" ? "محفوظ" : "Saved"}
              </span>
            ) : null}

            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              title={lang === "ar" ? "الألوان والنمط" : "Theme & pattern"}
              className="p-2 rounded-lg hover:bg-muted"
            >
              <Palette className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowShareDialog(true)}
              title={lang === "ar" ? "مشاركة" : "Share"}
              className={`p-2 rounded-lg hover:bg-muted relative ${pres.isShared ? "text-emerald-600" : ""}`}
            >
              <Share2 className="w-4 h-4" />
              {pres.isShared && (
                <span className="absolute -top-0.5 -end-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
            </button>

            {/* Export button — visible label + large touch area */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted font-semibold text-sm transition-colors"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 text-primary" />
                )}
                <span className="hidden xs:inline">
                  {lang === "ar" ? "تصدير" : "Export"}
                </span>
              </button>

              {/* Desktop dropdown / Mobile bottom-sheet */}
              {showExportMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowExportMenu(false)}
                  />

                  {/* Bottom sheet on mobile, dropdown on desktop */}
                  <div
                    className={`
                    fixed z-50
                    sm:absolute sm:bottom-auto sm:inset-x-auto sm:mt-2 sm:w-64 sm:rounded-xl sm:shadow-2xl sm:border sm:border-border
                    bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl border-t border-border
                    bg-card p-3
                    ${lang === "ar" ? "sm:start-0" : "sm:end-0"}
                  `}
                  >
                    {/* Handle (mobile only) */}
                    <div className="sm:hidden w-10 h-1 bg-border rounded-full mx-auto mb-4" />
                    <p className="text-xs text-muted-foreground font-bold px-2 mb-2">
                      {lang === "ar"
                        ? "اختر صيغة التصدير"
                        : "Choose export format"}
                    </p>
                    <button
                      onClick={exportPDF}
                      className="w-full text-start px-4 py-3 hover:bg-muted rounded-xl flex items-center gap-3 text-sm font-medium transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                        <FileDown className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <p className="font-bold">
                          {lang === "ar" ? "تصدير PDF" : "Export PDF"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lang === "ar"
                            ? "يفتح نافذة الطباعة"
                            : "Opens print dialog"}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={exportPPTX}
                      className="w-full text-start px-4 py-3 hover:bg-muted rounded-xl flex items-center gap-3 text-sm font-medium transition-colors mt-1"
                    >
                      <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                        <FileDown className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-bold">
                          {lang === "ar"
                            ? "تصدير PowerPoint"
                            : "Export PowerPoint"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lang === "ar"
                            ? "ملف .pptx قابل للتعديل"
                            : "Editable .pptx file"}
                        </p>
                      </div>
                    </button>
                    {/* Extra padding for mobile home bar */}
                    <div className="sm:hidden h-4" />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={doSave}
              className="hidden lg:inline-flex items-center gap-1.5 bg-muted px-3 py-2 rounded-lg text-sm font-bold hover:bg-muted/80"
            >
              <Save className="w-4 h-4" />
              {lang === "ar" ? "حفظ" : "Save"}
            </button>
            <div className="inline-flex items-stretch rounded-lg shadow overflow-hidden">
              <Link href={`/teacher/presentations/${pres.id}/present`}>
                <button
                  className="inline-flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-primary to-amber-500 text-white px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-bold hover:opacity-90"
                  title={
                    lang === "ar"
                      ? "العرض من البداية"
                      : "Present from beginning"
                  }
                >
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">
                    {lang === "ar" ? "من البداية" : "From start"}
                  </span>
                  <span className="sm:hidden">
                    {lang === "ar" ? "بدء" : "Start"}
                  </span>
                </button>
              </Link>
              <Link
                href={`/teacher/presentations/${pres.id}/present?from=${activeIdx}`}
              >
                <button
                  className="inline-flex items-center gap-1 sm:gap-1.5 bg-amber-600 text-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold hover:bg-amber-700 border-s border-white/30"
                  title={
                    lang === "ar"
                      ? "العرض من الشريحة الحالية"
                      : "Present from current slide"
                  }
                >
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">
                    {lang === "ar" ? "من هنا" : "From here"}
                  </span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Theme + pattern picker dropdown */}
        {showThemePicker && (
          <div className="border-t border-border bg-card p-3 space-y-3">
            <div className="max-w-[1600px] mx-auto">
              <div className="text-xs font-bold text-muted-foreground mb-1.5">
                {lang === "ar" ? "هوية العرض" : "Color theme"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SLIDE_THEMES.map((t) => {
                  const locked = !isPro && !isFreeTheme(t.key);
                  return (
                    <button
                      key={t.key}
                      onClick={() => {
                        if (locked) {
                          toast(
                            lang === "ar"
                              ? "👑 ميزة احترافية — تواصل مع المسؤول"
                              : "👑 Pro feature — ask your admin",
                          );
                          return;
                        }
                        setPres({ ...pres, theme: t.key });
                        scheduleSave();
                      }}
                      className={`relative h-10 w-16 sm:w-20 rounded-lg overflow-hidden ring-2 transition-all ${
                        pres.theme === t.key
                          ? "ring-primary scale-105"
                          : "ring-transparent hover:ring-border"
                      } ${locked ? "opacity-70" : ""}`}
                      title={
                        locked
                          ? lang === "ar"
                            ? "ميزة احترافية"
                            : "Pro feature"
                          : undefined
                      }
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${t.grad}`}
                      />
                      <span
                        className={`relative ${t.textOnLight ? "text-slate-800" : "text-white"} text-[10px] font-bold drop-shadow flex items-center justify-center h-full`}
                      >
                        {lang === "ar" ? t.labelAr : t.labelEn}
                      </span>
                      {locked && (
                        <span className="absolute top-0.5 right-0.5 bg-amber-400 text-amber-900 rounded-full p-0.5 shadow">
                          <Crown className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="max-w-[1600px] mx-auto">
              <div className="text-xs font-bold text-muted-foreground mb-1.5">
                {lang === "ar" ? "النمط الزخرفي" : "Pattern overlay"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SLIDE_PATTERNS.map((p) => {
                  const locked = !isPro && !isFreePattern(p.key);
                  const isAi = p.key === "ai";
                  return (
                    <button
                      key={p.key}
                      onClick={() => {
                        if (locked) {
                          toast(
                            lang === "ar"
                              ? "👑 ميزة احترافية — تواصل مع المسؤول"
                              : "👑 Pro feature — ask your admin",
                          );
                          return;
                        }
                        setPres({ ...pres, pattern: p.key });
                        scheduleSave();
                      }}
                      className={`relative h-10 w-16 sm:w-20 rounded-lg overflow-hidden ring-2 transition-all ${
                        pres.pattern === p.key
                          ? "ring-primary scale-105"
                          : "ring-transparent hover:ring-border"
                      } ${locked ? "opacity-70" : ""}`}
                      title={
                        locked
                          ? lang === "ar"
                            ? "ميزة احترافية"
                            : "Pro feature"
                          : isAi
                            ? lang === "ar"
                              ? "الذكاء الاصطناعي يختار خلفية لكل شريحة"
                              : "AI picks a background per slide"
                            : undefined
                      }
                    >
                      {isAi ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500 via-violet-600 to-amber-500" />
                      ) : (
                        <>
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${themeMeta.grad}`}
                          />
                          <div className="absolute inset-0" style={p.style} />
                        </>
                      )}
                      <span
                        className={`relative ${(isAi ? false : themeMeta.textOnLight) ? "text-slate-800" : "text-white"} text-[10px] font-bold drop-shadow flex items-center justify-center h-full gap-0.5`}
                      >
                        {isAi && <Sparkles className="w-2.5 h-2.5" />}
                        {lang === "ar" ? p.labelAr : p.labelEn}
                      </span>
                      {locked && (
                        <span className="absolute top-0.5 right-0.5 bg-amber-400 text-amber-900 rounded-full p-0.5 shadow">
                          <Crown className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Editor body */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] gap-4">
          {/* Slide rail */}
          <aside className="lg:max-h-[calc(100vh-8rem)] lg:overflow-auto space-y-2">
            <div className="text-xs font-bold text-muted-foreground px-1 mb-1">
              {lang === "ar"
                ? `الشرائح (${pres.slides.length})`
                : `Slides (${pres.slides.length})`}
            </div>
            {pres.slides.map((s, i) => {
              const meta = TYPE_META[s.type] || TYPE_META.content;
              const Icon = meta.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveIdx(i)}
                  className={`w-full text-start p-2 rounded-xl border transition-all ${
                    activeIdx === i
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="text-[10px] font-bold text-muted-foreground w-5 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Icon className={`w-3 h-3 ${meta.color}`} />
                        <span className="text-[10px] text-muted-foreground">
                          {lang === "ar" ? meta.ar : meta.en}
                        </span>
                      </div>
                      <div className="text-xs font-bold line-clamp-2">
                        {s.emoji}{" "}
                        {s.title || (lang === "ar" ? "بدون عنوان" : "Untitled")}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Add slide */}
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="w-full p-3 border-2 border-dashed border-primary/40 rounded-xl text-primary hover:bg-primary/5 inline-flex items-center justify-center gap-1 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                {lang === "ar" ? "إضافة شريحة" : "Add slide"}
              </button>
              {showAddMenu && (
                <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded-xl shadow-2xl p-1 max-h-72 overflow-auto">
                  {(Object.keys(TYPE_META) as SlideType[]).map((t) => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => addSlide(t)}
                        className="w-full text-start px-3 py-2 hover:bg-muted rounded-lg flex items-center gap-2 text-sm"
                      >
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                        {lang === "ar" ? meta.ar : meta.en}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Center preview */}
          <main>
            {active && (
              <div className="space-y-3">
                {/* Slide-action toolbar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    {(() => {
                      const m = TYPE_META[active.type];
                      const I = m.icon;
                      return (
                        <>
                          <I className={`w-4 h-4 ${m.color}`} />{" "}
                          {lang === "ar" ? m.ar : m.en}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveSlide(activeIdx, -1)}
                      disabled={activeIdx === 0}
                      className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
                      title={lang === "ar" ? "أعلى" : "Up"}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveSlide(activeIdx, 1)}
                      disabled={activeIdx === pres.slides.length - 1}
                      className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
                      title={lang === "ar" ? "أسفل" : "Down"}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicateSlide(activeIdx)}
                      className="p-1.5 rounded hover:bg-muted"
                      title={lang === "ar" ? "نسخ" : "Duplicate"}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteSlide(activeIdx)}
                      disabled={pres.slides.length <= 1}
                      className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 disabled:opacity-30"
                      title={lang === "ar" ? "حذف" : "Delete"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Live preview — for the "ai" pattern, the slide can carry its
                    own per-slide gradient; otherwise the theme gradient wins. */}
                {(() => {
                  const resolved = resolveSlideGradient({
                    themeGrad: themeMeta.grad,
                    themeTextOnLight: themeMeta.textOnLight,
                    pattern: pres.pattern,
                    customBackground: active.customBackground,
                  });
                  return (
                    <SlidePreview
                      slide={active}
                      themeGrad={resolved.grad}
                      patternStyle={isAiPattern ? undefined : patternMeta.style}
                      textOnLight={resolved.textOnLight}
                      lang={lang}
                    />
                  );
                })()}
              </div>
            )}
          </main>

          {/* Right inspector */}
          <aside className="lg:max-h-[calc(100vh-8rem)] lg:overflow-auto bg-card border border-border rounded-2xl p-4 space-y-4">
            {active && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1.5">
                    {lang === "ar" ? "إيموجي" : "Emoji"}
                  </label>
                  <input
                    value={active.emoji || ""}
                    onChange={(e) =>
                      updateSlide(activeIdx, { emoji: e.target.value })
                    }
                    maxLength={4}
                    className="w-full text-2xl text-center px-2 py-1.5 border border-border rounded-lg bg-card"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1.5">
                    {lang === "ar" ? "العنوان" : "Title"}
                  </label>
                  <input
                    value={active.title || ""}
                    onChange={(e) =>
                      updateSlide(activeIdx, { title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
                  />
                </div>

                {/* AI fill slide — Claude */}
                <button
                  onClick={aiFillSlide}
                  disabled={aiFilling || !active.title?.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white text-xs font-bold shadow hover:opacity-90 disabled:opacity-50"
                  title={
                    lang === "ar"
                      ? "املأ محتوى الشريحة بناءً على العنوان"
                      : "Fill slide content from the title"
                  }
                >
                  {aiFilling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {aiFilling
                    ? lang === "ar"
                      ? "جاري الملء…"
                      : "Filling…"
                    : lang === "ar"
                      ? "املأ بالذكاء الاصطناعي"
                      : "Fill with AI"}
                </button>

                <SlideInspector
                  slide={active}
                  updateSlide={(patch) => updateSlide(activeIdx, patch)}
                  lang={lang}
                />

                {/* AI regenerate questions — visible only on quiz/activity slides */}
                {(active.type === "quiz" || active.type === "activity") && (
                  <button
                    onClick={regenerateQuestions}
                    disabled={regenerating}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white text-xs font-bold shadow hover:opacity-90 disabled:opacity-50"
                  >
                    {regenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    {regenerating
                      ? lang === "ar"
                        ? "جاري التوليد…"
                        : "Generating…"
                      : active.type === "quiz"
                        ? lang === "ar"
                          ? "ولّد سؤالاً جديداً بالذكاء الاصطناعي"
                          : "Generate question with AI"
                        : lang === "ar"
                          ? "ولّد أسئلة جديدة بالذكاء الاصطناعي"
                          : "Regenerate questions with AI"}
                  </button>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1.5 inline-flex items-center gap-1">
                    <StickyNote className="w-3 h-3" />
                    {lang === "ar" ? "ملاحظات للمعلم" : "Speaker notes"}
                  </label>
                  <textarea
                    value={active.speakerNotes || ""}
                    onChange={(e) =>
                      updateSlide(activeIdx, { speakerNotes: e.target.value })
                    }
                    rows={3}
                    placeholder={
                      lang === "ar"
                        ? "ملاحظات تظهر فقط لك أثناء العرض"
                        : "Visible only to you while presenting"
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-xs resize-none"
                  />
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {/* Share dialog */}
      {showShareDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowShareDialog(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  {lang === "ar" ? "مشاركة العرض" : "Share Presentation"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "اجعل عرضك متاحاً للجميع برابط واحد"
                    : "Make this deck publicly viewable with a single link"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border mb-3">
              <div className="flex items-center gap-2">
                <Globe
                  className={`w-5 h-5 ${pres.isShared ? "text-emerald-500" : "text-muted-foreground"}`}
                />
                <div>
                  <div className="font-bold text-sm">
                    {lang === "ar" ? "المشاركة العامة" : "Public sharing"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pres.isShared
                      ? lang === "ar"
                        ? "أي شخص لديه الرابط يمكنه المشاهدة"
                        : "Anyone with the link can view"
                      : lang === "ar"
                        ? "العرض خاص بك حالياً"
                        : "Currently private"}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleShare}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${pres.isShared ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${pres.isShared ? (lang === "ar" ? "-translate-x-6" : "translate-x-6") : "translate-x-1"}`}
                />
              </button>
            </div>

            {pres.isShared && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? "الرابط العام" : "Public link"}
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={publicUrl}
                    onClick={(e) => e.currentTarget.select()}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-mono"
                  />
                  <button
                    onClick={copyPublicUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {lang === "ar" ? "نسخ" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowShareDialog(false)}
              className="mt-5 w-full py-2.5 rounded-lg bg-muted hover:bg-muted/70 font-bold text-sm"
            >
              {lang === "ar" ? "تم" : "Done"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ─────────────────────────────────────────────
   Live slide preview
   ───────────────────────────────────────────── */
function SlidePreview({
  slide,
  themeGrad,
  patternStyle,
  textOnLight,
  lang,
}: {
  slide: Slide;
  themeGrad: string;
  patternStyle?: React.CSSProperties;
  textOnLight?: boolean;
  lang: "ar" | "en";
}) {
  const textCls = textOnLight ? "text-slate-900" : "text-white";
  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-2xl aspect-[16/9] bg-gradient-to-br ${themeGrad}`}
    >
      <div
        className={`absolute inset-0 ${textOnLight ? "bg-white/5" : "bg-black/10"}`}
      />
      {patternStyle && Object.keys(patternStyle).length > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={patternStyle}
        />
      )}
      <div
        className={`relative w-full h-full ${textCls} p-6 sm:p-10 flex flex-col`}
      >
        {slide.type === "cover" && (
          <div className="m-auto text-center">
            <div className="text-7xl sm:text-8xl mb-4 drop-shadow-lg">
              {slide.emoji || "📚"}
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold drop-shadow-lg">
              {slide.title || (lang === "ar" ? "عنوان الدرس" : "Lesson")}
            </h1>
            {slide.subtitle && (
              <p className="text-white/90 mt-2 text-base sm:text-lg">
                {slide.subtitle}
              </p>
            )}
          </div>
        )}

        {(slide.type === "objectives" ||
          slide.type === "summary" ||
          slide.type === "bullets") && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="text-4xl">{slide.emoji}</div>
              <h2 className="text-2xl sm:text-3xl font-bold">{slide.title}</h2>
            </div>
            <ul className="space-y-3 text-base sm:text-xl">
              {(slide.bullets || []).map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="bg-white/20 backdrop-blur w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {(slide.type === "content" || slide.type === "warmup") && (
          <div
            className={`flex w-full h-full gap-6 ${
              slide.layout === "split-right"
                ? "flex-row"
                : slide.layout === "split-left"
                  ? "flex-row-reverse"
                  : "flex-col"
            }`}
          >
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">{slide.emoji}</div>
                <h2 className="text-2xl sm:text-3xl font-bold">
                  {slide.title}
                </h2>
              </div>
              <p className="text-base sm:text-xl leading-relaxed whitespace-pre-wrap">
                {slide.body}
              </p>
            </div>
            {slide.imageUrl &&
              (slide.layout === "split-right" ||
                slide.layout === "split-left") && (
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title || ""}
                    className="max-h-[55vh] w-auto object-contain rounded-2xl shadow-2xl border border-white/10"
                  />
                </div>
              )}
          </div>
        )}

        {slide.type === "quiz" && slide.question && (
          <>
            <div className="flex items-center gap-2 text-amber-200 text-sm font-bold mb-3">
              <HelpCircle className="w-4 h-4" />
              {lang === "ar" ? "اختبر فهمك" : "Quick check"}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-4">
              {slide.question.text}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {(["A", "B", "C", "D"] as const).map((k) => (
                <div
                  key={k}
                  className="bg-white/15 backdrop-blur border border-white/20 rounded-xl p-3 flex items-center gap-2"
                >
                  <span className="bg-white/20 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {k}
                  </span>
                  <span className="text-sm sm:text-base">
                    {slide.question![`option${k}` as "optionA"]}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {slide.type === "activity" && slide.activity && (
          <>
            <div className="flex items-center gap-2 text-amber-200 text-sm font-bold mb-2">
              <Gamepad2 className="w-4 h-4" />
              {lang === "ar" ? "نشاط جماعي" : "Class activity"}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              {slide.title}
            </h2>
            <p className="text-sm sm:text-base text-white/90 mb-4">
              {slide.activity.instructions}
            </p>
            <div className="mt-auto bg-black/30 backdrop-blur rounded-2xl p-4 inline-flex items-center gap-3 self-start">
              <div className="text-3xl">🎮</div>
              <div>
                <div className="text-xs text-white/70">
                  {lang === "ar" ? "اللعبة" : "Game"}
                </div>
                <div className="font-bold capitalize">
                  {slide.activity.gameType} · {slide.activity.questions.length}{" "}
                  {lang === "ar" ? "سؤال" : "Qs"}
                </div>
              </div>
            </div>
          </>
        )}

        {slide.type === "discussion" && (
          <>
            <div className="flex items-center gap-2 text-amber-200 text-sm font-bold mb-3">
              <MessageSquare className="w-4 h-4" />
              {lang === "ar" ? "حوار وتفكير" : "Discussion"}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              {slide.discussionPrompt}
            </h2>
            <ul className="space-y-2 text-sm sm:text-base">
              {(slide.discussionPoints || []).map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span>•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {slide.type === "image" && (
          <div className="m-auto text-center">
            {slide.imageUrl ? (
              <img
                src={slide.imageUrl}
                alt={slide.title || ""}
                className="max-w-full max-h-[60vh] mx-auto rounded-xl"
              />
            ) : (
              <div className="text-white/60">
                {lang === "ar" ? "ضع رابط صورة" : "Set an image URL"}
              </div>
            )}
            {slide.title && <div className="mt-3 text-base">{slide.title}</div>}
          </div>
        )}

        {slide.type === "video" && (
          <div className="m-auto w-full max-w-3xl">
            {slide.videoUrl ? (
              <div className="aspect-video">
                <iframe
                  src={toEmbed(slide.videoUrl)}
                  className="w-full h-full rounded-xl"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="text-white/60 text-center">
                {lang === "ar" ? "ضع رابط فيديو يوتيوب" : "Set a YouTube URL"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function toEmbed(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be"))
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    return url;
  } catch {
    return url;
  }
}

/* ─────────────────────────────────────────────
   Right inspector — slide-type-specific fields
   ───────────────────────────────────────────── */
function SlideInspector({
  slide,
  updateSlide,
  lang,
}: {
  slide: Slide;
  updateSlide: (p: Partial<Slide>) => void;
  lang: "ar" | "en";
}) {
  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[10px] font-bold text-muted-foreground mb-1.5">
      {children}
    </label>
  );
  const cls =
    "w-full px-3 py-2 border border-border rounded-lg bg-card text-sm";

  if (slide.type === "cover") {
    return (
      <div>
        <Label>{lang === "ar" ? "العنوان الفرعي" : "Subtitle"}</Label>
        <input
          value={slide.subtitle || ""}
          onChange={(e) => updateSlide({ subtitle: e.target.value })}
          className={cls}
        />
      </div>
    );
  }
  if (slide.type === "content" || slide.type === "warmup") {
    return (
      <div className="space-y-4">
        <div>
          <Label>{lang === "ar" ? "النص" : "Body"}</Label>
          <textarea
            value={slide.body || ""}
            onChange={(e) => updateSlide({ body: e.target.value })}
            rows={5}
            className={`${cls} resize-none`}
          />
        </div>
        <div>
          <Label>
            {lang === "ar"
              ? "رابط صورة جانبية (اختياري)"
              : "Side image URL (optional)"}
          </Label>
          <input
            value={slide.imageUrl || ""}
            onChange={(e) => updateSlide({ imageUrl: e.target.value })}
            className={cls}
            placeholder="https://…"
          />
        </div>
        <div>
          <Label>{lang === "ar" ? "تخطيط الشريحة" : "Slide Layout"}</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(
              [
                {
                  id: "default",
                  Icon: LayoutIcon,
                  labelAr: "افتراضي",
                  labelEn: "Default",
                },
                {
                  id: "split-right",
                  Icon: ImageIcon,
                  labelAr: "صورة يسار",
                  labelEn: "Image Left",
                },
                {
                  id: "split-left",
                  Icon: ImageIcon,
                  labelAr: "صورة يمين",
                  labelEn: "Image Right",
                },
              ] as const
            ).map(({ id, Icon, labelAr, labelEn }) => (
              <button
                key={id}
                type="button"
                onClick={() => updateSlide({ layout: id })}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-bold transition-colors ${
                  (slide.layout || "default") === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {lang === "ar" ? labelAr : labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (
    slide.type === "bullets" ||
    slide.type === "summary" ||
    slide.type === "objectives"
  ) {
    const bullets = slide.bullets || [];
    const update = (i: number, v: string) => {
      const arr = bullets.slice();
      arr[i] = v;
      updateSlide({ bullets: arr });
    };
    const remove = (i: number) => {
      const arr = bullets.filter((_, j) => j !== i);
      updateSlide({ bullets: arr });
    };
    const add = () => updateSlide({ bullets: [...bullets, ""] });
    return (
      <div>
        <Label>{lang === "ar" ? "النقاط" : "Bullets"}</Label>
        <div className="space-y-1.5">
          {bullets.map((b, i) => (
            <div key={i} className="flex gap-1">
              <input
                value={b}
                onChange={(e) => update(i, e.target.value)}
                className={cls}
              />
              <button
                onClick={() => remove(i)}
                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={add}
            className="w-full inline-flex items-center justify-center gap-1 py-2 border border-dashed border-border rounded-lg text-xs hover:bg-muted"
          >
            <Plus className="w-3 h-3" />
            {lang === "ar" ? "إضافة نقطة" : "Add point"}
          </button>
        </div>
      </div>
    );
  }

  if (slide.type === "quiz") {
    const q = slide.question || {
      text: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctAnswer: "A" as const,
      explanation: "",
    };
    const setQ = (patch: Partial<typeof q>) =>
      updateSlide({ question: { ...q, ...patch } });
    return (
      <div className="space-y-3">
        <div>
          <Label>{lang === "ar" ? "نص السؤال" : "Question"}</Label>
          <textarea
            value={q.text}
            onChange={(e) => setQ({ text: e.target.value })}
            rows={2}
            className={`${cls} resize-none`}
          />
        </div>
        {(["A", "B", "C", "D"] as const).map((k) => (
          <div key={k}>
            <Label>{lang === "ar" ? `الخيار ${k}` : `Option ${k}`}</Label>
            <input
              value={q[`option${k}` as "optionA"]}
              onChange={(e) =>
                setQ({ [`option${k}`]: e.target.value } as never)
              }
              className={cls}
            />
          </div>
        ))}
        <div>
          <Label>{lang === "ar" ? "الإجابة الصحيحة" : "Correct"}</Label>
          <select
            value={q.correctAnswer}
            onChange={(e) =>
              setQ({ correctAnswer: e.target.value as "A" | "B" | "C" | "D" })
            }
            className={cls}
          >
            {(["A", "B", "C", "D"] as const).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>{lang === "ar" ? "شرح الإجابة" : "Explanation"}</Label>
          <textarea
            value={q.explanation || ""}
            onChange={(e) => setQ({ explanation: e.target.value })}
            rows={2}
            className={`${cls} resize-none`}
          />
        </div>
      </div>
    );
  }

  if (slide.type === "activity") {
    const a = slide.activity || {
      gameType: "wameed" as const,
      instructions: "",
      questions: [],
    };
    const setA = (patch: Partial<typeof a>) =>
      updateSlide({ activity: { ...a, ...patch } });
    const updateQ = (i: number, patch: Partial<Question>) => {
      const arr = a.questions.slice();
      arr[i] = { ...arr[i], ...patch };
      setA({ questions: arr });
    };
    const removeQ = (i: number) =>
      setA({ questions: a.questions.filter((_, j) => j !== i) });
    const addQ = () =>
      setA({
        questions: [
          ...a.questions,
          {
            text: "",
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            correctAnswer: "A",
          },
        ],
      });
    return (
      <div className="space-y-3">
        <div>
          <Label>{lang === "ar" ? "نوع اللعبة" : "Game"}</Label>
          <select
            value={a.gameType}
            onChange={(e) =>
              setA({ gameType: e.target.value as typeof a.gameType })
            }
            className={cls}
          >
            <option value="wameed">
              ⚡ {lang === "ar" ? "وميض (سؤال وجواب)" : "Wameed (Q&A)"}
            </option>
            <option value="million">
              💰 {lang === "ar" ? "من سيربح المليون" : "Million"}
            </option>
            <option value="memory">
              🧠 {lang === "ar" ? "الذاكرة" : "Memory"}
            </option>
            <option value="tug">
              🪢 {lang === "ar" ? "شد الحبل" : "Tug of War"}
            </option>
            <option value="rocket">
              🚀 {lang === "ar" ? "سباق الصواريخ" : "Rocket Race"}
            </option>
            <option value="scramble">
              🔤 {lang === "ar" ? "الكلمات المبعثرة" : "Scramble"}
            </option>
          </select>
        </div>
        <div>
          <Label>{lang === "ar" ? "تعليمات" : "Instructions"}</Label>
          <textarea
            value={a.instructions || ""}
            onChange={(e) => setA({ instructions: e.target.value })}
            rows={2}
            className={`${cls} resize-none`}
          />
        </div>
        <div>
          <Label>
            {lang === "ar"
              ? `الأسئلة (${a.questions.length})`
              : `Questions (${a.questions.length})`}
          </Label>
          <div className="space-y-2">
            {a.questions.map((q, i) => (
              <details key={i} className="border border-border rounded-lg">
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-bold flex items-center gap-1">
                  <span className="flex-1 truncate">
                    {i + 1}. {q.text || (lang === "ar" ? "(فارغ)" : "(empty)")}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeQ(i);
                    }}
                    className="text-rose-600 p-1 hover:bg-rose-50 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </summary>
                <div className="p-2 space-y-1.5">
                  <input
                    value={q.text}
                    onChange={(e) => updateQ(i, { text: e.target.value })}
                    placeholder={lang === "ar" ? "السؤال" : "Question"}
                    className={cls}
                  />
                  {(["A", "B", "C", "D"] as const).map((k) => (
                    <input
                      key={k}
                      value={q[`option${k}` as "optionA"]}
                      onChange={(e) =>
                        updateQ(i, { [`option${k}`]: e.target.value } as never)
                      }
                      placeholder={k}
                      className={cls}
                    />
                  ))}
                  <select
                    value={q.correctAnswer}
                    onChange={(e) =>
                      updateQ(i, {
                        correctAnswer: e.target.value as "A" | "B" | "C" | "D",
                      })
                    }
                    className={cls}
                  >
                    {(["A", "B", "C", "D"] as const).map((k) => (
                      <option key={k} value={k}>
                        {lang === "ar" ? `الإجابة: ${k}` : `Answer: ${k}`}
                      </option>
                    ))}
                  </select>
                </div>
              </details>
            ))}
            <button
              onClick={addQ}
              className="w-full inline-flex items-center justify-center gap-1 py-2 border border-dashed border-border rounded-lg text-xs hover:bg-muted"
            >
              <Plus className="w-3 h-3" />
              {lang === "ar" ? "إضافة سؤال" : "Add question"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (slide.type === "discussion") {
    const points = slide.discussionPoints || [];
    const update = (i: number, v: string) => {
      const arr = points.slice();
      arr[i] = v;
      updateSlide({ discussionPoints: arr });
    };
    const remove = (i: number) =>
      updateSlide({ discussionPoints: points.filter((_, j) => j !== i) });
    const add = () => updateSlide({ discussionPoints: [...points, ""] });
    return (
      <div className="space-y-3">
        <div>
          <Label>{lang === "ar" ? "سؤال النقاش" : "Discussion prompt"}</Label>
          <textarea
            value={slide.discussionPrompt || ""}
            onChange={(e) => updateSlide({ discussionPrompt: e.target.value })}
            rows={2}
            className={`${cls} resize-none`}
          />
        </div>
        <div>
          <Label>{lang === "ar" ? "محاور النقاش" : "Talking points"}</Label>
          <div className="space-y-1.5">
            {points.map((p, i) => (
              <div key={i} className="flex gap-1">
                <input
                  value={p}
                  onChange={(e) => update(i, e.target.value)}
                  className={cls}
                />
                <button
                  onClick={() => remove(i)}
                  className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={add}
              className="w-full inline-flex items-center justify-center gap-1 py-2 border border-dashed border-border rounded-lg text-xs hover:bg-muted"
            >
              <Plus className="w-3 h-3" />
              {lang === "ar" ? "إضافة" : "Add"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (slide.type === "image") {
    return (
      <div>
        <Label>{lang === "ar" ? "رابط الصورة" : "Image URL"}</Label>
        <input
          value={slide.imageUrl || ""}
          onChange={(e) => updateSlide({ imageUrl: e.target.value })}
          className={cls}
          placeholder="https://…"
        />
      </div>
    );
  }

  if (slide.type === "video") {
    return (
      <div>
        <Label>{lang === "ar" ? "رابط يوتيوب" : "YouTube URL"}</Label>
        <input
          value={slide.videoUrl || ""}
          onChange={(e) => updateSlide({ videoUrl: e.target.value })}
          className={cls}
          placeholder="https://youtube.com/…"
        />
      </div>
    );
  }

  return null;
}
