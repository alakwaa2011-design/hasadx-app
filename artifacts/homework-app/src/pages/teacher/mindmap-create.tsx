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
    <>
      <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">

        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setLocation("/teacher")}
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
                  style={{ background: BG_LIGHT }}
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
