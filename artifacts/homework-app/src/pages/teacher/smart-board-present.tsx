/**
 * Smart Whiteboard — Presentation Mode
 * Sections accumulate on the board; oldest section fades when board fills.
 * Voice selector · Pace control · Manual mode · Font-size scaling
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  Pause, Play, ChevronRight, ChevronLeft, X,
  Pencil, Eraser, Trash2, Volume2, VolumeX, Loader2,
  Settings, RotateCcw, ZoomIn, ZoomOut, Hand, Edit2,
  Maximize2, Minimize2, Radio, Copy, Check,
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Voices ───────────────────────────────────────────────────────────────────

const VOICES = [
  { id:"shimmer", ar:"شيمر",  desc:"نسائي هادئ",  dot:"#f9a8d4" },
  { id:"nova",    ar:"نوفا",   desc:"نسائي واضح",  dot:"#93c5fd" },
  { id:"alloy",   ar:"ألوي",   desc:"محايد",        dot:"#a5f3fc" },
  { id:"echo",    ar:"إيكو",   desc:"رجالي ناعم",  dot:"#86efac" },
  { id:"onyx",    ar:"أونيكس", desc:"رجالي عميق",  dot:"#c4b5fd" },
] as const;
type VoiceId = typeof VOICES[number]["id"];

// ─── Paces ────────────────────────────────────────────────────────────────────

const PACES = [
  { id:"slow2",  ar:"بطيء جداً", icon:"🐢", chars:2, between:30, step:80,  rate:0.75 },
  { id:"slow",   ar:"بطيء",      icon:"🚶", chars:3, between:20, step:60,  rate:0.9  },
  { id:"normal", ar:"عادي",      icon:"✦",  chars:4, between:12, step:40,  rate:1.0  },
  { id:"fast",   ar:"سريع",      icon:"🏃", chars:6, between:7,  step:24,  rate:1.1  },
  { id:"fast2",  ar:"سريع جداً", icon:"⚡", chars:9, between:4,  step:14,  rate:1.25 },
] as const;
type PaceId = typeof PACES[number]["id"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardAction {
  type:string; content?:string; label?:string;
  description?:string; color?:string;
  imageQuery?:string;
  from?:string; to?:string;                           // drawConnector
  data?:Array<{label:string;value:number}>;           // showChart
  name?:string; country?:string; lat?:number; lng?:number; // showLocation
}
interface Phase {
  title:string; voiceText:string; boardActions:BoardAction[];
}
interface LessonPlan {
  title:string; topic:string;
  intro:   { voiceText:string; boardActions:BoardAction[] };
  steps:   Array<{ id:string; title:string; voiceText:string; boardActions:BoardAction[] }>;
  summary: { voiceText:string; boardActions:BoardAction[] };
  keyPoints?:string[];
}
interface BoardItem {
  key:string; type:string; content:string; color:string;
  label?:string; description?:string;
  data?:Array<{label:string;value:number}>;           // showChart
}
/** A phase's items grouped as one visual block on the board */
interface BoardSection {
  id: string;
  phaseIdx: number;
  title: string;
  items: BoardItem[];
}

// ─── Chalk colors ─────────────────────────────────────────────────────────────

const CHALK: Record<string,string> = {
  white:"#f2ede0", yellow:"#f5d76e", green:"#a8e6b0",
  pink:"#f4a0a8",  blue:"#9fc8f5",   orange:"#f5b87a",
  red:"#f58080",   purple:"#c4a8f0",
};
const ch = (c?:string) => CHALK[c??"white"] ?? c ?? CHALK.white;

// ─── Board item renderer ──────────────────────────────────────────────────────

