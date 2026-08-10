import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Loader2, RefreshCw, Printer, Copy, ArrowRight, ArrowLeft,
  Sparkles, Brain, BookOpen, Lightbulb, Zap,
  ChevronDown, Globe, Layers, CheckCheck, Home,
  ImageDown, FileImage,
} from "lucide-react";
import { toast } from "sonner";

const BRAND_GREEN = "#225739";
const API_BASE = "";

/* ── Colour palette for branches — works on light background ────────── */
const PALETTE = [
  { bg: "#5B5BD6", soft: "#EEF0FF", border: "#5B5BD6" },
  { bg: "#0891B2", soft: "#E0F7FA", border: "#0891B2" },
  { bg: "#2f684d", soft: "#e0ede5", border: "#2f684d" },
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

/* ── Layout constants (balanced left/right tree — no overlap possible) ── */
const H_GAP1 = 130;   // centre edge → branch pill
const H_GAP2 = 64;    // branch pill → leaf card
const LEAF_GAP = 12;  // vertical gap between sibling leaves
const BLOCK_GAP = 30; // vertical gap between branch blocks
const MARGIN = 46;    // outer canvas margin

function splitLines(text: string, max: number, maxLines = 2): string[] {
  if (text.length <= max) return [text];
  // Hard-break any single token longer than the limit so it can never
  // overflow the measured card width.
  const words = text.split(" ").flatMap((w) => {
    if (w.length <= max) return [w];
    const parts: string[] = [];
    for (const seg of Array.from(w)) {
      if (parts.length && parts[parts.length - 1].length < max) parts[parts.length - 1] += seg;
      else parts.push(seg);
    }
    return parts;
  });
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length <= max) { cur = next; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{0,2}$/, "…");
    return kept;
  }
  return lines;
}

/* Generous glyph-width estimate (Arabic-safe) */
const chW = (s: string, fs: number) => s.length * fs * 0.62;
const maxLineW = (lines: string[], fs: number) =>
  Math.max(...lines.map((l) => chW(l, fs)));

/* ── Layout engine — balanced left/right tree (XMind-style) ──────────── */
interface LeafBox { label: string; lines: string[]; w: number; h: number; y: number }
interface BranchBox {
  label: string; icon: string; pal: (typeof PALETTE)[number];
  lines: string[]; w: number; h: number; blockH: number;
  side: 1 | -1; x: number; y: number; leaves: LeafBox[];
}

