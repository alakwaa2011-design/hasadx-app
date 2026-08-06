/**
 * Student Smart Board Viewer
 * Students enter a 6-char code and see the teacher's chalk board in real-time (polling).
 */
import { useState, useEffect, useRef } from "react";
import { Loader2, Radio, RefreshCw } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS  = 1500;

// ── Chalk colors ──────────────────────────────────────────────────────────────

const CHALK: Record<string, string> = {
  white:"#f2ede0", yellow:"#f5d76e", green:"#a8e6b0",
  pink:"#f4a0a8",  blue:"#9fc8f5",  orange:"#f5b87a",
  red:"#f58080",   purple:"#c4a8f0",
};
const ch = (c?: string) => CHALK[c ?? "white"] ?? c ?? CHALK.white;

// ── Types (mirror presenter) ──────────────────────────────────────────────────

interface BoardItem {
  key:string; type:string; content:string; color:string;
  label?:string; description?:string;
  data?:Array<{label:string; value:number}>;
}
interface BoardSection {
  id:string; phaseIdx:number; title:string; items:BoardItem[];
}
interface BroadcastState {
  title:string; stepTitle:string; sections:BoardSection[];
}

// ── Chalk SVG filter ──────────────────────────────────────────────────────────

function ChalkDefs() {
  return (
    <svg width="0" height="0" style={{ position:"absolute", overflow:"hidden" }}>
      <defs>
        <filter id="chalk-rough-sv" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="4" seed="3" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  );
}

// ── Board item renderer (read-only, no typing animation) ─────────────────────

