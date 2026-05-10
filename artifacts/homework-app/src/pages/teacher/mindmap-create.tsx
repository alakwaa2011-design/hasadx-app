import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Loader2, RefreshCw, Printer, Copy, ArrowRight,
  Sparkles, Brain, BookOpen, Lightbulb, Zap,
  ChevronDown, Globe, Layers, CheckCheck, Home,
  ImageDown, FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const BRAND_GREEN = "#225739";
const API_BASE = "";

/* ── Colour palette for branches — works on light background ────────── */
const PALETTE = [
  { bg: "#5B5BD6", soft: "#EEF0FF", border: "#5B5BD6" },
  { bg: "#0891B2", soft: "#E0F7FA", border: "#0891B2" },
  { bg: "#059669", soft: "#D1FAE5", border: "#059669" },
  { bg: "#D97706", soft: "#FEF3C7", border: "#D97706" },
  { bg: "#DC2626", soft: "#FEE2E2", border: "#DC2626" },
  { bg: "#7C3AED", soft: "#EDE9FE", border: "#7C3AED" },
  { bg: "#EA580C", soft: "#FFEDD5", border: "#EA580C" },
  { bg: "#0369A1", soft: "#E0F2FE", border: "#0369A1" },
];

/* ── Light background colours ─────────────────────────────────────────── */
const BG_LIGHT  = "#F8FAFC";
const BG_LIGHT2 = "#F0F5F1";
const GRID_DOT  = "#CBD5E1";

/* ── Types ───────────────────────────────────────────────────────────── */
interface MindMapBranch { label: string; icon: string; color: string; children: string[] }
interface MindMap { center: string; branches: MindMapBranch[] }

/* ── SVG constants ───────────────────────────────────────────────────── */
const W = 1200;
const H = 860;
const CX = W / 2;
const CY = H / 2 + 20;
const CENTER_R = 72;
const BRANCH_DIST = 200;
const LEAF_EXTRA = 162;

