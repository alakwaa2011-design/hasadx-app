import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Camera, ImagePlus, Keyboard, Zap, Loader2, X, BookOpen, ArrowLeft, History } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const SUGGESTED = [
  { q: "كيف تعمل المحركات النفاثة؟",          color: "#f97316", icon: "✈️" },
  { q: "ما الفرق بين DNA و RNA؟",              color: "#22c55e", icon: "🧬" },
  { q: "حل: 3س² − 5س + 2 = 0",               color: "#6366f1", icon: "📐" },
  { q: "لماذا يبدو القمر أكبر عند الأفق؟",    color: "#a855f7", icon: "🌕" },
  { q: "ما الفرق بين الاستعارة والتشبيه؟",    color: "#0ea5e9", icon: "📖" },
  { q: "كيف تتشكل الأعاصير؟",                 color: "#ec4899", icon: "🌪️" },
];

const ACCENT = "#7c3aed";
const GLOW   = "rgba(124,58,237,.35)";

type Tab = "text" | "image" | "camera";

const TAB_CFG = [
  { key: "text"   as Tab, Icon: Keyboard,  label: "نص"    },
  { key: "image"  as Tab, Icon: ImagePlus, label: "صورة"  },
  { key: "camera" as Tab, Icon: Camera,    label: "كاميرا" },
];