function BoardLine({ item, typedChars, scale=1 }:
  { item:BoardItem; typedChars?:number; scale?:number }) {
  const text  = typedChars !== undefined ? item.content.slice(0, typedChars) : item.content;
  const color = ch(item.color);
  const cursor = typedChars !== undefined && typedChars < item.content.length;
  if (item.type === "clearBoard" || item.type === "erase") return null;

  const cs: React.CSSProperties = {
    fontFamily:"'Tajawal','Noto Sans Arabic',sans-serif",
    color, filter:"url(#chalk-rough)",
    textShadow:`0 0 4px ${color}55, 1px 1px 0 rgba(0,0,0,.4)`,
  };
  const fs = (n:number) => Math.round(n * scale);

  const Caret = cursor ? (
    <span style={{ display:"inline-block", width:2, height:"1.1em",
      background:color, marginRight:2, verticalAlign:"text-bottom",
      animation:"blinkCursor .6s step-end infinite", opacity:.9 }}/>
  ) : null;

  if (item.type === "drawArrow") return (
    <div style={{ display:"flex", alignItems:"center", gap:14, margin:"12px 0", animation:"chalkIn .4s" }}>
      <svg width={fs(72)} height={fs(28)} viewBox="0 0 72 28" style={{ filter:"url(#chalk-rough)", flexShrink:0 }}>
        <line x1="4" y1="14" x2="62" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <polygon points="62,8 72,14 62,20" fill={color}/>
      </svg>
      {item.label && <span style={{ ...cs, fontSize:fs(26), fontWeight:700 }}>{item.label}</span>}
    </div>
  );

  if (item.type === "drawCircle") return (
    <div style={{ display:"flex", alignItems:"center", gap:14, margin:"10px 0" }}>
      <svg width={fs(48)} height={fs(48)} viewBox="0 0 48 48" style={{ filter:"url(#chalk-rough)", flexShrink:0 }}>
        <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="2.5"/>
      </svg>
      {item.label && <span style={{ ...cs, fontSize:fs(24), fontWeight:700 }}>{item.label}</span>}
    </div>
  );

  if (item.type === "showImage") return (
    <BoardImage item={item} scale={scale}/>
  );

  if (item.type === "showDiagram") return (
    <div style={{ border:`1.5px dashed ${color}60`, borderRadius:8, padding:"12px 16px",
      margin:"12px 0", display:"flex", alignItems:"center", gap:10, animation:"chalkIn .5s" }}>
      <span style={{ fontSize:fs(22), flexShrink:0 }}>📐</span>
      <span style={{ ...cs, fontSize:fs(20) }}>{item.description ?? item.content}</span>
    </div>
  );

  // ── Connector: A ──label──▶ B ──
  if (item.type === "drawConnector") {
    const from = item.content;   // "from" stored in content
    const mid  = item.label;     // optional arrow label
    const to   = item.description ?? ""; // "to" stored in description
    const boxStyle: React.CSSProperties = {
      border:`1.5px solid ${color}70`, borderRadius:6,
      padding:`${fs(7)}px ${fs(14)}px`,
      fontFamily:"'Tajawal',sans-serif", color, fontWeight:700,
      fontSize:fs(26), filter:"url(#chalk-rough)",
      textShadow:`0 0 4px ${color}44`,
      background:"rgba(0,0,0,.18)",
    };
    return (
      <div style={{ display:"flex", alignItems:"center", gap:fs(10), margin:"18px 0",
        animation:"chalkIn .45s", flexWrap:"wrap" }}>
        <span style={boxStyle}>{from}</span>
        {/* Arrow + optional label */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, flexShrink:0 }}>
          {mid && <span style={{ ...cs, fontSize:fs(13), opacity:.7 }}>{mid}</span>}
          <svg width={fs(56)} height={fs(18)} viewBox="0 0 56 18" style={{ filter:"url(#chalk-rough)" }}>
            <line x1="2" y1="9" x2="46" y2="9" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
            <polygon points="44,4 56,9 44,14" fill={color}/>
          </svg>
        </div>
        <span style={{ ...boxStyle, background:`${color}14` }}>{to}</span>
      </div>
    );
  }

  // ── Bar chart ──
  // ── Location card with real OpenStreetMap ──
  if (item.type === "showLocation") {
    return <BoardMap item={item} scale={scale} />;
  }

  if (item.type === "showChart" && item.data && item.data.length > 0) {
    const d      = item.data;
    const max    = Math.max(...d.map(r => r.value), 1);
    const COLORS = ["#f5d76e","#a8e6b0","#9fc8f5","#f5b87a","#c4a8f0","#f4a0a8","#f2ede0","#f58080"];
    const barW   = fs(42);
    const barGap = fs(12);
    const chartH = fs(120);
    const lblH   = fs(40);
    const svgW   = d.length * (barW + barGap) + barGap;
    const svgH   = chartH + lblH;
    return (
      <div style={{ margin:"16px 0", animation:"chalkIn .5s" }}>
        {item.description && (
          <div style={{ ...cs, fontSize:fs(14), opacity:.55, marginBottom:fs(6) }}>
            {item.description}
          </div>
        )}
        <svg width={svgW} height={svgH} style={{ display:"block", overflow:"visible" }}>
          {/* Baseline */}
          <line x1={0} y1={chartH} x2={svgW} y2={chartH}
            stroke={`${color}40`} strokeWidth="1.5" strokeLinecap="round"/>
          {d.map((row, i) => {
            const x    = barGap + i * (barW + barGap);
            const bH   = Math.max(4, Math.round((row.value / max) * chartH * 0.90));
            const y    = chartH - bH;
            const c    = COLORS[i % COLORS.length];
            const mid  = x + barW / 2;
            return (
              <g key={i}>
                {/* Bar */}
                <rect x={x} y={y} width={barW} height={bH}
                  fill={`${c}20`} stroke={c} strokeWidth="1.5" rx={3}
                  style={{ filter:"url(#chalk-rough)" }}/>
                {/* Value on top */}
                <text x={mid} y={y - fs(4)} textAnchor="middle"
                  fill={c} fontSize={fs(12)} fontWeight="700"
                  fontFamily="'Tajawal',sans-serif"
                  style={{ filter:"url(#chalk-rough)" }}>
                  {row.value}
                </text>
                {/* Label below */}
                <text x={mid} y={chartH + fs(18)} textAnchor="middle"
                  fill={`${color}80`} fontSize={fs(11)}
                  fontFamily="'Tajawal',sans-serif"
                  style={{ filter:"url(#chalk-rough)" }}>
                  {row.label.length > 7 ? row.label.slice(0,7)+"…" : row.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (item.type === "bullet") return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, margin:"10px 0 2px", animation:"chalkIn .35s" }}>
      <span style={{ color, fontSize:fs(8), marginTop:fs(12), flexShrink:0, opacity:.7, filter:"url(#chalk-rough)" }}>●</span>
      <span style={{ ...cs, fontSize:fs(28), fontWeight:400, lineHeight:1.65 }}>{text}{Caret}</span>
    </div>
  );

  if (item.type === "highlight") return (
    <div style={{ margin:"12px 0", animation:"chalkIn .4s" }}>
      <span style={{ ...cs, background:`${color}18`, border:`1.5px solid ${color}50`,
        borderRadius:6, padding:`6px ${fs(16)}px`, fontSize:fs(30), fontWeight:700, display:"inline-block" }}>
        {text}{Caret}
      </span>
    </div>
  );

  if (item.type === "underline") return (
    <div style={{ margin:"8px 0", animation:"chalkIn .35s" }}>
      <span style={{ ...cs, fontSize:fs(28), fontWeight:600,
        borderBottom:`2px solid ${color}90`, paddingBottom:3, display:"inline" }}>
        {text}{Caret}
      </span>
    </div>
  );

  if (item.type === "writeMath") {
    // While typing: LaTeX is incomplete — show raw chalk text
    if (cursor) {
      return (
        <div style={{ margin:"10px 0", animation:"chalkIn .35s" }}>
          <span style={{ ...cs, fontFamily:"'Courier New',monospace",
            fontSize:fs(22), fontWeight:600, opacity:.75,
            background:"rgba(255,255,255,.04)", borderRadius:6,
            padding:`4px ${fs(12)}px`, display:"inline-block", letterSpacing:.5 }}>
            {text}{Caret}
          </span>
        </div>
      );
    }
    // Committed: render proper math with KaTeX
    let mathHtml = "";
    try {
      mathHtml = katex.renderToString(text, {
        throwOnError: false,
        displayMode: true,
        strict: false,
        trust: false,
      });
    } catch { /* fall back to raw below */ }

    if (mathHtml) {
      return (
        <div style={{ margin:"14px 4px", animation:"chalkIn .4s",
          color, filter:"url(#chalk-rough)",
          textShadow:`0 0 5px ${color}44`,
          fontSize: fs(28) }}
          className="chalk-katex"
          dangerouslySetInnerHTML={{ __html: mathHtml }}
        />
      );
    }
    // Fallback: raw text
    return (
      <div style={{ margin:"10px 0", animation:"chalkIn .35s" }}>
        <span style={{ ...cs, fontFamily:"'Courier New',monospace",
          fontSize:fs(26), fontWeight:700,
          background:"rgba(255,255,255,.04)", borderRadius:6,
          padding:`4px ${fs(14)}px`, display:"inline-block" }}>
          {text}
        </span>
      </div>
    );
  }

  const isTitle = item.type === "writeTitle";
  return (
    <div style={{ margin: isTitle ? "0 0 16px" : "8px 0", animation:"chalkIn .35s" }}>
      <span style={{ ...cs, fontSize: isTitle ? fs(36) : fs(28),
        fontWeight: isTitle ? 700 : 400, lineHeight:1.65 }}>
        {text}{Caret}
      </span>
    </div>
  );
}

// ─── Real map block (OpenStreetMap via Nominatim geocode) ─────────────────────

function BoardMap({ item, scale = 1 }: { item: BoardItem; scale?: number }) {
  const [coords, setCoords] = useState<{lat:number;lng:number}|null>(null);
  const [failed,  setFailed] = useState(false);
  const color = ch(item.color);
  const fs = (n:number) => Math.round(n * scale);

  useEffect(() => {
    const q = item.content;
    if (!q?.trim()) { setFailed(true); return; }
    let cancelled = false;
    fetch(`${API_BASE}/api/whiteboard/geocode?q=${encodeURIComponent(q)}`, { credentials:"include" })
      .then(r => r.ok ? r.json() : null)
      .then((d:any) => { if (!cancelled && d?.lat) setCoords({ lat:d.lat, lng:d.lng }); else if(!cancelled) setFailed(true); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [item.content]);

  const mapUrl = coords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng-.6},${coords.lat-.4},${coords.lng+.6},${coords.lat+.4}&layer=mapnik&marker=${coords.lat},${coords.lng}`
    : null;

  return (
    <div style={{ margin:"14px 0", animation:"chalkIn .45s" }}>
      <div style={{ border:`1.5px solid ${color}55`, borderRadius:10, overflow:"hidden", background:"rgba(0,0,0,.25)", maxWidth:"90%" }}>
        {/* Header bar */}
        <div style={{ padding:`${fs(7)}px ${fs(14)}px`, display:"flex", alignItems:"center", gap:fs(8), borderBottom:`1px solid ${color}25` }}>
          <span style={{ fontSize:fs(18) }}>📍</span>
          <span style={{ fontFamily:"'Tajawal',sans-serif", color, fontWeight:800, fontSize:fs(24), filter:"url(#chalk-rough)", textShadow:`0 0 6px ${color}44` }}>
            {item.content}
          </span>
          {item.label && <span style={{ fontFamily:"'Tajawal',sans-serif", color:`${color}80`, fontSize:fs(15), filter:"url(#chalk-rough)" }}>{item.label}</span>}
        </div>
        {/* Map or loading */}
        {mapUrl ? (
          <iframe src={mapUrl} width="100%" height={fs(170)} scrolling="no"
            style={{ border:"none", display:"block", opacity:.78,
              filter:"saturate(.65) brightness(.72) sepia(.12)" }}
            loading="lazy" title={item.content}/>
        ) : failed ? (
          <div style={{ height:fs(60), display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'Tajawal',sans-serif", color:`${color}40`, fontSize:fs(16) }}>🗺️</div>
        ) : (
          <div style={{ height:fs(60), display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'Tajawal',sans-serif", color:`${color}30`, fontSize:fs(13) }}>جارٍ تحميل الخريطة…</div>
        )}
        {/* Description */}
        {item.description && (
          <div style={{ padding:`${fs(5)}px ${fs(14)}px`, fontFamily:"'Tajawal',sans-serif",
            color:`${color}70`, fontSize:fs(14), filter:"url(#chalk-rough)" }}>
            {item.description}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Wikipedia image block ────────────────────────────────────────────────────

function BoardImage({ item, scale = 1 }: { item: BoardItem; scale?: number }) {
  const [url,     setUrl]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);
  const color = ch(item.color);
  const fs = (n: number) => Math.round(n * scale);

  useEffect(() => {
    const query = item.label; // imageQuery stored in label
    if (!query?.trim()) { setLoading(false); setFailed(true); return; }
    let cancelled = false;
    fetch(`${API_BASE}/api/whiteboard/image?q=${encodeURIComponent(query)}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => {
        if (cancelled) return;
        if (d?.url) setUrl(d.url);
        else         setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item.label]);

  if (failed) return null;

  return (
    <div style={{ margin:"16px 0", animation:"chalkIn .5s", display:"flex", flexDirection:"column",
      alignItems:"flex-start" }}>
      {/* Chalk frame */}
      <div style={{
        position:"relative", display:"inline-block",
        border:`2px solid ${color}55`, borderRadius:4,
        padding:6, background:"rgba(0,0,0,.25)",
        boxShadow:`0 0 0 1px ${color}20, inset 0 0 10px rgba(0,0,0,.3)`,
        maxWidth:"88%",
      }}>
        {/* Corner chalk marks */}
        {([{top:-3,right:-3},{top:-3,left:-3},{bottom:-3,right:-3},{bottom:-3,left:-3}] as React.CSSProperties[]).map((p,i) => (
          <div key={i} style={{ position:"absolute", ...p, width:6, height:6,
            background:color, borderRadius:"50%", opacity:.6, filter:"url(#chalk-rough)" }}/>
        ))}

        {loading ? (
          /* Skeleton */
          <div style={{ width:fs(240), height:fs(170), background:"rgba(255,255,255,.06)",
            borderRadius:3, position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", inset:0,
              background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,.04) 50%,transparent 100%)",
              animation:"shimmer 1.8s infinite" }}/>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
              justifyContent:"center", color:`${color}40`, fontSize:fs(28) }}>🖼</div>
          </div>
        ) : url ? (
          <img src={url} alt={item.description ?? ""}
            style={{ display:"block", maxWidth:"100%", maxHeight:fs(240),
              borderRadius:3, objectFit:"cover",
              filter:"sepia(15%) brightness(.88) contrast(1.05)" }}
            onError={() => setFailed(true)}
          />
        ) : null}
      </div>

      {/* Caption */}
      {item.description && !loading && !failed && (
        <div style={{ fontFamily:"'Tajawal',sans-serif", color:`${color}99`,
          fontSize:fs(17), marginTop:8, paddingRight:6,
          filter:"url(#chalk-rough)", textAlign:"right",
          textShadow:`0 0 3px ${color}33` }}>
          ↑ {item.description}
        </div>
      )}
    </div>
  );
}

// ─── Chalk SVG filter ─────────────────────────────────────────────────────────

/** Return text up to the last complete word within `chars` characters */
function wordSlice(text: string, chars: number): string {
  if (!text) return "";
  if (chars >= text.length) return text;
  const sub = text.slice(0, chars);
  const lastBreak = Math.max(sub.lastIndexOf(" "), sub.lastIndexOf("\n"));
  return lastBreak > 0 ? sub.slice(0, lastBreak + 1) : sub;
}