function BoardLine({ item }: { item: BoardItem }) {
  const color = ch(item.color);
  if (item.type === "clearBoard" || item.type === "erase") return null;

  const cs: React.CSSProperties = {
    fontFamily:"'Tajawal','Noto Sans Arabic',sans-serif",
    color,
    filter:"url(#chalk-rough-sv)",
    textShadow:`0 0 4px ${color}55, 1px 1px 0 rgba(0,0,0,.4)`,
  };

  if (item.type === "drawArrow") return (
    <div style={{ display:"flex", alignItems:"center", gap:14, margin:"12px 0" }}>
      <svg width={72} height={28} viewBox="0 0 72 28" style={{ filter:"url(#chalk-rough-sv)", flexShrink:0 }}>
        <line x1="4" y1="14" x2="62" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <polygon points="62,8 72,14 62,20" fill={color}/>
      </svg>
      {item.label && <span style={{ ...cs, fontSize:24, fontWeight:700 }}>{item.label}</span>}
    </div>
  );

  if (item.type === "drawCircle") return (
    <div style={{ display:"flex", alignItems:"center", gap:14, margin:"10px 0" }}>
      <svg width={48} height={48} viewBox="0 0 48 48" style={{ filter:"url(#chalk-rough-sv)", flexShrink:0 }}>
        <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="2.5"/>
      </svg>
      {item.label && <span style={{ ...cs, fontSize:22, fontWeight:700 }}>{item.label}</span>}
    </div>
  );

  if (item.type === "showDiagram") return (
    <div style={{ border:`1.5px dashed ${color}60`, borderRadius:8, padding:"12px 16px",
      margin:"12px 0", display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ fontSize:20, flexShrink:0 }}>📐</span>
      <span style={{ ...cs, fontSize:18 }}>{item.description ?? item.content}</span>
    </div>
  );

  if (item.type === "drawConnector") {
    const boxStyle: React.CSSProperties = {
      border:`1.5px solid ${color}70`, borderRadius:6,
      padding:"7px 14px", fontFamily:"'Tajawal',sans-serif",
      color, fontWeight:700, fontSize:24, filter:"url(#chalk-rough-sv)",
      textShadow:`0 0 4px ${color}44`, background:"rgba(0,0,0,.18)",
    };
    return (
      <div style={{ display:"flex", alignItems:"center", gap:10, margin:"18px 0", flexWrap:"wrap" }}>
        <span style={boxStyle}>{item.content}</span>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, flexShrink:0 }}>
          {item.label && <span style={{ ...cs, fontSize:12, opacity:.7 }}>{item.label}</span>}
          <svg width={56} height={18} viewBox="0 0 56 18" style={{ filter:"url(#chalk-rough-sv)" }}>
            <line x1="2" y1="9" x2="46" y2="9" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
            <polygon points="44,4 56,9 44,14" fill={color}/>
          </svg>
        </div>
        <span style={{ ...boxStyle, background:`${color}14` }}>{item.description ?? ""}</span>
      </div>
    );
  }

  if (item.type === "showChart" && item.data && item.data.length > 0) {
    const d = item.data;
    const max = Math.max(...d.map(r => r.value), 1);
    const barH = 26, gap = 9, lblW = 80, barMax = 160;
    const svgW = lblW + barMax + 48;
    const svgH = d.length * (barH + gap) + gap;
    return (
      <div style={{ margin:"16px 0" }}>
        {item.description && (
          <div style={{ ...cs, fontSize:14, opacity:.6, marginBottom:8 }}>{item.description}</div>
        )}
        <svg width={svgW} height={svgH} style={{ display:"block", overflow:"visible" }}>
          {d.map((row, i) => {
            const y = gap + i * (barH + gap);
            const barW = Math.round((row.value / max) * barMax);
            return (
              <g key={i}>
                <text x={lblW - 7} y={y + barH * 0.72} textAnchor="end"
                  fill={color} fontSize={barH * 0.6} fontFamily="'Tajawal',sans-serif"
                  style={{ filter:"url(#chalk-rough-sv)" }}>{row.label}</text>
                <rect x={lblW} y={y} width={barMax} height={barH} fill={`${color}08`} rx={4}/>
                <rect x={lblW} y={y} width={barW} height={barH}
                  fill={`${color}28`} stroke={color} strokeWidth="1.5" rx={4}
                  style={{ filter:"url(#chalk-rough-sv)" }}/>
                <text x={lblW + barW + 6} y={y + barH * 0.72}
                  fill={color} fontSize={barH * 0.58} fontFamily="'Tajawal',sans-serif" opacity={0.75}
                  style={{ filter:"url(#chalk-rough-sv)" }}>{row.value}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (item.type === "showImage") {
    return <BoardImage item={item}/>;
  }

  if (item.type === "bullet") return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, margin:"10px 0 2px" }}>
      <span style={{ color, fontSize:8, marginTop:12, flexShrink:0, opacity:.7, filter:"url(#chalk-rough-sv)" }}>●</span>
      <span style={{ ...cs, fontSize:26, fontWeight:400, lineHeight:1.65 }}>{item.content}</span>
    </div>
  );

  if (item.type === "highlight") return (
    <div style={{ margin:"12px 0" }}>
      <span style={{ ...cs, background:`${color}18`, border:`1.5px solid ${color}50`,
        borderRadius:6, padding:"6px 16px", fontSize:28, fontWeight:700, display:"inline-block" }}>
        {item.content}
      </span>
    </div>
  );

  if (item.type === "underline") return (
    <div style={{ margin:"8px 0" }}>
      <span style={{ ...cs, fontSize:26, fontWeight:600,
        borderBottom:`2px solid ${color}90`, paddingBottom:3, display:"inline" }}>
        {item.content}
      </span>
    </div>
  );

  if (item.type === "writeMath") {
    let mathHtml = "";
    try {
      mathHtml = katex.renderToString(item.content, {
        throwOnError:false, displayMode:true, strict:false, trust:false,
      });
    } catch { /* ignore */ }
    if (mathHtml) {
      return (
        <div style={{ margin:"14px 4px", color, filter:"url(#chalk-rough-sv)",
          textShadow:`0 0 5px ${color}44`, fontSize:26 }}
          className="chalk-katex"
          dangerouslySetInnerHTML={{ __html: mathHtml }}
        />
      );
    }
    return (
      <div style={{ margin:"10px 0" }}>
        <span style={{ ...cs, fontFamily:"'Courier New',monospace", fontSize:24, fontWeight:700,
          background:"rgba(255,255,255,.04)", borderRadius:6, padding:"4px 14px", display:"inline-block" }}>
          {item.content}
        </span>
      </div>
    );
  }

  const isTitle = item.type === "writeTitle";
  return (
    <div style={{ margin: isTitle ? "0 0 16px" : "8px 0" }}>
      <span style={{ ...cs, fontSize: isTitle ? 34 : 26,
        fontWeight: isTitle ? 700 : 400, lineHeight:1.65 }}>
        {item.content}
      </span>
    </div>
  );
}

function BoardImage({ item }: { item: BoardItem }) {
  const [url,     setUrl]     = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);
  const color = ch(item.color);

  useEffect(() => {
    const query = item.label;
    if (!query?.trim()) { setLoading(false); setFailed(true); return; }
    let cancelled = false;
    fetch(`${API_BASE}/api/whiteboard/image?q=${encodeURIComponent(query)}`, { credentials:"include" })
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => {
        if (cancelled) return;
        if (d?.url) setUrl(d.url); else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item.label]);

  if (failed) return null;
  return (
    <div style={{ margin:"16px 0", display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
      <div style={{ position:"relative", display:"inline-block",
        border:`2px solid ${color}55`, borderRadius:4, padding:6, background:"rgba(0,0,0,.25)",
        boxShadow:`0 0 0 1px ${color}20, inset 0 0 10px rgba(0,0,0,.3)`, maxWidth:"88%" }}>
        {loading ? (
          <div style={{ width:220, height:155, background:"rgba(255,255,255,.06)", borderRadius:3,
            display:"flex", alignItems:"center", justifyContent:"center", color:`${color}40`, fontSize:26 }}>🖼</div>
        ) : url ? (
          <img src={url} alt={item.description ?? ""}
            style={{ display:"block", maxWidth:"100%", maxHeight:220, borderRadius:3, objectFit:"cover",
              filter:"sepia(15%) brightness(.88) contrast(1.05)" }}
            onError={() => setFailed(true)}/>
        ) : null}
      </div>
      {item.description && !loading && !failed && (
        <div style={{ fontFamily:"'Tajawal',sans-serif", color:`${color}99`,
          fontSize:15, marginTop:6, paddingRight:6, filter:"url(#chalk-rough-sv)", textAlign:"right" }}>
          ↑ {item.description}
        </div>
      )}
    </div>
  );
}

// ── Code entry screen ─────────────────────────────────────────────────────────

function CodeEntry({ onJoin }: { onJoin:(code:string)=>void }) {
  const [input, setInput] = useState("");
  const [err,   setErr]   = useState("");

  function submit() {
    const code = input.trim().toUpperCase();
    if (code.length < 4) { setErr("أدخل الرمز المكوّن من 6 أحرف"); return; }
    setErr("");
    onJoin(code);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0d08", display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:"'Tajawal',sans-serif", direction:"rtl" }}>
      <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(168,230,176,.2)",
        borderRadius:20, padding:"40px 44px", maxWidth:380, width:"calc(100% - 40px)",
        boxShadow:"0 20px 60px rgba(0,0,0,.6)" }}>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
          <Radio size={26} color="#a8e6b0"/>
          <div>
            <div style={{ color:"#a8e6b0", fontSize:22, fontWeight:700 }}>شاهد السبورة</div>
            <div style={{ color:"rgba(242,237,224,.4)", fontSize:13, marginTop:2 }}>سبورة المعلم الذكية</div>
          </div>
        </div>

        <p style={{ color:"rgba(242,237,224,.6)", fontSize:14, lineHeight:1.7, marginBottom:24 }}>
          أدخل الرمز الذي أعطاه لك المعلم لتشاهد السبورة على شاشتك.
        </p>

        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase().slice(0, 8))}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="مثال: AB3X9K"
          autoFocus
          style={{
            width:"100%", background:"rgba(255,255,255,.06)",
            border:`1.5px solid ${err ? "rgba(245,128,128,.5)" : "rgba(168,230,176,.25)"}`,
            borderRadius:12, padding:"14px 18px", color:"#f2ede0",
            fontFamily:"'Courier New',monospace", fontSize:30, fontWeight:700,
            textAlign:"center", letterSpacing:8, outline:"none", boxSizing:"border-box",
          }}
        />
        {err && (
          <p style={{ color:"#f58080", fontSize:13, marginTop:8, textAlign:"center" }}>{err}</p>
        )}

        <button
          onClick={submit}
          style={{ marginTop:20, width:"100%", background:"rgba(168,230,176,.15)",
            border:"1.5px solid rgba(168,230,176,.4)", borderRadius:12, padding:"14px",
            color:"#a8e6b0", fontFamily:"'Tajawal',sans-serif", fontSize:17, fontWeight:700,
            cursor:"pointer" }}>
          دخول
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
        ::placeholder { color: rgba(242,237,224,.2); }
      `}</style>
    </div>
  );
}

// ── Main viewer ───────────────────────────────────────────────────────────────

export default function SmartBoardView() {
  const [code,       setCode]       = useState<string|null>(null);
  const [state,      setState]      = useState<BroadcastState|null>(null);
  const [connecting, setConnecting] = useState(false);
  const [notFound,   setNotFound]   = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  function startPolling(sessionCode: string) {
    setConnecting(true);
    setNotFound(false);

    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/api/whiteboard/broadcast/${sessionCode}`);
        if (r.status === 404) { setNotFound(true); setConnecting(false); return; }
        if (!r.ok) return;
        const d = await r.json() as BroadcastState;
        setState(d);
        setConnecting(false);
      } catch { /* network glitch — will retry */ }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
  }

  function handleJoin(sessionCode: string) {
    setCode(sessionCode);
    startPolling(sessionCode);
  }

  function handleLeave() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setCode(null);
    setState(null);
    setConnecting(false);
    setNotFound(false);
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  if (!code) return <CodeEntry onJoin={handleJoin}/>;

  // ── Loading / not found ──────────────────────────────────────────────────────

  if (notFound) return (
    <div style={{ minHeight:"100vh", background:"#0a0d08", display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:"'Tajawal',sans-serif",
      flexDirection:"column", gap:18, direction:"rtl" }}>
      <p style={{ color:"#f58080", fontSize:20 }}>الجلسة غير موجودة أو انتهت</p>
      <button onClick={handleLeave}
        style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)",
          color:"rgba(242,237,224,.7)", borderRadius:10, padding:"10px 28px",
          cursor:"pointer", fontFamily:"'Tajawal',sans-serif", fontSize:15 }}>
        حاول مجدداً
      </button>
    </div>
  );

  if (connecting || !state) return (
    <div style={{ minHeight:"100vh", background:"#0a0d08", display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16,
      fontFamily:"'Tajawal',sans-serif", direction:"rtl" }}>
      <Loader2 size={40} color="#a8e6b0" style={{ animation:"spin 1s linear infinite" }}/>
      <p style={{ color:"#a8e6b0", fontSize:16 }}>جارٍ الاتصال…</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Board view ───────────────────────────────────────────────────────────────

  const { sections, title, stepTitle } = state;
  const BIG_TYPES = ["highlight","writeTitle","showChart","showImage","drawConnector"];
  const hasBig    = sections.some(s => s.items.some(i => BIG_TYPES.includes(i.type)));
  const gridCols  = sections.length > 1 && !hasBig ? "1fr 1fr" : "1fr";

  return (
    <div dir="rtl" style={{ position:"fixed", inset:0, background:"#0a0d08",
      display:"flex", flexDirection:"column", fontFamily:"'Tajawal','Noto Sans Arabic',sans-serif",
      overflow:"hidden" }}>
      <ChalkDefs/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
        @keyframes spin    { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes chalkIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.45} }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
        .chalk-katex .katex       { color:inherit !important; font-size:inherit !important; }
        .chalk-katex .katex *     { color:inherit !important; }
        .chalk-katex .katex-display{ margin:.2em 0 !important; }
        .chalk-katex .base        { direction:ltr; }
      `}</style>

      {/* Lesson title bar */}
      <div style={{ flexShrink:0, height:40, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"0 20px",
        borderBottom:"1px solid rgba(255,255,255,.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#a8e6b0",
            display:"inline-block", animation:"pulse 2s ease infinite" }}/>
          <span style={{ color:"rgba(242,237,224,.35)", fontSize:13, fontWeight:500 }}>
            بث مباشر · {code}
          </span>
        </div>
        <div style={{ color:"rgba(242,237,224,.5)", fontSize:14, fontWeight:600 }}>
          {stepTitle || title}
        </div>
        <button onClick={handleLeave}
          style={{ background:"none", border:"none", color:"rgba(242,237,224,.3)",
            cursor:"pointer", fontSize:13, fontFamily:"'Tajawal',sans-serif" }}>
          <RefreshCw size={13} style={{ verticalAlign:"middle", marginLeft:4 }}/>
          خروج
        </button>
      </div>

      {/* Board frame */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        padding:"16px" }}>
        <div style={{ position:"relative", width:"100%", maxWidth:900,
          height:"calc(100vh - 100px)", borderRadius:6, padding:16,
          background:"linear-gradient(135deg,#6b3d18,#8b5a28,#7a4e20,#9c6830,#6b3d18)",
          boxShadow:"0 0 0 3px #4a2a0e, 0 8px 48px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.08)" }}>

          {/* Corner bolts */}
          {([{top:8,right:8},{top:8,left:8},{bottom:8,right:8},{bottom:8,left:8}] as React.CSSProperties[]).map((pos,i) => (
            <div key={i} style={{ position:"absolute", ...pos, width:12, height:12, borderRadius:"50%",
              background:"radial-gradient(circle at 35% 35%,#c8943a,#7a5520)",
              boxShadow:"0 1px 3px rgba(0,0,0,.5)", zIndex:10 }}/>
          ))}

          {/* Board surface */}
          <div style={{ position:"relative", width:"100%", height:"100%",
            background:"linear-gradient(160deg,#1a2b1e 0%,#152318 40%,#1c2e20 100%)",
            borderRadius:3, boxShadow:"inset 0 2px 20px rgba(0,0,0,.6)", overflow:"hidden" }}>

            {/* Texture */}
            <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1,
              backgroundImage:"radial-gradient(ellipse at 20% 80%,rgba(255,255,255,.012) 0%,transparent 50%)" }}/>

            {/* Content grid */}
            <div style={{ position:"absolute", inset:0, padding:"36px 30px 50px",
              overflow:"auto", zIndex:2 }}>
              {sections.length === 0 ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                  height:"100%", color:"rgba(242,237,224,.12)", fontSize:18,
                  fontWeight:500, gap:10 }}>
                  <span>في انتظار المعلم…</span>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:"0 0",
                  alignItems:"start", minHeight:"100%" }}>
                  {sections.map((section, si) => {
                    const big     = section.items.some(i => BIG_TYPES.includes(i.type)) || section.items.length >= 4;
                    const showDiv = si < sections.length - 1 && !hasBig;
                    return (
                      <div key={section.id}
                        style={{ gridColumn: big ? "1 / -1" : "auto",
                          padding: sections.length > 1 && !big ? "0 24px" : "0 6px",
                          borderRight: showDiv ? "1px dashed rgba(242,237,224,.1)" : "none",
                          animation:"chalkIn .4s ease" }}>

                        {/* Section header */}
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                          <span style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
                            border:"1.5px solid rgba(242,237,224,.25)",
                            display:"inline-flex", alignItems:"center", justifyContent:"center",
                            color:"rgba(242,237,224,.4)", fontSize:12, fontWeight:700,
                            filter:"url(#chalk-rough-sv)" }}>
                            {section.phaseIdx + 1}
                          </span>
                          <span style={{ fontFamily:"'Tajawal',sans-serif",
                            color:"rgba(242,237,224,.45)", fontSize:sections.length === 1 ? 20 : 16,
                            fontWeight:600, filter:"url(#chalk-rough-sv)",
                            borderBottom:"1px solid rgba(242,237,224,.1)", paddingBottom:3 }}>
                            {section.title}
                          </span>
                        </div>

                        {section.items.map(item => (
                          <BoardLine key={item.key} item={item}/>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chalk tray */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:10,
              background:"linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.06))",
              borderTop:"1px solid rgba(255,255,255,.05)", display:"flex",
              alignItems:"center", paddingRight:16, gap:5, zIndex:4 }}>
              {["#f2ede0","#f5d76e","#a8e6b0","#9fc8f5","#f4a0a8"].map((c,i) => (
                <div key={i} style={{ width:22, height:4, borderRadius:3, background:c, opacity:.2,
                  transform:`rotate(${(i-2)*2}deg)` }}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