function layoutMindMap(map: MindMap) {
  // 1 — measure every node
  const measured = map.branches.map((b, i) => {
    const lines = splitLines(b.label, 16);
    const hasIcon = !!(b.icon && b.icon.trim());
    const w = Math.min(250, Math.max(140, maxLineW(lines, 14.5) + (hasIcon ? 40 : 0) + 44));
    const h = lines.length > 1 ? 64 : 50;
    const leaves: LeafBox[] = b.children.map((c) => {
      const ll = splitLines(c, 22);
      return {
        label: c, lines: ll,
        w: Math.min(270, Math.max(110, maxLineW(ll, 13) + 34)),
        h: ll.length > 1 ? 54 : 40,
        y: 0,
      };
    });
    const leavesH = leaves.reduce((s, l) => s + l.h, 0) + Math.max(0, leaves.length - 1) * LEAF_GAP;
    return {
      label: b.label, icon: hasIcon ? b.icon : "",
      pal: PALETTE[i % PALETTE.length],
      lines, w, h, leaves,
      blockH: Math.max(h + 14, leavesH),
      side: 1 as 1 | -1, x: 0, y: 0,
    };
  });

  // 2 — greedy side balancing (first branch on the right for RTL reading)
  let rightH = 0, leftH = 0;
  const right: typeof measured = [], left: typeof measured = [];
  for (const m of measured) {
    if (rightH <= leftH) { m.side = 1; right.push(m); rightH += m.blockH + BLOCK_GAP; }
    else { m.side = -1; left.push(m); leftH += m.blockH + BLOCK_GAP; }
  }
  rightH -= right.length ? BLOCK_GAP : 0;
  leftH  -= left.length ? BLOCK_GAP : 0;

  // 3 — centre node size
  const cLines = splitLines(map.center, 16, 3);
  const cW = Math.min(340, Math.max(190, maxLineW(cLines, 19) + 64));
  const cH = 66 + (cLines.length - 1) * 28;

  // 4 — canvas size
  const sideW = (arr: typeof measured) =>
    arr.length ? Math.max(...arr.map((m) => m.w + H_GAP2 + Math.max(0, ...m.leaves.map((l) => l.w)))) : 0;
  const halfW = cW / 2 + H_GAP1 + Math.max(sideW(right), sideW(left), 200);
  const W = Math.ceil((halfW + MARGIN) * 2);
  const H = Math.ceil(Math.max(rightH, leftH, cH + 80) + MARGIN * 2);
  const CX = W / 2, CY = H / 2;

  // 5 — vertical stacking per side + leaf positions
  for (const [arr, total] of [[right, rightH], [left, leftH]] as const) {
    let cursor = CY - total / 2;
    for (const m of arr) {
      m.y = cursor + m.blockH / 2;
      m.x = CX + m.side * (cW / 2 + H_GAP1 + m.w / 2);
      const leavesH = m.leaves.reduce((s, l) => s + l.h, 0) + Math.max(0, m.leaves.length - 1) * LEAF_GAP;
      let ly = m.y - leavesH / 2;
      for (const l of m.leaves) { l.y = ly + l.h / 2; ly += l.h + LEAF_GAP; }
      cursor += m.blockH + BLOCK_GAP;
    }
  }

  return { W, H, CX, CY, cW, cH, cLines, branches: measured as BranchBox[] };
}

/* Smooth horizontal S-curve between two points */
const sCurve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