function ChalkDefs() {
  return (
    <svg width="0" height="0" style={{ position:"absolute", overflow:"hidden" }}>
      <defs>
        <filter id="chalk-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="4" seed="3" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SmartBoardPresent() {
  const params = useParams<{ id:string }>();
  const [, navigate] = useLocation();

  // Lesson data
  const [loadingLesson, setLoadingLesson] = useState(true);
  const [loadError,     setLoadError]     = useState("");
  const planRef   = useRef<LessonPlan|null>(null);
  const phasesRef = useRef<Phase[]>([]);

  // Board sections (accumulate, scroll off when full)
  const [sections,    setSections]    = useState<BoardSection[]>([]);
  const [typingState, setTypingState] = useState<{ key:string; chars:number }|null>(null);
  // Voice caption: the spoken voiceText typed in sync with audio progress
  const [captionState, setCaptionState] = useState<{ phaseIdx:number; chars:number }|null>(null);
  const [stepTitle,   setStepTitle]   = useState("");
  const [stepIdx,     setStepIdx]     = useState(0);
  const [isDone,      setIsDone]      = useState(false);
  const [isPaused,    setIsPaused]    = useState(false);
  const [flashClear,  setFlashClear]  = useState(false); // brief blink on forced clear

  // Controls UI
  const [isDrawMode,   setIsDrawMode]   = useState(false);
  const [drawColor,    setDrawColor]    = useState("#f2ede0");
  const [drawTool,     setDrawTool]     = useState<"pen"|"eraser">("pen");
  const [isMuted,      setIsMuted]      = useState(false);
  const [showCtrl,     setShowCtrl]     = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Broadcast (share with students)
  const [broadcastCode,        setBroadcastCode]        = useState<string|null>(null);
  const [broadcastSecret,      setBroadcastSecret]      = useState<string|null>(null);
  const [broadcastLoading,     setBroadcastLoading]     = useState(false);
  const [showBroadcastModal,   setShowBroadcastModal]   = useState(false);
  const [broadcastCopied,      setBroadcastCopied]      = useState(false);
  const broadcastCodeRef    = useRef<string|null>(null);
  const broadcastSecretRef  = useRef<string|null>(null);
  const broadcastFlushTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Settings
  const [voice,      setVoice]      = useState<VoiceId>("shimmer");
  const [paceId,     setPaceId]     = useState<PaceId>("normal");
  const [fontSize,   setFontSize]   = useState(1.0);
  const [manualMode, setManualMode] = useState(false);
  const [waitingTap, setWaitingTap] = useState(false);

  // Refs
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const contentRef    = useRef<HTMLDivElement>(null);   // board content div
  const audioRef      = useRef<HTMLAudioElement|null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef  = useRef(false);
  const isMutedRef    = useRef(false);
  const voiceRef      = useRef<VoiceId>("shimmer");
  const paceRef       = useRef<typeof PACES[number]>(PACES.find(p => p.id==="normal")!);
  const manualModeRef = useRef(false);
  const waitingTapRef = useRef(false);
  const ctrlTimerRef  = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Sync refs
  useEffect(() => { isMutedRef.current    = isMuted;    }, [isMuted]);
  useEffect(() => { voiceRef.current      = voice;      }, [voice]);
  useEffect(() => { paceRef.current       = PACES.find(p => p.id===paceId)!; }, [paceId]);
  useEffect(() => { manualModeRef.current = manualMode; }, [manualMode]);
  useEffect(() => { waitingTapRef.current = waitingTap; }, [waitingTap]);

  // Animation state (pure ref — no re-renders)
  const anim = useRef({
    stepIdx:0, actionIdx:0, delay:0,
    paused:false, done:false, keyCounter:0,
    currentSectionId: "",
    waitingForAudio: false,         // block until voice finishes (phase end)
    voiceCaption: null as null | { text:string; phaseIdx:number; startMs:number },
    typing: null as null | {
      key:string; type:string; text:string; color:string;
      label?:string; description?:string; chars:number;
    },
  });

  // ── Audio queue ──────────────────────────────────────────────────────────────

  const playFromQueue = useCallback(async () => {
    if (isMutedRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false; return;
    }
    const text = audioQueueRef.current.shift()!;
    isPlayingRef.current = true;
    const rate = paceRef.current.rate;
    try {
      const r = await fetch(`${API_BASE}/api/tts`, {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ text:text.trim(), voice:voiceRef.current, speed:rate }),
      });
      if (!r.ok) { isPlayingRef.current=false; playFromQueue(); return; }
      const blob = await r.blob();
      const au   = new Audio(URL.createObjectURL(blob));
      au.playbackRate = rate;
      audioRef.current = au;
      // Reset caption startMs here (blob ready) so elapsed-time fallback is accurate
      if (anim.current.voiceCaption) anim.current.voiceCaption.startMs = Date.now();
      au.onended = () => { isPlayingRef.current=false; playFromQueue(); };
      au.onerror = () => { isPlayingRef.current=false; playFromQueue(); };
      au.play().catch(() => { isPlayingRef.current=false; playFromQueue(); });
    } catch { isPlayingRef.current=false; playFromQueue(); }
  }, []);

  const enqueue = useCallback((text:string) => {
    if (!text.trim() || isMutedRef.current) return;
    audioQueueRef.current.push(text);
    if (!isPlayingRef.current) playFromQueue();
  }, [playFromQueue]);

  const clearQueue = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current  = false;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current=null; }
  }, []);

  // ── Overflow detector: remove oldest section when board fills up ─────────────

  useEffect(() => {
    if (sections.length <= 1) return;
    // Give DOM a frame to paint, then measure
    const tid = setTimeout(() => {
      const el = contentRef.current;
      if (!el) return;
      const overflow = el.scrollHeight > el.clientHeight * 0.91;
      const tooMany  = sections.length > 2;
      if (overflow || tooMany) {
        setSections(prev => prev.length > 1 ? prev.slice(1) : prev);
      }
    }, 120);
    return () => clearTimeout(tid);
  }, [sections]);

  // ── Load lesson ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = params?.id;
    if (!id) { setLoadError("معرّف غير صالح"); setLoadingLesson(false); return; }

    // "ask" mode: lesson plan was stored in sessionStorage by SmartBoardAsk
    if (id === "ask") {
      try {
        const raw = sessionStorage.getItem("whiteboard_ask_plan");
        if (!raw) { setLoadError("لم يُعثر على الإجابة — حاول مجدداً"); setLoadingLesson(false); return; }
        const p: LessonPlan = JSON.parse(raw);
        planRef.current = p;
        // Skip empty intro/summary for Q&A mode — only the answer step matters
        const phases: Phase[] = p.steps.map(s => ({
          title: s.title, voiceText: s.voiceText, boardActions: s.boardActions,
        }));
        phasesRef.current = phases;
        setStepTitle(phases[0]?.title ?? "الإجابة");
      } catch {
        setLoadError("تعذّر تحميل الإجابة");
      }
      setLoadingLesson(false);
      return;
    }

    fetch(`${API_BASE}/api/whiteboard/lessons/${id}`, { credentials:"include" })
      .then(r => r.json())
      .then(d => {
        if (!d.lesson?.plan) { setLoadError("الدرس غير موجود"); return; }
        const p: LessonPlan = typeof d.lesson.plan === "string"
          ? JSON.parse(d.lesson.plan) : d.lesson.plan;
        planRef.current = p;
        const phases: Phase[] = [
          { title:"المقدمة",  voiceText:p.intro.voiceText,   boardActions:p.intro.boardActions },
          ...p.steps.map(s => ({ title:s.title, voiceText:s.voiceText, boardActions:s.boardActions })),
          { title:"الخلاصة", voiceText:p.summary.voiceText, boardActions:p.summary.boardActions },
        ];
        phasesRef.current = phases;
        setStepTitle(phases[0]?.title ?? "");
      })
      .catch(() => setLoadError("تعذّر تحميل الدرس"))
      .finally(() => setLoadingLesson(false));
  }, [params?.id]); // eslint-disable-line

  // ── Animation loop ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (loadingLesson || loadError || phasesRef.current.length === 0) return;
    const TICK = 60;

    /** Create first section for phase 0 */
    const firstId = `s${anim.current.keyCounter++}`;
    anim.current.currentSectionId = firstId;
    setSections([{ id:firstId, phaseIdx:0, title:phasesRef.current[0].title, items:[] }]);
    // Enqueue voice then start writing after a short delay so items appear WITH the voice
    enqueue(phasesRef.current[0]?.voiceText ?? "");
    anim.current.delay = 12; // ~720ms — lets TTS start loading before items appear
    // Start voice caption for phase 0
    const vt0 = phasesRef.current[0]?.voiceText ?? "";
    if (vt0.trim()) anim.current.voiceCaption = { text: vt0, phaseIdx: 0, startMs: Date.now() };

    const interval = setInterval(() => {
      const a      = anim.current;
      const phases = phasesRef.current;
      const pace   = paceRef.current;

      // ── Voice caption update — runs ALWAYS, even during pauses/waits ──────────
      // Must be before any early return so caption stays in sync with audio
      const vc = a.voiceCaption;
      if (vc && vc.text && isPlayingRef.current) {
        const au = audioRef.current;
        let ratio = 0;
        if (au && !isNaN(au.duration) && au.duration > 0) {
          // Best case: real audio progress
          ratio = Math.min(au.currentTime / au.duration, 1);
        } else if (vc.startMs > 0) {
          // Fallback: elapsed time since blob became ready (~14 chars/sec Arabic)
          const charsPerMs = (14 * pace.rate) / 1000;
          ratio = Math.min((Date.now() - vc.startMs) * charsPerMs / Math.max(vc.text.length, 1), 0.97);
        }
        const chars = Math.floor(ratio * vc.text.length);
        setCaptionState(prev =>
          prev?.phaseIdx === vc.phaseIdx && prev.chars === chars ? prev
            : { phaseIdx: vc.phaseIdx, chars }
        );
      }

      if (a.paused || a.done || waitingTapRef.current) return;

      // ── Audio gate: wait for voice to finish before next phase ──
      if (a.waitingForAudio) {
        const audioActive = isPlayingRef.current || audioQueueRef.current.length > 0;
        if (audioActive) return;
        // Voice just finished — small breath before next item
        a.waitingForAudio = false;
        a.delay = 5; // ~300ms pause after voice ends
      }

      if (a.delay > 0) { a.delay--; return; }

      // ── Typing in progress ──
      if (a.typing) {
        const t = a.typing;
        t.chars = Math.min(t.chars + pace.chars, t.text.length);
        setTypingState({ key:t.key, chars:t.chars });
        if (t.chars >= t.text.length) {
          const committed: BoardItem = {
            key:t.key, type:t.type, content:t.text,
            color:t.color, label:t.label, description:t.description,
          };
          const sid = a.currentSectionId;
          setSections(prev => prev.map(s =>
            s.id === sid ? { ...s, items:[...s.items, committed] } : s
          ));
          setTypingState(null);
          // ── NEW: NO individual item TTS — voice comes from phase voiceText only
          // Items flow continuously; voice narrates the full explanation in parallel
          a.typing = null;
          a.actionIdx++;
          a.delay = pace.between;   // short breather, then next item
          if (manualModeRef.current) {
            setWaitingTap(true);
            waitingTapRef.current = true;
          }
        }
        return;
      }

      // ── Current phase / actions ──
      const phase = phases[a.stepIdx];
      if (!phase) { a.done=true; setIsDone(true); return; }

      const actions = phase.boardActions;
      if (a.actionIdx >= actions.length) {
        // All board items written — now wait for voice narration to finish
        // before moving to the next phase (voice & board may still be running)
        const audioActive = isPlayingRef.current || audioQueueRef.current.length > 0;
        if (!isMutedRef.current && audioActive) {
          a.waitingForAudio = true;
          return;
        }
        // Phase done — advance to next
        if (a.stepIdx < phases.length - 1) {
          a.stepIdx++;
          a.actionIdx = 0;
          setStepIdx(a.stepIdx);
          setStepTitle(phases[a.stepIdx].title);
          const newId = `s${a.keyCounter++}`;
          a.currentSectionId = newId;
          setSections(prev => [
            ...prev,
            { id:newId, phaseIdx:a.stepIdx, title:phases[a.stepIdx].title, items:[] },
          ]);
          // Enqueue the next phase voice, then items flow after a short pause
          enqueue(phases[a.stepIdx].voiceText ?? phases[a.stepIdx].title);
          a.delay = pace.between * 3;
          // Start voice caption for next phase
          const vtNext = phases[a.stepIdx].voiceText ?? "";
          if (vtNext.trim()) a.voiceCaption = { text: vtNext, phaseIdx: a.stepIdx, startMs: Date.now() };
          else a.voiceCaption = null;
        } else {
          a.done=true; setIsDone(true);
        }
        return;
      }

      const action = actions[a.actionIdx];

      // Force-clear: wipe all sections, start fresh section for current phase
      if (action.type === "clearBoard") {
        const freshId = `s${a.keyCounter++}`;
        a.currentSectionId = freshId;
        setFlashClear(true);
        setTimeout(() => {
          setSections([{ id:freshId, phaseIdx:a.stepIdx, title:phase.title, items:[] }]);
          setTypingState(null);
          setFlashClear(false);
        }, 280);
        a.actionIdx++; a.delay=6; return;
      }
      if (action.type === "erase") {
        const sid = a.currentSectionId;
        setSections(prev => prev.map(s =>
          s.id===sid ? { ...s, items:s.items.slice(0,-1) } : s
        ));
        a.actionIdx++; return;
      }
      if (action.type === "pause") {
        a.paused=true; setIsPaused(true); a.actionIdx++; return;
      }
      // ── All visual/instant actions — NO individual TTS, items appear in flow ──
      if (action.type === "drawArrow" || action.type === "drawCircle") {
        const item: BoardItem = { key:`k${a.keyCounter++}`, type:action.type, content:"",
          color:action.color??"white", label:action.label };
        const sid = a.currentSectionId;
        setSections(prev => prev.map(s => s.id===sid ? { ...s, items:[...s.items,item] } : s));
        a.actionIdx++; a.delay = pace.between; return;
      }
      if (action.type === "showDiagram") {
        const item: BoardItem = { key:`k${a.keyCounter++}`, type:action.type,
          content:action.description??"", color:action.color??"blue", description:action.description };
        const sid = a.currentSectionId;
        setSections(prev => prev.map(s => s.id===sid ? { ...s, items:[...s.items,item] } : s));
        a.actionIdx++; a.delay = pace.between; return;
      }
      if (action.type === "drawConnector") {
        const item: BoardItem = {
          key:`k${a.keyCounter++}`, type:"drawConnector",
          content: action.from ?? "",
          color: action.color ?? "yellow",
          label: action.label ?? "",
          description: action.to ?? "",
        };
        const sid = a.currentSectionId;
        setSections(prev => prev.map(s => s.id===sid ? { ...s, items:[...s.items,item] } : s));
        a.actionIdx++; a.delay = pace.between; return;
      }
      if (action.type === "showChart") {
        const item: BoardItem = {
          key:`k${a.keyCounter++}`, type:"showChart",
          content: action.description ?? "",
          color: action.color ?? "blue",
          description: action.description,
          data: action.data,
        };
        const sid = a.currentSectionId;
        setSections(prev => prev.map(s => s.id===sid ? { ...s, items:[...s.items,item] } : s));
        a.actionIdx++; a.delay = pace.between * 2; return;
      }
      if (action.type === "showImage") {
        const item: BoardItem = {
          key:`k${a.keyCounter++}`, type:"showImage",
          content: action.description ?? "",
          color: action.color ?? "blue",
          label: action.imageQuery ?? "",
          description: action.description,
        };
        const sid = a.currentSectionId;
        setSections(prev => prev.map(s => s.id===sid ? { ...s, items:[...s.items,item] } : s));
        a.actionIdx++; a.delay = pace.between * 3; return;
      }
      if (action.type === "showLocation") {
        const item: BoardItem = {
          key:`k${a.keyCounter++}`, type:"showLocation",
          content: action.name ?? "",
          color: action.color ?? "blue",
          label: action.country ?? "",
          description: action.description ?? "",
        };
        const sid = a.currentSectionId;
        setSections(prev => prev.map(s => s.id===sid ? { ...s, items:[...s.items,item] } : s));
        a.actionIdx++; a.delay = pace.between * 2; return;
      }

      const text = action.content ?? action.label ?? "";
      if (!text.trim()) { a.actionIdx++; return; }
      a.typing = {
        key:`k${a.keyCounter++}`, type:action.type, text,
        color:action.color??"white", label:action.label,
        description:action.description, chars:0,
      };
    }, TICK);

    return () => { clearInterval(interval); clearQueue(); };
  }, [loadingLesson, loadError, enqueue, clearQueue]); // eslint-disable-line

  // ── Controls ─────────────────────────────────────────────────────────────────

  function togglePause() {
    const next = !anim.current.paused;
    anim.current.paused = next;
    setIsPaused(next);
  }

  function manualAdvance() {
    setWaitingTap(false);
    waitingTapRef.current = false;
  }

  function restartStep() {
    const phases = phasesRef.current;
    const idx = anim.current.stepIdx;
    if (idx < 0 || idx >= phases.length) return;
    const freshId = `s${anim.current.keyCounter++}`;
    anim.current.currentSectionId = freshId;
    anim.current.actionIdx = 0;
    anim.current.delay = 4;
    anim.current.typing = null;
    anim.current.paused = false;
    anim.current.done   = false;
    // Replace current section with a fresh empty one
    setSections(prev => {
      const rest = prev.filter(s => s.id !== prev[prev.length-1]?.id);
      return [...rest, { id:freshId, phaseIdx:idx, title:phases[idx].title, items:[] }];
    });
    setTypingState(null); setCaptionState(null); setIsDone(false); setIsPaused(false);
    setWaitingTap(false); waitingTapRef.current = false;
    clearQueue();
    const vtR = phases[idx]?.voiceText ?? "";
    if (vtR.trim()) anim.current.voiceCaption = { text: vtR, phaseIdx: idx, startMs: Date.now() };
    else anim.current.voiceCaption = null;
    enqueue(vtR);
  }

  function jumpToStep(idx: number) {
    const phases = phasesRef.current;
    if (idx < 0 || idx >= phases.length) return;
    const freshId = `s${anim.current.keyCounter++}`;
    anim.current.currentSectionId = freshId;
    anim.current.stepIdx   = idx;
    anim.current.actionIdx = 0;
    anim.current.delay     = 10;
    anim.current.typing    = null;
    anim.current.done      = false;
    anim.current.paused    = false;
    setSections([{ id:freshId, phaseIdx:idx, title:phases[idx].title, items:[] }]);
    setTypingState(null); setCaptionState(null);
    setStepIdx(idx); setStepTitle(phases[idx]?.title ?? "");
    setIsDone(false); setIsPaused(false);
    setWaitingTap(false); waitingTapRef.current = false;
    clearQueue();
    const vtJ = phases[idx]?.voiceText ?? "";
    if (vtJ.trim()) anim.current.voiceCaption = { text: vtJ, phaseIdx: idx, startMs: Date.now() };
    else anim.current.voiceCaption = null;
    enqueue(vtJ);
    resetCtrlTimer();
  }

  const goNext = () => jumpToStep(anim.current.stepIdx + 1);
  const goPrev = () => jumpToStep(anim.current.stepIdx - 1);

  // ── Fullscreen ────────────────────────────────────────────────────────────────

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Controls auto-hide ────────────────────────────────────────────────────────

  function resetCtrlTimer() {
    setShowCtrl(true);
    if (ctrlTimerRef.current) clearTimeout(ctrlTimerRef.current);
    const delay = document.fullscreenElement ? 2000 : 5000;
    ctrlTimerRef.current = setTimeout(() => {
      if (!isDrawMode && !showSettings) setShowCtrl(false);
    }, delay);
  }
  useEffect(() => {
    resetCtrlTimer();
    return () => { if (ctrlTimerRef.current) clearTimeout(ctrlTimerRef.current); };
  }, []); // eslint-disable-line

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      resetCtrlTimer();
      if (e.key === " ") {
        e.preventDefault();
        if (manualModeRef.current && waitingTapRef.current) manualAdvance();
        else togglePause();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); goPrev(); }
      if (e.key === "d" || e.key === "D") setIsDrawMode(m => !m);
      if (e.key === "r" || e.key === "R") restartStep();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "Escape" && !document.fullscreenElement) handleExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line

  // ── Drawing canvas ────────────────────────────────────────────────────────────

  function clearDrawing() {
    const c = canvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (!isDrawMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
      canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    }
    const rect = canvas.getBoundingClientRect();
    let lx = e.clientX - rect.left, ly = e.clientY - rect.top;
    const onMove = (me: MouseEvent) => {
      const ctx = canvas.getContext("2d")!;
      const nx = me.clientX - rect.left, ny = me.clientY - rect.top;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(nx, ny);
      if (drawTool === "eraser") { ctx.globalCompositeOperation="destination-out"; ctx.lineWidth=32; }
      else { ctx.globalCompositeOperation="source-over"; ctx.strokeStyle=drawColor; ctx.lineWidth=3; }
      ctx.lineCap="round"; ctx.lineJoin="round"; ctx.stroke();
      lx=nx; ly=ny;
    };
    const onUp = () => { window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
    window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
  }

  // ── Broadcast helpers ─────────────────────────────────────────────────────────

  async function startBroadcast() {
    setBroadcastLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/whiteboard/broadcast`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("failed");
      const d = await r.json() as { code: string; writeSecret: string };
      broadcastCodeRef.current   = d.code;
      broadcastSecretRef.current = d.writeSecret;
      setBroadcastCode(d.code);
      setBroadcastSecret(d.writeSecret);
      setShowBroadcastModal(true);
    } catch {
      /* silently ignore — button stays clickable */
    } finally {
      setBroadcastLoading(false);
    }
  }

  async function stopBroadcast() {
    const code = broadcastCodeRef.current;
    broadcastCodeRef.current   = null;
    broadcastSecretRef.current = null;
    setBroadcastCode(null);
    setBroadcastSecret(null);
    setShowBroadcastModal(false);
    if (code) {
      fetch(`${API_BASE}/api/whiteboard/broadcast/${code}`, {
        method: "DELETE", credentials: "include",
      }).catch(() => {});
    }
  }

  function pushBoardState(currentSections: BoardSection[]) {
    const code   = broadcastCodeRef.current;
    const secret = broadcastSecretRef.current;
    if (!code || !secret) return;
    // Debounce rapid section updates
    if (broadcastFlushTimer.current) clearTimeout(broadcastFlushTimer.current);
    broadcastFlushTimer.current = setTimeout(() => {
      fetch(`${API_BASE}/api/whiteboard/broadcast/${code}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writeSecret: secret,
          title: planRef.current?.title ?? "",
          stepTitle: phasesRef.current[anim.current.stepIdx]?.title ?? "",
          sections: currentSections,
        }),
      }).catch(() => {});
    }, 200);
  }

  // Push state to students on every board update
  useEffect(() => {
    if (broadcastCode) pushBoardState(sections);
  }, [sections, broadcastCode]); // eslint-disable-line

  function handleExit() {
    if (broadcastCode) stopBroadcast();
    clearQueue();
    navigate("/teacher/smart-board");
  }

  // ── Loading / error ───────────────────────────────────────────────────────────

  if (loadingLesson) return (
    <div style={{ minHeight:"100vh", background:"#0d1108", display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column", gap:18 }}>
      <Loader2 size={44} color="#a8e6b0" style={{ animation:"spin 1s linear infinite" }}/>
      <p style={{ color:"#a8e6b0", fontFamily:"'Tajawal',sans-serif", fontSize:18 }}>جارٍ تحميل الدرس…</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (loadError) return (
    <div style={{ minHeight:"100vh", background:"#0d1108", display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column", gap:18 }}>
      <p style={{ color:"#f58080", fontFamily:"'Tajawal',sans-serif", fontSize:20 }}>{loadError}</p>
      <button onClick={() => navigate("/teacher/smart-board")}
        style={{ color:"#a8e6b0", background:"none", border:"1px solid #a8e6b0",
          borderRadius:8, padding:"8px 24px", cursor:"pointer", fontFamily:"'Tajawal',sans-serif" }}>
        العودة
      </button>
    </div>
  );

  const phases   = phasesRef.current;
  const plan     = planRef.current;
  const progress = phases.length > 1 ? (stepIdx / (phases.length-1)) * 100 : 0;
  const DRAW_COLORS = ["#f2ede0","#f5d76e","#a8e6b0","#f4a0a8","#9fc8f5","#f5b87a","#c4a8f0"];
  const activeId = anim.current.currentSectionId;

  // ── Section layout helpers ────────────────────────────────────────────────────

  /** A section is "big" if it has highlights/charts/connectors/images or many items → full width */
  function isSectionBig(s: BoardSection, activeTypingType?: string) {
    const BIG_TYPES = ["highlight","writeTitle","showChart","showImage","drawConnector"];
    if (s.items.some(i => BIG_TYPES.includes(i.type))) return true;
    const size = s.items.length + (activeId===s.id && anim.current.typing ? 1 : 0);
    if (size >= 4) return true;
    if (activeId===s.id && BIG_TYPES.includes(activeTypingType ?? "")) return true;
    return false;
  }

  const typingType = anim.current.typing?.type;
  const hasBigSection = sections.some(s => isSectionBig(s, typingType));
  const gridCols = (sections.length > 1 && !hasBigSection) ? "1fr 1fr" : "1fr";

  // ── Render ────────────────────────────────────────────────────────────────────

  const mobileSecBtn: React.CSSProperties = {
    background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.08)",
    color:"rgba(242,237,224,.6)", borderRadius:8, padding:"8px 12px", cursor:"pointer",
    display:"flex", alignItems:"center", gap:5,
    fontFamily:"'Tajawal',sans-serif", fontSize:13,
  };

  return (
    <div
      dir="rtl"
      style={{ position:"fixed", inset:0, zIndex:9999, background:"#0a0d08",
        display:"flex", flexDirection:"column",
        fontFamily:"'Tajawal','Noto Sans Arabic',sans-serif", overflow:"hidden" }}
      onMouseMove={resetCtrlTimer}
    >
      <ChalkDefs/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
        @keyframes spin         { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes chalkIn      { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes sectionAppear{ from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
        @keyframes blinkCursor  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes boardFlash   { 0%{opacity:1} 45%{opacity:.15} 100%{opacity:1} }
        @keyframes tapPulse     { 0%,100%{box-shadow:0 0 0 0 rgba(168,230,176,.6)} 60%{box-shadow:0 0 0 14px rgba(168,230,176,0)} }
        @keyframes settingsDrop { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
        /* KaTeX chalk overrides */
        .chalk-katex .katex        { color:inherit !important; font-size:inherit !important; }
        .chalk-katex .katex *      { color:inherit !important; }
        .chalk-katex .katex-display{ margin:.2em 0 !important; }
        .chalk-katex .base         { direction:ltr; }
        .chalk-katex .katex-html   { white-space:normal !important; }
      `}</style>

      {/* ── Board area ── */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        padding:"14px 14px 4px", position:"relative" }}>

        {/* Broadcast modal */}
        {showBroadcastModal && broadcastCode && (
          <div style={{ position:"fixed", inset:0, zIndex:100,
            background:"rgba(0,0,0,.65)", display:"flex", alignItems:"center", justifyContent:"center",
            backdropFilter:"blur(4px)" }}
            onClick={e => { if (e.target===e.currentTarget) setShowBroadcastModal(false); }}>
            <div style={{ background:"#111a12", border:"1px solid rgba(168,230,176,.25)",
              borderRadius:18, padding:"32px 36px", maxWidth:400, width:"calc(100% - 40px)",
              fontFamily:"'Tajawal',sans-serif", direction:"rtl",
              boxShadow:"0 20px 60px rgba(0,0,0,.8)" }}>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Radio size={20} color="#a8e6b0"/>
                  <span style={{ color:"#a8e6b0", fontSize:18, fontWeight:700 }}>البث المباشر</span>
                </div>
                <button onClick={() => setShowBroadcastModal(false)}
                  style={{ background:"none", border:"none", color:"rgba(255,255,255,.3)",
                    cursor:"pointer", padding:4, borderRadius:6 }}>
                  <X size={16}/>
                </button>
              </div>

              <p style={{ color:"rgba(242,237,224,.6)", fontSize:14, marginBottom:20, lineHeight:1.7 }}>
                اطلب من الطلاب فتح <strong style={{ color:"#a8e6b0" }}>hasad.app</strong> والضغط على "شاهد السبورة"، ثم إدخال الرمز:
              </p>

              {/* Big code display */}
              <div style={{ background:"rgba(168,230,176,.06)", border:"2px solid rgba(168,230,176,.3)",
                borderRadius:12, padding:"18px 24px", textAlign:"center", marginBottom:20,
                position:"relative" }}>
                <div style={{ color:"#a8e6b0", fontSize:46, fontWeight:900, letterSpacing:10,
                  fontFamily:"'Courier New',monospace", lineHeight:1.1 }}>
                  {broadcastCode}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(broadcastCode).catch(() => {});
                    setBroadcastCopied(true);
                    setTimeout(() => setBroadcastCopied(false), 2000);
                  }}
                  style={{ position:"absolute", top:10, left:10, background:"rgba(168,230,176,.1)",
                    border:"1px solid rgba(168,230,176,.3)", color:"#a8e6b0",
                    borderRadius:8, padding:"5px 8px", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:4, fontSize:12 }}>
                  {broadcastCopied ? <><Check size={12}/> تم</> : <><Copy size={12}/> نسخ</>}
                </button>
              </div>

              <p style={{ color:"rgba(242,237,224,.4)", fontSize:12, textAlign:"center", marginBottom:20 }}>
                السبورة تتحدّث على شاشات الطلاب بشكل تلقائي ✦
              </p>

              <button onClick={stopBroadcast}
                style={{ width:"100%", background:"rgba(245,128,128,.1)",
                  border:"1px solid rgba(245,128,128,.35)", borderRadius:10,
                  color:"#f58080", padding:"12px", cursor:"pointer",
                  fontFamily:"'Tajawal',sans-serif", fontSize:15, fontWeight:700 }}>
                إيقاف البث
              </button>
            </div>
          </div>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)",
            zIndex:20, width:"min(780px,calc(100% - 40px))",
            background:"rgba(10,13,8,.97)", border:"1px solid rgba(255,255,255,.1)",
            borderRadius:16, padding:"20px 24px",
            boxShadow:"0 -8px 40px rgba(0,0,0,.65)",
            animation:"settingsDrop .22s ease" }}>

            {/* Voices */}
            <div style={{ marginBottom:18 }}>
              <p style={{ color:"rgba(242,237,224,.4)", fontSize:11, fontWeight:700,
                letterSpacing:1.5, marginBottom:10, textTransform:"uppercase" }}>الصوت</p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {VOICES.map(v => (
                  <button key={v.id} onClick={() => setVoice(v.id)}
                    style={{ background: voice===v.id ? `${v.dot}18`:"rgba(255,255,255,.04)",
                      border: `1.5px solid ${voice===v.id ? v.dot+"80":"rgba(255,255,255,.08)"}`,
                      borderRadius:12, padding:"10px 16px", cursor:"pointer",
                      display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2, minWidth:96 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:v.dot,
                        display:"inline-block", boxShadow: voice===v.id ? `0 0 8px ${v.dot}`:undefined }}/>
                      <span style={{ color: voice===v.id ? v.dot:"rgba(242,237,224,.7)",
                        fontWeight:700, fontSize:15, fontFamily:"'Tajawal',sans-serif" }}>{v.ar}</span>
                    </div>
                    <span style={{ color:"rgba(242,237,224,.3)", fontSize:11,
                      fontFamily:"'Tajawal',sans-serif", paddingRight:14 }}>{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pace */}
            <div style={{ marginBottom:18 }}>
              <p style={{ color:"rgba(242,237,224,.4)", fontSize:11, fontWeight:700,
                letterSpacing:1.5, marginBottom:10, textTransform:"uppercase" }}>الوتيرة — كتابة + صوت</p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {PACES.map(p => (
                  <button key={p.id} onClick={() => setPaceId(p.id)}
                    style={{ background: paceId===p.id ?"rgba(168,230,176,.15)":"rgba(255,255,255,.04)",
                      border: `1.5px solid ${paceId===p.id?"rgba(168,230,176,.5)":"rgba(255,255,255,.08)"}`,
                      borderRadius:12, padding:"10px 18px", cursor:"pointer",
                      display:"flex", alignItems:"center", gap:8,
                      color: paceId===p.id?"#a8e6b0":"rgba(242,237,224,.6)",
                      fontFamily:"'Tajawal',sans-serif", fontSize:14,
                      fontWeight: paceId===p.id ? 700:400 }}>
                    <span style={{ fontSize:16 }}>{p.icon}</span>
                    <span>{p.ar}</span>
                    <span style={{ fontSize:11, opacity:.5 }}>{p.rate}×</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font size + manual mode */}
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"rgba(242,237,224,.4)", fontSize:11, fontWeight:700, letterSpacing:1.5 }}>الحجم</span>
                <button onClick={() => setFontSize(f => Math.max(.6,+(f-.1).toFixed(1)))}
                  style={{ background:"rgba(255,255,255,.06)", border:"none", color:"rgba(242,237,224,.7)",
                    borderRadius:8, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <ZoomOut size={15}/>
                </button>
                <span style={{ color:"#f2ede0", fontSize:14, minWidth:36, textAlign:"center", fontWeight:700 }}>
                  {Math.round(fontSize*100)}%
                </span>
                <button onClick={() => setFontSize(f => Math.min(1.6,+(f+.1).toFixed(1)))}
                  style={{ background:"rgba(255,255,255,.06)", border:"none", color:"rgba(242,237,224,.7)",
                    borderRadius:8, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <ZoomIn size={15}/>
                </button>
              </div>

              <button onClick={() => { setManualMode(m=>!m); if (waitingTap) { setWaitingTap(false); waitingTapRef.current=false; } }}
                style={{ background: manualMode?"rgba(245,215,110,.15)":"rgba(255,255,255,.04)",
                  border: `1.5px solid ${manualMode?"rgba(245,215,110,.5)":"rgba(255,255,255,.08)"}`,
                  borderRadius:12, padding:"10px 18px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:8,
                  color: manualMode?"#f5d76e":"rgba(242,237,224,.6)",
                  fontFamily:"'Tajawal',sans-serif", fontSize:14, fontWeight: manualMode?700:400 }}>
                <Hand size={15}/>
                <span>وضع يدوي</span>
                <span style={{ fontSize:11, opacity:.5 }}>Space</span>
              </button>
            </div>
          </div>
        )}

        {/* Wooden frame */}
        <div style={{ position:"relative", width:"100%", maxWidth:1280,
          height:"calc(100vh - 100px)", borderRadius:6, padding:20,
          background:"linear-gradient(135deg,#6b3d18,#8b5a28,#7a4e20,#9c6830,#6b3d18)",
          boxShadow:"0 0 0 3px #4a2a0e, 0 8px 48px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.08)" }}>

          {/* Corner bolts */}
          {([{top:8,right:8},{top:8,left:8},{bottom:8,right:8},{bottom:8,left:8}] as React.CSSProperties[]).map((pos,i) => (
            <div key={i} style={{ position:"absolute", ...pos, width:14, height:14,
              borderRadius:"50%", zIndex:10,
              background:"radial-gradient(circle at 35% 35%,#c8943a,#7a5520)",
              boxShadow:"0 1px 3px rgba(0,0,0,.5)" }}/>
          ))}

          {/* Board surface */}
          <div style={{ position:"relative", width:"100%", height:"100%",
            background:"linear-gradient(160deg,#1a2b1e 0%,#152318 40%,#1c2e20 100%)",
            borderRadius:3,
            boxShadow:"inset 0 2px 20px rgba(0,0,0,.6)",
            overflow:"hidden",
            animation: flashClear ? "boardFlash .32s ease" : "none" }}>

            {/* Texture */}
            <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1,
              backgroundImage:"radial-gradient(ellipse at 20% 80%,rgba(255,255,255,.012) 0%,transparent 50%)" }}/>

            {/* Step dots */}
            <div style={{ position:"absolute", top:14, right:18, zIndex:5,
              display:"flex", gap:6, alignItems:"center",
              opacity: showCtrl ? 1:.2, transition:"opacity .5s" }}>
              {phases.map((_,i) => (
                <button key={i} onClick={() => jumpToStep(i)}
                  style={{ width: i===stepIdx ? 22:7, height:7, borderRadius:4,
                    border:"none", padding:0, cursor:"pointer", transition:"all .35s",
                    background: i===stepIdx?"rgba(242,237,224,.7)":i<stepIdx?"rgba(242,237,224,.25)":"rgba(242,237,224,.1)" }}/>
              ))}
            </div>

            {/* Lesson title */}
            <div style={{ position:"absolute", top:18, left:22, zIndex:5,
              opacity: showCtrl ? 1:.15, transition:"opacity .5s" }}>
              <span style={{ fontFamily:"'Tajawal',sans-serif", color:"rgba(242,237,224,.28)",
                fontSize:12, fontWeight:500, letterSpacing:.5, filter:"url(#chalk-rough)" }}>
                {plan?.title ?? ""}
              </span>
            </div>

            {/* ── Section content grid ── */}
            <div
              ref={contentRef}
              style={{ position:"absolute", inset:0,
                padding:"48px 40px 72px", overflow:"hidden", zIndex:2,
                pointerEvents: isDrawMode ? "none" : "auto" }}
            >
              <div style={{
                display:"grid",
                gridTemplateColumns: gridCols,
                gap:"0 0",
                alignItems:"start",
                height:"100%",
              }}>
                {sections.map((section, si) => {
                  const isActive = section.id === activeId;
                  const big      = isSectionBig(section, isActive ? typingType : undefined);
                  const showDiv  = si < sections.length-1 && !hasBigSection;

                  return (
                    <div key={section.id}
                      style={{
                        gridColumn: big ? "1 / -1" : "auto",
                        padding: sections.length > 1 && !big ? "0 28px" : "0 8px",
                        borderRight: showDiv ? "1px dashed rgba(242,237,224,.1)" : "none",
                        animation: "sectionAppear .4s ease",
                        position:"relative",
                      }}>

                      {/* Section label */}
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                        <span style={{
                          width:30, height:30, borderRadius:"50%", flexShrink:0,
                          border:"1.5px solid rgba(242,237,224,.25)",
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          color:"rgba(242,237,224,.4)", fontSize:13, fontWeight:700,
                          filter:"url(#chalk-rough)",
                        }}>
                          {section.phaseIdx + 1}
                        </span>
                        <span style={{
                          fontFamily:"'Tajawal',sans-serif",
                          color:"rgba(242,237,224,.45)",
                          fontSize:sections.length===1 ? 22:18,
                          fontWeight:600,
                          filter:"url(#chalk-rough)",
                          borderBottom:"1px solid rgba(242,237,224,.1)",
                          paddingBottom:3,
                          textShadow:"0 0 5px rgba(242,237,224,.1)",
                        }}>
                          {section.title}
                        </span>
                        {/* "New" badge for active section with items */}
                        {isActive && section.items.length === 0 && (
                          <span style={{ width:7, height:7, borderRadius:"50%",
                            background:"#a8e6b0", display:"inline-block",
                            animation:"tapPulse 1.8s infinite" }}/>
                        )}
                      </div>

                      {/* ── Voice caption: spoken words appear in sync with audio ── */}
                      {(() => {
                        const phaseVoice = phasesRef.current[section.phaseIdx]?.voiceText ?? "";
                        if (!phaseVoice.trim()) return null;
                        const hasCaption = captionState?.phaseIdx === section.phaseIdx;
                        // Active section: show only what's been spoken so far (0 if not started yet)
                        // Inactive (old) section: show full text permanently
                        const chars = hasCaption ? captionState!.chars : (isActive ? 0 : phaseVoice.length);
                        const shown = wordSlice(phaseVoice, chars);
                        const stillTyping = isActive && hasCaption && chars < phaseVoice.length;
                        return (
                          <div style={{
                            fontFamily: "'Tajawal', sans-serif",
                            fontSize: Math.round(21 * fontSize),
                            color: "rgba(242,237,224,.93)",
                            lineHeight: 1.85,
                            marginBottom: 14,
                            direction: "rtl",
                            filter: "url(#chalk-rough)",
                            textShadow: "0 0 10px rgba(242,237,224,.1)",
                            minHeight: "1.5em",
                          }}>
                            {shown}
                            {stillTyping && (
                              <span style={{
                                display: "inline-block", width: 2, height: "0.85em",
                                background: "rgba(242,237,224,.75)",
                                marginInlineStart: 3, verticalAlign: "middle",
                                animation: "tapPulse 0.85s infinite",
                              }} />
                            )}
                          </div>
                        );
                      })()}

                      {/* Committed items */}
                      {section.items.map(item => (
                        <BoardLine key={item.key} item={item} scale={fontSize}/>
                      ))}

                      {/* Typing item (only in active section) */}
                      {isActive && typingState && anim.current.typing && (
                        <BoardLine
                          key={anim.current.typing.key + "_t"}
                          item={{
                            key: anim.current.typing.key,
                            type: anim.current.typing.type,
                            content: anim.current.typing.text,
                            color: anim.current.typing.color,
                            label: anim.current.typing.label,
                            description: anim.current.typing.description,
                          }}
                          typedChars={typingState.chars}
                          scale={fontSize}
                        />
                      )}

                      {/* Manual-mode advance button (active section) */}
                      {isActive && waitingTap && (
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:18, animation:"chalkIn .3s" }}>
                          <button onClick={manualAdvance}
                            style={{ background:"rgba(168,230,176,.1)", border:"1.5px solid rgba(168,230,176,.4)",
                              borderRadius:20, padding:"9px 22px", cursor:"pointer",
                              color:"#a8e6b0", fontFamily:"'Tajawal',sans-serif",
                              fontSize:14, fontWeight:700, animation:"tapPulse 1.8s infinite",
                              display:"flex", alignItems:"center", gap:8 }}>
                            <Hand size={15}/> اضغط للمتابعة
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Done — key points */}
                {isDone && plan?.keyPoints && plan.keyPoints.length > 0 && (
                  <div style={{ gridColumn:"1 / -1", marginTop:28, padding:"18px 22px",
                    border:"1.5px solid rgba(168,230,176,.2)", borderRadius:8,
                    background:"rgba(168,230,176,.04)", animation:"chalkIn .5s" }}>
                    <div style={{ color:"rgba(168,230,176,.65)", fontWeight:700,
                      fontSize:14, marginBottom:12, filter:"url(#chalk-rough)" }}>
                      ✦ النقاط الرئيسية
                    </div>
                    {plan.keyPoints.map((kp,i) => (
                      <div key={i} style={{ display:"flex", gap:10, marginBottom:9 }}>
                        <span style={{ color:"rgba(168,230,176,.5)", fontSize:10, marginTop:9, flexShrink:0 }}>◆</span>
                        <span style={{ color:"rgba(242,237,224,.6)", fontSize:Math.round(20*fontSize),
                          filter:"url(#chalk-rough)", fontFamily:"'Tajawal',sans-serif" }}>{kp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawing canvas */}
            <canvas ref={canvasRef} style={{
              position:"absolute", inset:0, width:"100%", height:"100%", zIndex:3,
              pointerEvents: isDrawMode?"all":"none",
              cursor: isDrawMode?(drawTool==="eraser"?"cell":"crosshair"):"default",
            }} onMouseDown={handleCanvasMouseDown}/>

            {/* Draw mode badge */}
            {isDrawMode && (
              <div style={{ position:"absolute", top:13, left:"50%", transform:"translateX(-50%)", zIndex:8,
                background:"rgba(245,215,110,.15)", border:"1px solid rgba(245,215,110,.4)",
                color:"#f5d76e", borderRadius:20, padding:"5px 18px",
                fontSize:12, fontWeight:700, fontFamily:"'Tajawal',sans-serif", letterSpacing:.5 }}>
                ✏️ وضع الكتابة — D للخروج
              </div>
            )}

            {/* Chalk tray */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:11,
              background:"linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.06))",
              borderTop:"1px solid rgba(255,255,255,.05)",
              display:"flex", alignItems:"center", paddingRight:20, gap:6, zIndex:4 }}>
              {["#f2ede0","#f5d76e","#a8e6b0","#9fc8f5","#f4a0a8"].map((c,i) => (
                <div key={i} style={{ width:26, height:5, borderRadius:3, background:c, opacity:.2,
                  transform:`rotate(${(i-2)*2}deg)` }}/>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls bar ── */}
      {isMobile ? (
        /* ════ MOBILE controls — always visible, touch-friendly ════ */
        <div style={{ flexShrink:0, background:"rgba(10,13,8,.97)",
          borderTop:"1px solid rgba(255,255,255,.1)",
          paddingBottom:"env(safe-area-inset-bottom)",
          opacity: 1,
          pointerEvents: "all" }}
          onTouchStart={resetCtrlTimer}>

          {/* Main row: prev / pause / next / mute / more */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-around",
            padding:"10px 12px 6px" }}>

            {/* السابق */}
            <button onClick={goPrev} disabled={stepIdx===0}
              style={{ background:"rgba(255,255,255,.07)", border:"none",
                color: stepIdx===0?"rgba(255,255,255,.2)":"rgba(242,237,224,.8)",
                borderRadius:10, padding:"10px 16px", cursor:stepIdx===0?"not-allowed":"pointer",
                display:"flex", alignItems:"center", gap:5,
                fontFamily:"'Tajawal',sans-serif", fontSize:14, fontWeight:600 }}>
              <ChevronRight size={16}/> السابق
            </button>

            {/* إيقاف / متابعة */}
            <button onClick={() => {
              if (manualModeRef.current && waitingTapRef.current) manualAdvance();
              else togglePause();
            }}
              style={{ background: isPaused?"rgba(168,230,176,.18)":"rgba(255,255,255,.1)",
                border: `1.5px solid ${isPaused?"rgba(168,230,176,.5)":"rgba(255,255,255,.12)"}`,
                color: isPaused?"#a8e6b0":"rgba(242,237,224,.9)",
                borderRadius:12, padding:"12px 22px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:8,
                fontFamily:"'Tajawal',sans-serif", fontSize:15, fontWeight:700 }}>
              {isPaused ? <><Play size={16}/> متابعة</> : <><Pause size={16}/> إيقاف</>}
            </button>

            {/* التالي */}
            <button onClick={goNext} disabled={isDone && stepIdx >= phasesRef.current.length-1}
              style={{ background:"rgba(255,255,255,.07)", border:"none",
                color:(isDone&&stepIdx>=phasesRef.current.length-1)?"rgba(255,255,255,.2)":"rgba(242,237,224,.8)",
                borderRadius:10, padding:"10px 16px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:5,
                fontFamily:"'Tajawal',sans-serif", fontSize:14, fontWeight:600 }}>
              التالي <ChevronLeft size={16}/>
            </button>

            {/* الصوت */}
            <button onClick={() => { const n=!isMuted; setIsMuted(n); isMutedRef.current=n; if(n) clearQueue(); }}
              style={{ background:"rgba(255,255,255,.07)", border:"none",
                color: isMuted?"rgba(255,100,100,.6)":"rgba(242,237,224,.6)",
                borderRadius:10, padding:"10px 12px", cursor:"pointer" }}>
              {isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
            </button>

            {/* المزيد */}
            <button onClick={() => setShowMoreMenu(m=>!m)}
              style={{ background: showMoreMenu?"rgba(168,230,176,.12)":"rgba(255,255,255,.07)",
                border:`1px solid ${showMoreMenu?"rgba(168,230,176,.35)":"transparent"}`,
                color: showMoreMenu?"#a8e6b0":"rgba(242,237,224,.6)",
                borderRadius:10, padding:"10px 12px", cursor:"pointer" }}>
              <Settings size={18}/>
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ height:3, background:"rgba(255,255,255,.07)", margin:"0 16px 8px" }}>
            <div style={{ height:"100%", background:"rgba(168,230,176,.5)", width:`${progress}%`,
              transition:"width .6s ease", borderRadius:2 }}/>
          </div>

          {/* Expanded menu */}
          {showMoreMenu && (
            <div style={{ borderTop:"1px solid rgba(255,255,255,.06)",
              padding:"10px 16px 4px",
              display:"flex", flexWrap:"wrap", gap:8 }}>

              {/* إعادة */}
              <button onClick={() => { restartStep(); }}
                style={mobileSecBtn}>
                <RotateCcw size={14}/> إعادة
              </button>

              {/* رسم */}
              <button onClick={() => setIsDrawMode(m=>!m)}
                style={{ ...mobileSecBtn,
                  background: isDrawMode?"rgba(245,215,110,.12)":"rgba(255,255,255,.06)",
                  border:`1px solid ${isDrawMode?"rgba(245,215,110,.4)":"rgba(255,255,255,.08)"}`,
                  color: isDrawMode?"#f5d76e":"rgba(242,237,224,.6)" }}>
                <Pencil size={14}/> رسم
              </button>

              {/* Draw color strip */}
              {isDrawMode && (
                <div style={{ display:"flex", alignItems:"center", gap:6,
                  background:"rgba(0,0,0,.4)", borderRadius:8, padding:"6px 10px",
                  border:"1px solid rgba(255,255,255,.08)" }}>
                  {DRAW_COLORS.map(c => (
                    <button key={c} onClick={() => { setDrawColor(c); setDrawTool("pen"); }}
                      style={{ width:20, height:20, borderRadius:"50%", background:c, padding:0, cursor:"pointer",
                        border: drawColor===c&&drawTool==="pen"?"2.5px solid white":"2.5px solid transparent" }}/>
                  ))}
                  <button onClick={() => setDrawTool("eraser")}
                    style={{ background:drawTool==="eraser"?"rgba(255,255,255,.15)":"transparent",
                      border:"none", color:"rgba(242,237,224,.6)", borderRadius:5, padding:"3px 7px", cursor:"pointer" }}>
                    <Eraser size={14}/>
                  </button>
                  <button onClick={clearDrawing}
                    style={{ background:"transparent", border:"none", color:"rgba(245,128,128,.7)",
                      borderRadius:5, padding:"3px 6px", cursor:"pointer" }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              )}

              {/* إعدادات الصوت */}
              <button onClick={() => { setShowSettings(s=>!s); }}
                style={{ ...mobileSecBtn,
                  background: showSettings?"rgba(168,230,176,.12)":"rgba(255,255,255,.06)",
                  border:`1px solid ${showSettings?"rgba(168,230,176,.35)":"rgba(255,255,255,.08)"}`,
                  color: showSettings?"#a8e6b0":"rgba(242,237,224,.6)" }}>
                <Volume2 size={14}/> الصوت
              </button>

              {/* شارك مع الطلاب */}
              <button onClick={() => broadcastCode ? setShowBroadcastModal(true) : startBroadcast()}
                disabled={broadcastLoading}
                style={{ ...mobileSecBtn,
                  background: broadcastCode?"rgba(168,230,176,.15)":"rgba(255,255,255,.06)",
                  border:`1px solid ${broadcastCode?"rgba(168,230,176,.5)":"rgba(255,255,255,.08)"}`,
                  color: broadcastCode?"#a8e6b0":"rgba(242,237,224,.6)" }}>
                {broadcastLoading
                  ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>
                  : <Radio size={14}/>}
                {broadcastCode ? "بث مباشر" : "شارك"}
                {broadcastCode && <span style={{ width:6,height:6,borderRadius:"50%",background:"#a8e6b0",display:"inline-block" }}/>}
              </button>

              {/* ملء الشاشة */}
              <button onClick={() => { toggleFullscreen(); resetCtrlTimer(); }}
                style={{ ...mobileSecBtn,
                  background: isFullscreen?"rgba(168,230,176,.12)":"rgba(255,255,255,.06)",
                  color: isFullscreen?"#a8e6b0":"rgba(242,237,224,.6)" }}>
                {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
                {isFullscreen ? "تصغير" : "ملء الشاشة"}
              </button>

              {/* خروج */}
              <button onClick={handleExit}
                style={{ ...mobileSecBtn, color:"rgba(245,128,128,.6)" }}>
                <X size={14}/> خروج
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ════ DESKTOP controls ════ */
        <div style={{ flexShrink:0, height:50,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 26px",
          opacity: showCtrl ? 1:0, transition:"opacity .5s",
          pointerEvents: showCtrl ? "all":"none" }}>

          {/* Left: nav + playback */}
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <button onClick={goPrev} disabled={stepIdx===0}
              style={{ background:"rgba(255,255,255,.06)", border:"none",
                color: stepIdx===0?"rgba(255,255,255,.2)":"rgba(242,237,224,.7)",
                borderRadius:8, padding:"7px 12px", cursor:stepIdx===0?"not-allowed":"pointer",
                display:"flex", alignItems:"center", gap:4, fontFamily:"'Tajawal',sans-serif", fontSize:13 }}>
              <ChevronRight size={13}/> السابق
            </button>

            <button onClick={() => {
              if (manualModeRef.current && waitingTapRef.current) manualAdvance();
              else togglePause();
            }}
              style={{ background: isPaused?"rgba(168,230,176,.15)":"rgba(255,255,255,.08)",
                border: `1px solid ${isPaused?"rgba(168,230,176,.4)":"rgba(255,255,255,.08)"}`,
                color: isPaused?"#a8e6b0":"rgba(242,237,224,.8)",
                borderRadius:8, padding:"8px 20px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:7,
                fontFamily:"'Tajawal',sans-serif", fontSize:14, fontWeight:600 }}>
              {isPaused ? <><Play size={15}/> متابعة</> : <><Pause size={15}/> إيقاف</>}
            </button>

            <button onClick={goNext} disabled={isDone && stepIdx >= phasesRef.current.length-1}
              style={{ background:"rgba(255,255,255,.06)", border:"none",
                color:(isDone&&stepIdx>=phasesRef.current.length-1)?"rgba(255,255,255,.2)":"rgba(242,237,224,.7)",
                borderRadius:8, padding:"7px 12px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:4, fontFamily:"'Tajawal',sans-serif", fontSize:13 }}>
              التالي <ChevronLeft size={13}/>
            </button>

            <button onClick={restartStep} title="إعادة (R)"
              style={{ background:"rgba(255,255,255,.05)", border:"none",
                color:"rgba(242,237,224,.35)", borderRadius:8, padding:"8px 9px", cursor:"pointer" }}>
              <RotateCcw size={13}/>
            </button>
          </div>

          {/* Center: progress */}
          <div style={{ flex:1, maxWidth:300, margin:"0 20px" }}>
            <div style={{ height:3, background:"rgba(255,255,255,.08)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"rgba(168,230,176,.5)", width:`${progress}%`,
                transition:"width .6s ease", borderRadius:2 }}/>
            </div>
          </div>

          {/* Right: tools */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={() => setIsDrawMode(m=>!m)}
              style={{ background: isDrawMode?"rgba(245,215,110,.12)":"rgba(255,255,255,.06)",
                border: `1px solid ${isDrawMode?"rgba(245,215,110,.4)":"transparent"}`,
                color: isDrawMode?"#f5d76e":"rgba(242,237,224,.4)",
                borderRadius:8, padding:"7px 10px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, fontSize:13, fontFamily:"'Tajawal',sans-serif" }}>
              <Pencil size={13}/> رسم
            </button>

            {isDrawMode && (
              <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,.5)",
                borderRadius:8, padding:"4px 9px", border:"1px solid rgba(255,255,255,.08)" }}>
                {DRAW_COLORS.map(c => (
                  <button key={c} onClick={() => { setDrawColor(c); setDrawTool("pen"); }}
                    style={{ width:16, height:16, borderRadius:"50%", background:c, padding:0, cursor:"pointer",
                      border: drawColor===c&&drawTool==="pen"?"2px solid white":"2px solid transparent" }}/>
                ))}
                <button onClick={() => setDrawTool("eraser")}
                  style={{ background: drawTool==="eraser"?"rgba(255,255,255,.15)":"transparent",
                    border:"none", color:"rgba(242,237,224,.6)", borderRadius:5, padding:"3px 6px", cursor:"pointer" }}>
                  <Eraser size={13}/>
                </button>
                <button onClick={clearDrawing}
                  style={{ background:"transparent", border:"none", color:"rgba(245,128,128,.7)",
                    borderRadius:5, padding:"3px 5px", cursor:"pointer" }}>
                  <Trash2 size={12}/>
                </button>
              </div>
            )}

            <button onClick={() => { setShowSettings(s=>!s); resetCtrlTimer(); }}
              style={{ background: showSettings?"rgba(168,230,176,.12)":"rgba(255,255,255,.06)",
                border: `1px solid ${showSettings?"rgba(168,230,176,.35)":"transparent"}`,
                color: showSettings?"#a8e6b0":"rgba(242,237,224,.4)",
                borderRadius:8, padding:"7px 10px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, fontSize:13, fontFamily:"'Tajawal',sans-serif" }}>
              <Settings size={13}/> إعدادات
              <span style={{ width:6, height:6, borderRadius:"50%",
                background:VOICES.find(v=>v.id===voice)?.dot??"#f2ede0",
                display:"inline-block", marginRight:2 }}/>
            </button>

            <button onClick={() => { const n=!isMuted; setIsMuted(n); isMutedRef.current=n; if(n) clearQueue(); }}
              style={{ background:"rgba(255,255,255,.06)", border:"none",
                color: isMuted?"rgba(255,255,255,.2)":"rgba(242,237,224,.45)",
                borderRadius:8, padding:"7px 9px", cursor:"pointer" }}>
              {isMuted ? <VolumeX size={15}/> : <Volume2 size={15}/>}
            </button>

            <button onClick={() => { toggleFullscreen(); resetCtrlTimer(); }}
              title={isFullscreen ? "خروج من ملء الشاشة (F)" : "عرض ملء الشاشة (F)"}
              style={{ background: isFullscreen ? "rgba(168,230,176,.12)" : "rgba(255,255,255,.06)",
                border: `1px solid ${isFullscreen ? "rgba(168,230,176,.35)" : "transparent"}`,
                color: isFullscreen ? "#a8e6b0" : "rgba(242,237,224,.45)",
                borderRadius:8, padding:"7px 10px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, fontFamily:"'Tajawal',sans-serif", fontSize:13 }}>
              {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
              <span>{isFullscreen ? "تصغير" : "ملء الشاشة"}</span>
            </button>

            <button
              onClick={() => broadcastCode ? setShowBroadcastModal(true) : startBroadcast()}
              disabled={broadcastLoading}
              style={{ background: broadcastCode?"rgba(168,230,176,.15)":"rgba(255,255,255,.06)",
                border: `1px solid ${broadcastCode?"rgba(168,230,176,.5)":"transparent"}`,
                color: broadcastCode ? "#a8e6b0" : "rgba(242,237,224,.45)",
                borderRadius:8, padding:"7px 10px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:5,
                fontFamily:"'Tajawal',sans-serif", fontSize:13 }}>
              {broadcastLoading
                ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>
                : <Radio size={13}/>}
              {broadcastCode ? "بث مباشر" : "شارك مع الطلاب"}
              {broadcastCode && (
                <span style={{ width:7, height:7, borderRadius:"50%",
                  background:"#a8e6b0", display:"inline-block",
                  animation:"tapPulse 1.8s infinite", marginRight:2 }}/>
              )}
            </button>

            <button
              onClick={() => { clearQueue(); navigate(`/teacher/smart-board/edit/${params?.id}`); }}
              style={{ background:"rgba(255,255,255,.04)", border:"none",
                color:"rgba(242,237,224,.35)", borderRadius:8, padding:"7px 10px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:4, fontFamily:"'Tajawal',sans-serif", fontSize:12 }}>
              <Edit2 size={13}/> تعديل
            </button>

            <button onClick={handleExit}
              style={{ background:"rgba(255,255,255,.04)", border:"none",
                color:"rgba(242,237,224,.28)", borderRadius:8, padding:"7px 10px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:4, fontFamily:"'Tajawal',sans-serif", fontSize:12 }}>
              <X size={13}/> خروج
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
