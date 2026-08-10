import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  Camera, ImagePlus, Keyboard, Zap, Loader2, X, BookOpen, ArrowRight, ArrowLeft, History,
  PenTool, Plane, Dna, Calculator, Moon, BookText, Tornado
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "";

const SUGGESTED = [
  { q: "كيف تعمل المحركات النفاثة؟",          icon: Plane, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800/50" },
  { q: "ما الفرق بين DNA و RNA؟",              icon: Dna, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800/50" },
  { q: "حل: 3س² − 5س + 2 = 0",               icon: Calculator, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800/50" },
  { q: "لماذا يبدو القمر أكبر عند الأفق؟",    icon: Moon, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800/50" },
  { q: "ما الفرق بين الاستعارة والتشبيه؟",    icon: BookText, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800/50" },
  { q: "كيف تتشكل الأعاصير؟",                 icon: Tornado, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800/50" },
];

type Tab = "text" | "image" | "camera";

const TAB_CFG = [
  { key: "text"   as Tab, Icon: Keyboard,  label: "نص"    },
  { key: "image"  as Tab, Icon: ImagePlus, label: "صورة"  },
  { key: "camera" as Tab, Icon: Camera,    label: "كاميرا" },
];

export default function SmartBoardAsk() {
  const { lang } = useI18n();
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
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] font-display pb-32" dir={lang === "ar" ? "rtl" : "ltr"}>
        
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
          <button
            onClick={() => navigate("/teacher/smart-board")}
            className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            title="رجوع"
          >
            {lang === "ar" ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                السبورة الذكية السريعة
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                اكتب سؤالك أو صوّر مسألة — والسبورة تشرح بصوت ورسم
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/teacher/smart-board/history")}
              className="hidden sm:flex items-center gap-2 bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <History size={16} /> السجل
            </button>
            <button
              onClick={() => navigate("/teacher/smart-board/lessons")}
              className="hidden sm:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50 rounded-xl px-4 py-2 text-xs font-black text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
            >
              <BookOpen size={16} /> الدروس المحفوظة
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
          <div className="bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl p-5 sm:p-8 shadow-sm">
            
            <div className="flex bg-[#f4f7f5] dark:bg-[#0B100E] p-1.5 rounded-2xl mb-6 border border-emerald-50 dark:border-emerald-900/30">
              {TAB_CFG.map(({ key, Icon, label }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => switchTab(key)}
                    className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors z-10 ${
                      active ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white dark:bg-[#15201B] shadow-sm rounded-xl border border-emerald-100 dark:border-emerald-900/30"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-20 flex items-center gap-2">
                      <Icon size={16} />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="min-h-[220px]">
              {tab === "text" && (
                <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-1 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all">
                  <textarea
                    autoFocus
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ask(); }}
                    placeholder={"اكتب سؤالك هنا…\nمثال: كيف تعمل الخلية الشمسية؟\nأو حل: س² + 4س − 12 = 0"}
                    rows={6}
                    className="w-full bg-transparent border-none p-4 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none resize-none leading-relaxed"
                  />
                </div>
              )}

              {tab === "image" && (
                imgPrev ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-100 dark:border-emerald-800/50 bg-[#f4f7f5] dark:bg-[#0B100E]">
                    <img src={imgPrev} className="w-full max-h-[300px] object-contain block" />
                    <button onClick={clearImage} className="absolute top-3 right-3 bg-white/90 dark:bg-black/90 backdrop-blur text-slate-700 dark:text-slate-200 rounded-full p-2 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-12 cursor-pointer text-center hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all flex flex-col items-center justify-center gap-4"
                  >
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <ImagePlus size={28} />
                    </div>
                    <div>
                      <p className="text-slate-700 dark:text-slate-200 font-black mb-1">اضغط لرفع صورة المسألة</p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs font-bold">PNG · JPG · WEBP</p>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  </div>
                )
              )}

              {tab === "camera" && (
                imgPrev ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-100 dark:border-emerald-800/50 bg-[#f4f7f5] dark:bg-[#0B100E]">
                    <img src={imgPrev} className="w-full max-h-[300px] object-contain block" />
                    <button onClick={() => { clearImage(); startCamera(); }} className="absolute top-3 right-3 bg-white/90 dark:bg-black/90 backdrop-blur text-slate-700 dark:text-slate-200 rounded-full p-2 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden bg-black min-h-[300px] flex items-center justify-center border border-slate-800">
                    <video ref={videoRef} className="w-full max-h-[400px] object-contain block" playsInline muted />
                    {camReady ? (
                      <button onClick={capturePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border-4 border-white/30 rounded-full w-16 h-16 cursor-pointer hover:scale-105 transition-transform shadow-lg shadow-black/50" title="التقط صورة" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/50 text-sm font-bold">
                        <Loader2 size={24} className="animate-spin" />
                        جارٍ تشغيل الكاميرا…
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                <X size={16} /> {error}
              </div>
            )}

            <button
              onClick={() => ask()}
              disabled={!ready}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white rounded-xl py-4 font-black shadow-md shadow-emerald-600/20 transition-all hover:-translate-y-0.5 mt-6"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> <span>جارٍ التحليل والشرح…</span></>
              ) : (
                <><Zap size={18} /> <span>اعرض على السبورة</span></>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 mt-12 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
            <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 px-2 flex items-center gap-1.5">
              <Zap size={16} className="text-amber-500" /> جرّب سؤالاً
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUGGESTED.map(({ q, color, bg, border, icon: Icon }) => (
              <button
                key={q}
                onClick={() => { setTab("text"); setQuestion(q); ask(q); }}
                className={`group flex items-center gap-4 bg-white dark:bg-[#15201B] border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-start transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg} ${color}`}>
                  <Icon size={20} />
                </div>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{q}</span>
              </button>
            ))}
          </div>

        </main>
      </div>
    </Layout>
  );
}