function splitLines(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length <= max) { cur = next; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

/* ── SVG Mind Map Renderer ───────────────────────────────────────────── */
function MindMapSVG({ map, isAr }: { map: MindMap; isAr: boolean }) {
  const N = map.branches.length;
  if (!N) return null;

  const sector = (2 * Math.PI) / N;

  const branches = map.branches.map((b, i) => {
    const angle   = i * sector - Math.PI / 2;
    const bx      = CX + BRANCH_DIST * Math.cos(angle);
    const by      = CY + BRANCH_DIST * Math.sin(angle);
    const pal     = PALETTE[i % PALETTE.length];
    const M       = b.children.length;
    const spread  = M <= 1 ? 0 : Math.min(0.30, (sector * 0.68) / (M - 1));
    const children = b.children.map((child, j) => {
      const ca    = angle + (j - (M - 1) / 2) * spread;
      const total = BRANCH_DIST + LEAF_EXTRA;
      return { label: child, x: CX + total * Math.cos(ca), y: CY + total * Math.sin(ca) };
    });
    return { ...b, x: bx, y: by, angle, pal, children };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ fontFamily: "inherit" }}
      id="mindmap-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Background gradient */}
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={BG_LIGHT}  />
          <stop offset="100%" stopColor={BG_LIGHT2} />
        </linearGradient>
        {/* Center gradient */}
        <radialGradient id="cg" cx="38%" cy="32%" r="70%">
          <stop offset="0%"   stopColor="#2d7050" />
          <stop offset="100%" stopColor={BRAND_GREEN} />
        </radialGradient>
        {/* Soft shadow for leaf nodes */}
        <filter id="dropLeaf" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#00000022" />
        </filter>
        {/* Soft shadow for branch pills */}
        <filter id="dropBranch" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#00000028" />
        </filter>
        {/* Soft shadow for center */}
        <filter id="dropCenter" x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#22573940" />
        </filter>
      </defs>

      {/* Background */}
      <rect width={W} height={H} fill="url(#bgGrad)" rx="16" />

      {/* Subtle dot grid */}
      {Array.from({ length: 14 }, (_, r) =>
        Array.from({ length: 20 }, (_, c) => (
          <circle key={`${r}-${c}`}
            cx={30 + c * 62} cy={30 + r * 62}
            r="1.1" fill={GRID_DOT} fillOpacity="0.45"
          />
        ))
      )}

      {/* Subtle radial rings around centre */}
      {[160, 200, 370, 420].map((r, i) => (
        <circle key={i} cx={CX} cy={CY} r={r}
          fill="none" stroke="#64748B" strokeWidth="0.5"
          strokeOpacity={i < 2 ? "0.08" : "0.04"}
          strokeDasharray={i >= 2 ? "5 9" : undefined}
        />
      ))}

      {/* Connectors: centre → branch */}
      {branches.map((b, i) => (
        <path key={`c-${i}`}
          d={`M ${CX} ${CY} C ${CX + (b.x - CX) * 0.45} ${CY}, ${b.x - (b.x - CX) * 0.35} ${b.y}, ${b.x} ${b.y}`}
          stroke={b.pal.bg} strokeWidth="2.5" strokeOpacity="0.55"
          fill="none" strokeLinecap="round"
        />
      ))}

      {/* Connectors: branch → leaf */}
      {branches.map((b, i) =>
        b.children.map((ch, j) => (
          <path key={`cl-${i}-${j}`}
            d={`M ${b.x} ${b.y} Q ${(b.x + ch.x) / 2} ${(b.y + ch.y) / 2} ${ch.x} ${ch.y}`}
            stroke={b.pal.border} strokeWidth="1.5" strokeOpacity="0.35"
            fill="none" strokeLinecap="round"
          />
        ))
      )}

      {/* Leaf nodes — white card with colour accent border + dark text */}
      {branches.map((b, i) =>
        b.children.map((ch, j) => {
          const lines = splitLines(ch.label, 15);
          const rw    = Math.min(108, Math.max(54, ch.label.length * 6.2));
          const rh    = lines.length > 1 ? 30 : 22;
          return (
            <g key={`leaf-${i}-${j}`} filter="url(#dropLeaf)">
              {/* White card */}
              <rect
                x={ch.x - rw} y={ch.y - rh}
                width={rw * 2} height={rh * 2}
                rx="10"
                fill="#FFFFFF" fillOpacity="0.96"
                stroke={b.pal.border} strokeWidth="1.8"
              />
              {/* Top colour bar */}
              <rect
                x={ch.x - rw} y={ch.y - rh}
                width={rw * 2} height="3"
                rx="10" fill={b.pal.bg} fillOpacity="0.85"
              />
              {lines.map((ln, li) => (
                <text key={li}
                  x={ch.x}
                  y={ch.y + (li - (lines.length - 1) / 2) * 16 + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="12.5" fill="#1E293B" fontWeight="700"
                  direction={isAr ? "rtl" : "ltr"}
                  style={{ userSelect: "none" }}
                >
                  {ln}
                </text>
              ))}
            </g>
          );
        })
      )}

      {/* Branch nodes — vivid pill with soft colour halo + white text */}
      {branches.map((b, i) => {
        const lines   = splitLines(b.label, 11);
        const hasIcon = b.icon && b.icon.trim();
        const totalH  = hasIcon ? 62 : 50;
        return (
          <g key={`br-${i}`} filter="url(#dropBranch)">
            {/* Soft colour halo */}
            <rect
              x={b.x - 76} y={b.y - totalH / 2 - 5}
              width="152" height={totalH + 10}
              rx="24" fill={b.pal.bg} fillOpacity="0.18"
            />
            {/* Solid pill */}
            <rect
              x={b.x - 68} y={b.y - totalH / 2}
              width="136" height={totalH}
              rx="18" fill={b.pal.bg}
            />
            {/* Subtle shine */}
            <rect
              x={b.x - 68} y={b.y - totalH / 2}
              width="136" height={totalH / 2}
              rx="18" fill="white" fillOpacity="0.15"
            />
            {hasIcon && (
              <text x={b.x} y={b.y - totalH / 2 + 18}
                textAnchor="middle" dominantBaseline="middle" fontSize="15"
              >{b.icon}</text>
            )}
            {lines.map((ln, li) => (
              <text key={li}
                x={b.x}
                y={b.y + (hasIcon ? 9 : 0) + (li - (lines.length - 1) / 2) * 15}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="13" fill="#FFFFFF" fontWeight="800"
                direction={isAr ? "rtl" : "ltr"}
                style={{ userSelect: "none" }}
              >
                {ln}
              </text>
            ))}
          </g>
        );
      })}

      {/* Centre glow ring */}
      <circle cx={CX} cy={CY} r={CENTER_R + 18}
        fill={BRAND_GREEN} fillOpacity="0.14" filter="url(#dropCenter)"
      />

      {/* Centre node */}
      <circle cx={CX} cy={CY} r={CENTER_R} fill="url(#cg)" />
      <circle cx={CX} cy={CY - CENTER_R * 0.26} r={CENTER_R * 0.62}
        fill="white" fillOpacity="0.10"
      />

      {/* Centre text */}
      {splitLines(map.center, 10).map((ln, i, arr) => (
        <text key={i}
          x={CX} y={CY + (i - (arr.length - 1) / 2) * 21}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="18" fill="#FFFFFF" fontWeight="900"
          direction={isAr ? "rtl" : "ltr"}
          style={{ userSelect: "none" }}
        >
          {ln}
        </text>
      ))}
    </svg>
  );
}

/* ── Example topics ──────────────────────────────────────────────────── */
const EXAMPLES_AR = [
  "الثورة الصناعية", "الضوء وخصائصه", "النظام الشمسي", "الذكاء الاصطناعي",
  "الماء ودورته في الطبيعة", "الثورة الفرنسية", "التمثيل الضوئي", "المتحولات في الجبر",
];
const EXAMPLES_EN = [
  "Industrial Revolution", "Properties of Light", "The Solar System",
  "Photosynthesis", "World War II", "Human Body Systems",
  "Climate Change", "Artificial Intelligence",
];

const USE_CASES_AR = [
  { icon: <BookOpen className="w-6 h-6" />, title: "شرح الدروس", desc: "لخّص مفاهيم الدرس في صورة بصرية واضحة يسهل فهمها وحفظها" },
  { icon: <Brain className="w-6 h-6" />, title: "المراجعة للاختبار", desc: "حوّل الفصل الدراسي كاملاً إلى خريطة ذهنية للمراجعة السريعة" },
  { icon: <Lightbulb className="w-6 h-6" />, title: "إثارة الأفكار", desc: "استخدمها مع الطلاب لتنشيط التفكير وتوليد أفكار جديدة في الحصة" },
];
const USE_CASES_EN = [
  { icon: <BookOpen className="w-6 h-6" />, title: "Lesson Explanation", desc: "Summarise lesson concepts in a clear visual that's easy to understand and remember" },
  { icon: <Brain className="w-6 h-6" />, title: "Exam Revision", desc: "Turn an entire chapter into a mind map for quick, efficient revision" },
  { icon: <Lightbulb className="w-6 h-6" />, title: "Brainstorming", desc: "Use it with students to activate thinking and generate new ideas in class" },
];

/* ── Main page ────────────────────────────────────────────────────────── */
export default function MindMapCreate() {
  const [, setLocation]   = useLocation();
  const [topic, setTopic] = useState("");
  const [lang, setLang]   = useState<"ar" | "en">("ar");
  const [depth, setDepth] = useState<"standard" | "detailed">("standard");
  const [loading, setLoading]         = useState(false);
  const [map, setMap]                 = useState<MindMap | null>(null);
  const [copied, setCopied]           = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exporting, setExporting]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAr = lang === "ar";

  /* ── Generate ─────────────────────────────────────────────────────── */
  const generate = useCallback(async (overrideTopic?: string) => {
    const t = (overrideTopic ?? topic).trim();
    if (!t) {
      toast.error(isAr ? "أدخل موضوع الخريطة أولاً" : "Please enter a topic first");
      textareaRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/ai/generate-mindmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: t, lang, depth }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error((data as { message?: string }).message ?? (isAr ? "فشل التوليد" : "Generation failed"));
        return;
      }
      setMap(data as MindMap);
    } catch {
      toast.error(isAr ? "خطأ في الشبكة، يرجى المحاولة مجدداً" : "Network error, please try again");
    } finally {
      setLoading(false);
    }
  }, [topic, lang, depth, isAr]);

  const handleExample = (ex: string) => { setTopic(ex); generate(ex); };
  const handlePrint   = () => window.print();

  /* ── Copy as text ─────────────────────────────────────────────────── */
  const handleCopyText = () => {
    if (!map) return;
    const lines: string[] = [`📍 ${map.center}`, ""];
    map.branches.forEach((b) => {
      lines.push(`${b.icon || "●"} ${b.label}`);
      b.children.forEach((c) => lines.push(`    ├─ ${c}`));
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      toast.success(isAr ? "تم نسخ الخريطة كنص" : "Mind map copied as text");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  /* ── Export PNG (2× high-res) ─────────────────────────────────────── */
  const handleExportPng = useCallback(async () => {
    const svgEl = document.getElementById("mindmap-svg") as SVGSVGElement | null;
    if (!svgEl || !map) return;
    setExporting(true);
    try {
      const scale = 2;
      /* Clone the SVG and set explicit pixel dimensions so the browser
         renders the full viewBox instead of the CSS-shrunk display size. */
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width",  String(W));
      clone.setAttribute("height", String(H));
      const svgData = new XMLSerializer().serializeToString(clone);
      const blob    = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url     = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width  = W * scale;
          canvas.height = H * scale;
          const ctx = canvas.getContext("2d")!;
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) { reject(new Error("canvas export failed")); return; }
            const a  = document.createElement("a");
            a.href   = URL.createObjectURL(pngBlob);
            a.download = `خريطة-${map.center || "ذهنية"}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            resolve();
          }, "image/png");
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG load failed")); };
        img.src = url;
      });
      toast.success(isAr ? "تم تصدير الصورة بنجاح ✓" : "Image exported successfully ✓");
    } catch {
      toast.error(isAr ? "تعذّر تصدير الصورة" : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [map, isAr]);

  /* ── Export SVG ───────────────────────────────────────────────────── */
  const handleExportSvg = useCallback(() => {
    const svgEl = document.getElementById("mindmap-svg") as SVGSVGElement | null;
    if (!svgEl || !map) return;
    /* Same fix: explicit dimensions so the exported file has a known size. */
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width",  String(W));
    clone.setAttribute("height", String(H));
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob    = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const a       = document.createElement("a");
    a.href        = URL.createObjectURL(blob);
    a.download    = `خريطة-${map.center || "ذهنية"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast.success(isAr ? "تم تحميل ملف SVG ✓" : "SVG file downloaded ✓");
  }, [map, isAr]);

  const useCases = isAr ? USE_CASES_AR : USE_CASES_EN;
  const examples = isAr ? EXAMPLES_AR : EXAMPLES_EN;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body > *:not(#mindmap-print-area) { display: none !important; }
          #mindmap-print-area { display: block !important; position: fixed; inset: 0; background: ${BG_LIGHT}; }
          #mindmap-print-area svg { width: 100vw; height: 100vh; }
        }
      `}</style>

      {/* Hidden print target */}
      {map && (
        <div id="mindmap-print-area" style={{ display: "none" }}>
          <MindMapSVG map={map} isAr={isAr} />
        </div>
      )}

      <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">

        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setLocation("/teacher/dashboard?tab=tools")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? "الأدوات" : "Tools"}</span>
            </button>
            <div className="w-px h-5 bg-border shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND_GREEN }}>
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-foreground text-sm">
                {isAr ? "مولّد الخرائط الذهنية" : "AI Mind Map Generator"}
              </span>
            </div>
            <div className="flex-1 min-w-0" />
            <button
              onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === "ar" ? "EN" : "ع"}
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

          {/* Input card */}
          <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: BRAND_GREEN }}>
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-bold text-foreground mb-1">
                    {isAr ? "موضوع الخريطة الذهنية" : "Mind Map Topic"}
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {isAr
                      ? "أدخل عنوان الدرس أو الموضوع وسيولّد الذكاء الاصطناعي خريطة ذهنية شاملة"
                      : "Enter your lesson title or topic and AI will generate a comprehensive mind map"}
                  </p>
                  <Textarea
                    ref={textareaRef}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate(); }}
                    placeholder={isAr ? "مثال: الثورة الصناعية في أوروبا…" : "e.g. The Industrial Revolution in Europe…"}
                    className="resize-none text-base leading-relaxed"
                    rows={2}
                    maxLength={400}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{topic.length}/400</span>
                    <button
                      onClick={() => setShowAdvanced(v => !v)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {isAr ? "خيارات" : "Options"}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/50 pt-4 flex flex-wrap gap-4">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2">
                          {isAr ? "مستوى التفصيل" : "Detail Level"}
                        </p>
                        <div className="flex gap-2">
                          {(["standard", "detailed"] as const).map((d) => (
                            <button key={d} onClick={() => setDepth(d)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                depth === d ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-primary/40"
                              }`}
                              style={depth === d ? { background: BRAND_GREEN } : {}}
                            >
                              {d === "standard"
                                ? (isAr ? "⚡ عادي (4-6 فروع)" : "⚡ Standard (4-6)")
                                : (isAr ? "🔍 تفصيلي (6-8 فروع)" : "🔍 Detailed (6-8)")}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                onClick={() => generate()}
                disabled={loading || !topic.trim()}
                className="w-full h-12 text-base font-bold rounded-xl gap-2"
                style={{ background: BRAND_GREEN }}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />{isAr ? "جارٍ توليد الخريطة…" : "Generating map…"}</>
                ) : (
                  <><Brain className="w-5 h-5" />{isAr ? "توليد الخريطة الذهنية" : "Generate Mind Map"}<Zap className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Onboarding */}
            {!map && !loading && (
              <motion.div key="intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
                {/* Hero */}
                <div className="rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, #1a4429 100%)` }}>
                  <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white/5" />
                  <div className="absolute -bottom-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
                        <Brain className="w-7 h-7" />
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl font-black">
                          {isAr ? "مولّد الخرائط الذهنية بالذكاء الاصطناعي" : "AI Mind Map Generator"}
                        </h1>
                        <p className="text-white/75 text-sm">
                          {isAr ? "حوّل أي فكرة إلى خريطة بصرية في ثوانٍ" : "Turn any idea into a visual map in seconds"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        isAr ? "✅ توليد فوري بالذكاء الاصطناعي" : "✅ Instant AI generation",
                        isAr ? "🖼️ تصدير PNG & SVG" : "🖼️ Export PNG & SVG",
                        isAr ? "🖨️ قابل للطباعة" : "🖨️ Print-ready",
                        isAr ? "🌐 عربي وإنجليزي" : "🌐 Arabic & English",
                      ].map((f) => (
                        <span key={f} className="text-xs bg-white/15 px-3 py-1 rounded-full font-semibold">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Use cases */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {useCases.map((uc, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                      className="rounded-xl border border-border/60 bg-white p-4 space-y-2"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: BRAND_GREEN + "18", color: BRAND_GREEN }}>{uc.icon}</div>
                      <h3 className="font-bold text-sm text-foreground">{uc.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{uc.desc}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Steps */}
                <div className="rounded-2xl border border-border/60 bg-white p-5">
                  <h2 className="font-bold text-sm text-foreground mb-4 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" style={{ color: BRAND_GREEN }} />
                    {isAr ? "كيفية الاستخدام" : "How to Use"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(isAr ? [
                      { n: "١", t: "أدخل الموضوع", d: "اكتب عنوان الدرس أو الموضوع الذي تريد شرحه في الحقل أعلاه" },
                      { n: "٢", t: "ولّد الخريطة", d: "اضغط «توليد» وسيبني الذكاء الاصطناعي خريطة ذهنية شاملة لك" },
                      { n: "٣", t: "صدّر وشارك", d: "صدّر الخريطة كصورة PNG أو SVG أو اطبعها وشاركها مع طلابك" },
                    ] : [
                      { n: "1", t: "Enter a Topic", d: "Type your lesson title or subject you want to explain above" },
                      { n: "2", t: "Generate the Map", d: "Press 'Generate' and AI will build a comprehensive mind map for you" },
                      { n: "3", t: "Export & Share", d: "Export as PNG or SVG, or print it and share directly with your students" },
                    ]).map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0" style={{ background: BRAND_GREEN }}>{step.n}</div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{step.t}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{step.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example topics */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5" />
                    {isAr ? "جرّب أحد هذه المواضيع:" : "Try one of these topics:"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {examples.map((ex) => (
                      <button key={ex} onClick={() => handleExample(ex)} disabled={loading}
                        className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50"
                      >{ex}</button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Loading */}
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-2xl border border-border/60 bg-white overflow-hidden"
              >
                <div className="h-[520px] flex flex-col items-center justify-center gap-5">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: BRAND_GREEN + "15" }}>
                    <Brain className="w-10 h-10 animate-pulse" style={{ color: BRAND_GREEN }} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-foreground text-lg mb-1">
                      {isAr ? "جارٍ توليد الخريطة الذهنية…" : "Generating your mind map…"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isAr ? "الذكاء الاصطناعي يحلّل الموضوع ويبني الخريطة" : "AI is analysing your topic and building the map"}
                    </p>
                  </div>
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              </motion.div>
            )}

            {/* Result */}
            {map && !loading && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">

                {/* Action bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground flex-1 min-w-0 truncate">
                    {isAr ? `🎉 خريطة: ${map.center}` : `🎉 Map: ${map.center}`}
                  </span>

                  {/* Regenerate */}
                  <Button variant="outline" size="sm" onClick={() => generate()} disabled={loading} className="gap-1.5 text-xs shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isAr ? "إعادة توليد" : "Regenerate"}
                  </Button>

                  {/* Copy text */}
                  <Button variant="outline" size="sm" onClick={handleCopyText} className="gap-1.5 text-xs shrink-0">
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {isAr ? "نسخ كنص" : "Copy text"}
                  </Button>

                  {/* Export PNG */}
                  <Button
                    size="sm" onClick={handleExportPng} disabled={exporting}
                    className="gap-1.5 text-xs shrink-0 text-white"
                    style={{ background: "#4F46E5" }}
                  >
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageDown className="w-3.5 h-3.5" />}
                    {isAr ? "تصدير PNG" : "Export PNG"}
                  </Button>

                  {/* Export SVG */}
                  <Button
                    variant="outline" size="sm" onClick={handleExportSvg}
                    className="gap-1.5 text-xs shrink-0"
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    {isAr ? "تحميل SVG" : "Download SVG"}
                  </Button>

                  {/* Print */}
                  <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs text-white shrink-0" style={{ background: BRAND_GREEN }}>
                    <Printer className="w-3.5 h-3.5" />
                    {isAr ? "طباعة" : "Print"}
                  </Button>
                </div>

                {/* Export hint */}
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ImageDown className="w-3.5 h-3.5 shrink-0" />
                  {isAr
                    ? "PNG دقة عالية 2× مناسبة للطباعة والعرض — SVG قابل للتحرير في أي برنامج تصميم"
                    : "PNG is 2× high-res, great for printing and presentations — SVG is editable in any design app"}
                </p>

                {/* SVG canvas */}
                <div
                  className="rounded-2xl overflow-hidden shadow-2xl"
                  style={{ aspectRatio: `${W} / ${H}`, background: BG_LIGHT }}
                >
                  <MindMapSVG map={map} isAr={isAr} />
                </div>

                {/* Text outline */}
                <details className="rounded-xl border border-border/60 bg-white overflow-hidden">
                  <summary className="px-4 py-3 text-xs font-bold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                    {isAr ? "📋 عرض الخريطة كنص مخطّط" : "📋 View map as text outline"}
                  </summary>
                  <div className="px-4 pb-4">
                    <pre className="text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-lg p-3 mt-2" dir="auto">
                      {[`📍 ${map.center}`, "", ...map.branches.flatMap((b) => [
                        `${b.icon || "●"} ${b.label}`,
                        ...b.children.map((c) => `    ├─ ${c}`),
                        "",
                      ])].join("\n")}
                    </pre>
                  </div>
                </details>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