export default function SmartBoardAsk() {
  const [, navigate] = useLocation();
  const [tab, setTab]           = useState<Tab>("text");
  const [question, setQuestion] = useState("");
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imgPrev,  setImgPrev]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camReady, setCamReady] = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
      setCamReady(true);
    } catch { setError("تعذّر الوصول للكاميرا"); }
  }, []);

  const switchTab = (t: Tab) => {
    if (tab === "camera") stopCamera();
    setTab(t); setError("");
    if (t === "camera") startCamera();
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const c = document.createElement("canvas");
    c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
    c.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const url = c.toDataURL("image/jpeg", .85);
    setImgPrev(url); setImageB64(url.split(",")[1]); stopCamera();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const u = r.result as string; setImgPrev(u); setImageB64(u.split(",")[1]); };
    r.readAsDataURL(f);
  };

  const clearImage = () => { setImgPrev(null); setImageB64(null); };

  const ask = async (override?: string) => {
    const q = override ?? question;
    if (!q.trim() && !imageB64) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/whiteboard/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: q.trim(), imageBase64: imageB64 }),
      });
      if (!res.ok) throw new Error();
      const plan = await res.json();
      sessionStorage.setItem("whiteboard_ask_plan", JSON.stringify(plan));
      navigate("/teacher/smart-board/present/ask");
    } catch { setError("حدث خطأ — حاول مجدداً"); }
    finally { setLoading(false); }
  };

  const ready = !loading && (!!question.trim() || !!imageB64);

  return (
    <Layout>
      {/* ── Global styles injected inline ── */}
      <style>{`
        @keyframes boardGlow { 0%,100% { box-shadow: 0 0 28px ${GLOW}; } 50% { box-shadow: 0 0 48px ${GLOW}, 0 0 80px rgba(124,58,237,.15); } }
        @keyframes floatIn { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from { transform:rotate(0); } to { transform:rotate(360deg); } }
        .sb-card { animation: floatIn .45s ease both; }
        .sb-chip:hover { transform: translateY(-2px); }
        .sb-submit:not(:disabled):hover { opacity:.92; transform:translateY(-1px); }
        .sb-tab-active { background: ${ACCENT} !important; color: #fff !important; }
      `}</style>

      <div dir="rtl" style={{ maxWidth: 660, margin: "0 auto", padding: "28px 16px 56px" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          {/* Icon badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 64, height: 64, borderRadius: 20, marginBottom: 16,
            background: `linear-gradient(135deg, ${ACCENT}, #4f46e5)`,
            boxShadow: `0 8px 32px ${GLOW}`,
            fontSize: 28,
          }}>🖊️</div>

          <h1 style={{
            fontSize: 36, fontWeight: 900, margin: "0 0 8px",
            background: "linear-gradient(135deg, var(--foreground) 40%, #a78bfa)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            السبورة الذكية
          </h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 15, margin: 0 }}>
            اكتب سؤالك أو صوّر مسألة — والسبورة تشرح بصوت ورسم
          </p>
        </div>

        {/* ── Main card ── */}
        <div className="sb-card" style={{
          background: "var(--card)",
          border: `1.5px solid rgba(124,58,237,.25)`,
          borderRadius: 24,
          padding: "6px",
          boxShadow: `0 4px 40px rgba(0,0,0,.08), 0 0 0 1px rgba(124,58,237,.08)`,
        }}>
          <div style={{ background: "var(--background)", borderRadius: 20, padding: "20px 20px 22px", position: "relative" }}>

            {/* Tab switcher — pill style */}
            <div style={{
              display: "inline-flex", background: "var(--muted)", borderRadius: 12,
              padding: 4, gap: 2, marginBottom: 22,
            }}>
              {TAB_CFG.map(({ key, Icon, label }) => (
                <button key={key} onClick={() => switchTab(key)}
                  className={tab === key ? "sb-tab-active" : ""}
                  style={{
                    padding: "8px 18px", border: "none", borderRadius: 9, cursor: "pointer",
                    fontFamily: "'Tajawal',sans-serif", fontSize: 13, fontWeight: 600,
                    background: "transparent", color: "var(--muted-foreground)",
                    display: "flex", alignItems: "center", gap: 6, transition: "all .18s",
                  }}>
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {/* ── Text tab ── */}
            {tab === "text" && (
              <textarea
                autoFocus
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ask(); }}
                placeholder={"اكتب سؤالك هنا…\nمثل: كيف تعمل الخلية الشمسية؟  أو  حل: س² + 4س − 12 = 0"}
                rows={5}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--muted)", border: "1.5px solid transparent",
                  borderRadius: 14, padding: "14px 16px", resize: "none",
                  fontFamily: "'Tajawal',sans-serif", fontSize: 16, lineHeight: 1.7,
                  color: "var(--foreground)", outline: "none", transition: "border-color .15s",
                }}
                onFocus={e => e.target.style.borderColor = ACCENT}
                onBlur={e => e.target.style.borderColor = "transparent"}
              />
            )}

            {/* ── Image tab ── */}
            {tab === "image" && (
              imgPrev ? (
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
                  <img src={imgPrev} style={{ width: "100%", maxHeight: 280, objectFit: "contain", background: "#000", display: "block" }} />
                  <button onClick={clearImage} style={{
                    position: "absolute", top: 10, left: 10,
                    background: "rgba(0,0,0,.7)", border: "none", borderRadius: "50%",
                    width: 32, height: 32, cursor: "pointer", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><X size={15} /></button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed rgba(124,58,237,.35)`, borderRadius: 14,
                    padding: "44px 20px", cursor: "pointer", textAlign: "center",
                    transition: "border-color .15s, background .15s",
                    background: "rgba(124,58,237,.04)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = "rgba(124,58,237,.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(124,58,237,.35)"; e.currentTarget.style.background = "rgba(124,58,237,.04)"; }}
                >
                  <ImagePlus size={36} color={ACCENT} style={{ opacity: .6, marginBottom: 10 }} />
                  <p style={{ color: "var(--foreground)", fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>اضغط لرفع صورة المسألة</p>
                  <p style={{ color: "var(--muted-foreground)", margin: 0, fontSize: 13 }}>PNG · JPG · WEBP</p>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
                </div>
              )
            )}

            {/* ── Camera tab ── */}
            {tab === "camera" && (
              imgPrev ? (
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
                  <img src={imgPrev} style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block" }} />
                  <button onClick={() => { clearImage(); startCamera(); }} style={{
                    position: "absolute", top: 10, left: 10,
                    background: "rgba(0,0,0,.7)", border: "none", borderRadius: "50%",
                    width: 32, height: 32, cursor: "pointer", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><X size={15} /></button>
                </div>
              ) : (
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#050505", minHeight: 240 }}>
                  <video ref={videoRef} style={{ width: "100%", display: "block", maxHeight: 300 }} playsInline muted />
                  {camReady ? (
                    <button onClick={capturePhoto} style={{
                      position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
                      background: "white", border: "5px solid rgba(255,255,255,.3)",
                      borderRadius: "50%", width: 64, height: 64, cursor: "pointer",
                      boxShadow: "0 4px 20px rgba(0,0,0,.5)",
                    }} title="التقط صورة" />
                  ) : (
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 8, color: "rgba(255,255,255,.4)", fontSize: 14,
                    }}>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                      جارٍ تشغيل الكاميرا…
                    </div>
                  )}
                </div>
              )
            )}

            {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{error}</p>}

            {/* ── Submit ── */}
            <button
              className="sb-submit"
              onClick={() => ask()}
              disabled={!ready}
              style={{
                width: "100%", marginTop: 16,
                background: ready ? `linear-gradient(135deg, ${ACCENT}, #4f46e5)` : "var(--muted)",
                color: ready ? "#fff" : "var(--muted-foreground)",
                border: "none", borderRadius: 14, padding: "16px",
                fontFamily: "'Tajawal',sans-serif", fontSize: 17, fontWeight: 800,
                cursor: ready ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all .18s",
                boxShadow: ready ? `0 4px 20px ${GLOW}` : "none",
                animation: ready ? "boardGlow 2.5s ease-in-out infinite" : "none",
              }}>
              {loading
                ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                : <Zap size={19} style={{ fill: "currentColor" }} />}
              {loading ? "جارٍ التحليل والشرح…" : "اعرض على السبورة"}
            </button>
          </div>
        </div>

        {/* ── Saved lessons + suggestion header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, marginBottom: 14 }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
            <Zap size={13} color={ACCENT} />
            جرّب سؤالاً:
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => navigate("/teacher/smart-board/history")}
              style={{
                background: "transparent", border: `1px solid var(--border)`, borderRadius: 8,
                color: "var(--muted-foreground)", cursor: "pointer", padding: "5px 12px",
                fontFamily: "'Tajawal',sans-serif", fontSize: 12,
                display: "flex", alignItems: "center", gap: 5, transition: "color .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--foreground)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--muted-foreground)"}>
              <History size={13} />
              السجل
            </button>
            <button onClick={() => navigate("/teacher/smart-board/lessons")}
              style={{
                background: "transparent", border: `1px solid var(--border)`, borderRadius: 8,
                color: "var(--muted-foreground)", cursor: "pointer", padding: "5px 12px",
                fontFamily: "'Tajawal',sans-serif", fontSize: 12,
                display: "flex", alignItems: "center", gap: 5, transition: "color .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--foreground)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--muted-foreground)"}>
              <BookOpen size={13} />
              الدروس المحفوظة
              <ArrowLeft size={11} />
            </button>
          </div>
        </div>

        {/* ── Suggested questions ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SUGGESTED.map(({ q, color, icon }) => (
            <button key={q} className="sb-chip"
              onClick={() => { setTab("text"); setQuestion(q); ask(q); }}
              style={{
                background: "var(--card)", border: `1px solid var(--border)`,
                borderRight: `3.5px solid ${color}`,
                borderRadius: 12, padding: "11px 14px", cursor: "pointer",
                fontFamily: "'Tajawal',sans-serif", fontSize: 13, fontWeight: 500,
                color: "var(--foreground)", textAlign: "right",
                display: "flex", alignItems: "center", gap: 8,
                transition: "transform .15s, box-shadow .15s, border-color .15s",
                boxShadow: "0 1px 4px rgba(0,0,0,.04)",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,.08), inset 0 0 0 1000px ${color}08`; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <span style={{ lineHeight: 1.4 }}>{q}</span>
            </button>
          ))}
        </div>

      </div>
    </Layout>
  );
}