/* ── SVG Mind Map Renderer ───────────────────────────────────────────── */
export function MindMapSVG({ map, isAr, variant = "screen" }: { map: MindMap; isAr: boolean; variant?: "screen" | "print" }) {
  if (!map.branches.length) return null;
  const L = layoutMindMap(map);
  const { W, H, CX, CY } = L;
  /* Unique def ids per instance — the hidden print copy must not shadow the
     visible one (a filter/gradient referenced inside display:none renders
     nothing, hiding every node). */
  const uid = variant;
  const ref = (id: string) => `url(#${id}-${uid})`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block"
      style={{ fontFamily: "inherit" }}
      id={variant === "screen" ? "mindmap-svg" : "mindmap-svg-print"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`bgGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={BG_LIGHT}  />
          <stop offset="100%" stopColor={BG_LIGHT2} />
        </linearGradient>
        <linearGradient id={`cg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#2d7050" />
          <stop offset="100%" stopColor={BRAND_GREEN} />
        </linearGradient>
        <filter id={`dropLeaf-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="3" floodColor="#0000001c" />
        </filter>
        <filter id={`dropBranch-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="5" floodColor="#00000026" />
        </filter>
        <filter id={`dropCenter-${uid}`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#22573945" />
        </filter>
      </defs>

      {/* Background + subtle dot grid */}
      <rect width={W} height={H} fill={ref("bgGrad")} rx="16" />
      {Array.from({ length: Math.ceil(H / 64) }, (_, r) =>
        Array.from({ length: Math.ceil(W / 64) }, (_, c) => (
          <circle key={`${r}-${c}`} cx={32 + c * 64} cy={32 + r * 64}
            r="1.1" fill={GRID_DOT} fillOpacity="0.4" />
        ))
      )}

      {/* Connectors: centre → branch (thick, tapering into branch colour) */}
      {L.branches.map((b, i) => (
        <path key={`c-${i}`}
          d={sCurve(CX + b.side * (L.cW / 2 - 8), CY, b.x - b.side * (b.w / 2), b.y)}
          stroke={b.pal.bg} strokeWidth="3.5" strokeOpacity="0.6"
          fill="none" strokeLinecap="round"
        />
      ))}

      {/* Connectors: branch → leaf */}
      {L.branches.map((b, i) =>
        b.leaves.map((l, j) => {
          const lx = b.x + b.side * (b.w / 2 + H_GAP2 + l.w / 2);
          return (
            <path key={`cl-${i}-${j}`}
              d={sCurve(b.x + b.side * (b.w / 2), b.y, lx - b.side * (l.w / 2), l.y)}
              stroke={b.pal.border} strokeWidth="1.8" strokeOpacity="0.45"
              fill="none" strokeLinecap="round"
            />
          );
        })
      )}

      {/* Leaf cards — soft tinted card with colour accent on inner edge */}
      {L.branches.map((b, i) =>
        b.leaves.map((l, j) => {
          const lx = b.x + b.side * (b.w / 2 + H_GAP2 + l.w / 2);
          return (
            <g key={`leaf-${i}-${j}`} filter={ref("dropLeaf")}>
              <rect x={lx - l.w / 2} y={l.y - l.h / 2} width={l.w} height={l.h}
                rx="11" fill="#FFFFFF" stroke={b.pal.border} strokeWidth="1.4" strokeOpacity="0.55" />
              <rect x={lx - l.w / 2} y={l.y - l.h / 2} width={l.w} height={l.h}
                rx="11" fill={b.pal.soft} fillOpacity="0.5" />
              {/* Accent bar on the side facing the branch */}
              <rect
                x={b.side === 1 ? lx - l.w / 2 : lx + l.w / 2 - 4}
                y={l.y - l.h / 2 + 8} width="4" height={l.h - 16}
                rx="2" fill={b.pal.bg} fillOpacity="0.9"
              />
              {l.lines.map((ln, li) => (
                <text key={li} x={lx}
                  y={l.y + (li - (l.lines.length - 1) / 2) * 17 + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="13" fill="#1E293B" fontWeight="700"
                  direction={isAr ? "rtl" : "ltr"} style={{ userSelect: "none" }}
                >{ln}</text>
              ))}
            </g>
          );
        })
      )}

      {/* Branch pills — vivid colour, icon inline with label */}
      {L.branches.map((b, i) => (
        <g key={`br-${i}`} filter={ref("dropBranch")}>
          <rect x={b.x - b.w / 2 - 5} y={b.y - b.h / 2 - 5}
            width={b.w + 10} height={b.h + 10}
            rx="20" fill={b.pal.bg} fillOpacity="0.16" />
          <rect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h}
            rx="15" fill={b.pal.bg} />
          <rect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h / 2}
            rx="15" fill="white" fillOpacity="0.14" />
          {b.lines.map((ln, li) => (
            <text key={li} x={b.x}
              y={b.y + (li - (b.lines.length - 1) / 2) * 18}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="14.5" fill="#FFFFFF" fontWeight="800"
              direction={isAr ? "rtl" : "ltr"} style={{ userSelect: "none" }}
            >{li === 0 && b.icon ? `${b.icon} ${ln}` : ln}</text>
          ))}
        </g>
      ))}

      {/* Centre node — rounded rectangle */}
      <g filter={ref("dropCenter")}>
        <rect x={CX - L.cW / 2 - 7} y={CY - L.cH / 2 - 7}
          width={L.cW + 14} height={L.cH + 14}
          rx="26" fill={BRAND_GREEN} fillOpacity="0.15" />
        <rect x={CX - L.cW / 2} y={CY - L.cH / 2} width={L.cW} height={L.cH}
          rx="20" fill={ref("cg")} />
        <rect x={CX - L.cW / 2} y={CY - L.cH / 2} width={L.cW} height={L.cH / 2}
          rx="20" fill="white" fillOpacity="0.10" />
        {L.cLines.map((ln, i) => (
          <text key={i} x={CX}
            y={CY + (i - (L.cLines.length - 1) / 2) * 24}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="19" fill="#FFFFFF" fontWeight="900"
            direction={isAr ? "rtl" : "ltr"} style={{ userSelect: "none" }}
          >{ln}</text>
        ))}
      </g>
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
  { icon: <BookOpen className="w-5 h-5" />, title: "شرح الدروس", desc: "لخّص مفاهيم الدرس في صورة بصرية واضحة يسهل فهمها وحفظها" },
  { icon: <Brain className="w-5 h-5" />, title: "المراجعة للاختبار", desc: "حوّل الفصل الدراسي كاملاً إلى خريطة ذهنية للمراجعة السريعة" },
  { icon: <Lightbulb className="w-5 h-5" />, title: "إثارة الأفكار", desc: "استخدمها مع الطلاب لتنشيط التفكير وتوليد أفكار جديدة في الحصة" },
];
const USE_CASES_EN = [
  { icon: <BookOpen className="w-5 h-5" />, title: "Lesson Explanation", desc: "Summarise lesson concepts in a clear visual that's easy to understand and remember" },
  { icon: <Brain className="w-5 h-5" />, title: "Exam Revision", desc: "Turn an entire chapter into a mind map for quick, efficient revision" },
  { icon: <Lightbulb className="w-5 h-5" />, title: "Brainstorming", desc: "Use it with students to activate thinking and generate new ideas in class" },
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
  const [exporting, setExporting]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";

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

  /* ── Print / PDF — isolated iframe so app CSS can't blank the page ── */
  const handlePrint = useCallback(() => {
    const svgEl = document.getElementById("mindmap-svg") as SVGSVGElement | null;
    if (!svgEl || !map) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute("class");
    clone.setAttribute("style", "width:100%;height:auto;max-height:100vh;display:block");
    const html = `<!doctype html><html dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8">
      <title>${map.center || (isAr ? "خريطة ذهنية" : "Mind map")}</title>
      <style>@page{size:landscape;margin:8mm}body{margin:0;font-family:system-ui,sans-serif;background:${BG_LIGHT}}</style>
      </head><body>${new XMLSerializer().serializeToString(clone)}</body></html>`;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:100%;bottom:100%;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60000);
    }, 250);
  }, [map, isAr]);

  /* ── Copy as text ─────────────────────────────────────────────────── */
  const handleCopyText = () => {
    if (!map) return;
    const lines: string[] = [`- ${map.center}`, ""];
    map.branches.forEach((b) => {
      lines.push(`${b.icon || "-"} ${b.label}`);
      b.children.forEach((c) => lines.push(`    - ${c}`));
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
      const vb = (svgEl.getAttribute("viewBox") || "0 0 1400 900").split(" ").map(Number);
      const W = vb[2], H = vb[3];
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
    const vb = (svgEl.getAttribute("viewBox") || "0 0 1400 900").split(" ").map(Number);
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width",  String(vb[2]));
    clone.setAttribute("height", String(vb[3]));
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
    <div dir={dir} className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-32 font-display">

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
        <button
          type="button"
          onClick={() => setLocation("/teacher")}
          className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
          aria-label={isAr ? "رجوع" : "Back"}
        >
          {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
              {isAr ? "مولّد الخرائط الذهنية" : "AI Mind Map Generator"}
            </h1>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
              {isAr ? "لخّص مفاهيم الدرس في خريطة بصرية جذابة" : "Summarise lesson concepts into an engaging visual map"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/60 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
        >
          <Globe className="w-4 h-4" />
          <span className="mt-0.5">{lang === "ar" ? "English" : "عربي"}</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Input Form Card */}
        <div className="max-w-3xl mx-auto">
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={(e) => { e.preventDefault(); generate(); }}
            className="bg-white dark:bg-[#15201B] rounded-3xl shadow-sm border border-emerald-50 dark:border-emerald-900/30 overflow-hidden transition-all hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800/50"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <textarea
                    ref={textareaRef}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate(); }}
                    placeholder={isAr ? "عن ماذا تريد أن تنشئ خريطة ذهنية؟ (مثال: الثورة الصناعية...)" : "What do you want to map? (e.g. Industrial Revolution...)"}
                    disabled={loading}
                    rows={2}
                    maxLength={400}
                    data-testid="input-topic"
                    className="w-full bg-transparent text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 outline-none resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-end px-1 mt-1">
                    <span className="text-[11px] font-bold text-slate-400">{topic.length}/400</span>
                  </div>
                </div>
              </div>
              
              <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-100 dark:via-emerald-900/50 to-transparent" />

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-1.5 flex items-center border border-emerald-50 dark:border-emerald-900/30 w-full sm:w-auto">
                  {(["standard", "detailed"] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDepth(d)}
                      className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all ${depth === d ? "bg-white dark:bg-[#15201B] text-emerald-700 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                    >
                      {d === "standard" ? (isAr ? "عادي (4-6)" : "Standard (4-6)") : (isAr ? "تفصيلي (6-8)" : "Detailed (6-8)")}
                    </button>
                  ))}
                </div>

                <div className="flex-1" />

                <button
                  type="submit"
                  disabled={loading || !topic.trim()}
                  data-testid="btn-generate"
                  className="w-full sm:w-auto h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shrink-0"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />{isAr ? "جارٍ التوليد..." : "Generating..."}</>
                  ) : (
                    <><Sparkles className="w-5 h-5" />{isAr ? "توليد الخريطة" : "Generate Map"}</>
                  )}
                </button>
              </div>
            </div>
          </motion.form>
        </div>

        <AnimatePresence mode="wait">
          {!map && !loading ? (
            <motion.div key="intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-3xl mx-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {useCases.map((uc, i) => (
                  <div key={i} className="bg-white dark:bg-[#15201B] rounded-3xl p-5 border border-emerald-50 dark:border-emerald-900/30 shadow-sm flex flex-col items-center text-center transition-all hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800/50">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mb-4 flex items-center justify-center shrink-0">
                      {uc.icon}
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 mb-2">{uc.title}</h3>
                    <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{uc.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-[#15201B] rounded-3xl p-6 border border-emerald-50 dark:border-emerald-900/30 shadow-sm">
                <h3 className="font-black text-slate-800 dark:text-slate-100 mb-4 text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  {isAr ? "جرب أحد هذه المواضيع:" : "Try one of these topics:"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => handleExample(ex)}
                      className="px-4 py-2 rounded-xl text-sm font-bold bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 text-slate-600 dark:text-slate-300 hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : map ? (
            <motion.div
              key="map"
              initial={{ opacity: 0, scale: 0.98, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -16 }}
              className="w-full"
            >
              <div className="bg-white dark:bg-[#15201B] rounded-3xl shadow-sm border border-emerald-50 dark:border-emerald-900/30 p-2 sm:p-4">
                <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-[#F8FAFC]">
                  <MindMapSVG map={map} isAr={isAr} />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
        <AnimatePresence>
          {map && !loading && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.9 }}
              className="pointer-events-auto bg-white/95 dark:bg-[#15201B]/95 backdrop-blur-xl px-2 py-2 rounded-2xl shadow-2xl shadow-emerald-900/20 border border-emerald-100 dark:border-emerald-800/60 flex items-center gap-1 sm:gap-2"
            >
              <button
                onClick={handleExportPng}
                disabled={exporting}
                data-testid="btn-export-png"
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm transition-colors"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
                <span className="hidden sm:inline">{isAr ? "صورة PNG" : "PNG"}</span>
              </button>
              
              <button
                onClick={handleExportSvg}
                data-testid="btn-export-svg"
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm transition-colors"
              >
                <FileImage className="w-4 h-4" />
                <span className="hidden sm:inline">{isAr ? "فيكتور SVG" : "SVG"}</span>
              </button>

              <div className="w-px h-6 bg-emerald-100 dark:bg-emerald-800/50 mx-1" />

              <button
                onClick={handlePrint}
                data-testid="btn-print"
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">{isAr ? "طباعة" : "Print"}</span>
              </button>

              <button
                onClick={handleCopyText}
                data-testid="btn-copy"
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm transition-colors"
              >
                {copied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{isAr ? "نسخ كنص" : "Copy"}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}