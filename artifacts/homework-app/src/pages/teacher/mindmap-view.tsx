import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Loader2, ArrowRight, ArrowLeft, Brain, Layers, Printer, Copy, ImageDown, FileImage, Pencil, Save, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MindMapSVG } from "@/pages/teacher/mindmap-create";
import MindMapEditor from "./mindmap-editor";
import { isMindMapValid, type MindMap } from "./mindmap-shared";

const API_BASE = import.meta.env.VITE_API_URL || "";

const BG_LIGHT  = "#F8FAFC";

export default function MindMapView() {
  const { lang: globalLang } = useI18n();
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState<{ topic: string; language: string; map: MindMap } | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveRevisionRef = useRef(0);
  
  const lang = mapData?.language || globalLang;
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchMap = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/mindmaps/${id}`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 404) {
            toast.error(isAr ? "الخريطة غير موجودة" : "Map not found");
            setLocation("/teacher/mindmaps");
            return;
          }
          throw new Error("Failed to fetch");
        }
        const data = await res.json();
        setMapData({
          topic: data.topic,
          language: data.language,
          map: data.map,
        });
      } catch (e) {
        toast.error(isAr ? "تعذّر تحميل الخريطة" : "Failed to load map");
        setLocation("/teacher/mindmaps");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchMap();
  }, [id, isAr, setLocation]);

  const saveMap = useCallback((nextMap: MindMap) => {
    if (!mapData || !id) return false;
    const revision = ++saveRevisionRef.current;
    const topic = mapData.topic;
    const language = mapData.language;
    setSaveStatus("saving");
    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/mindmaps/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: nextMap.center,
            topic,
            language,
            map: nextMap,
          }),
        });
        if (!res.ok) throw new Error("Save failed");
        await res.json();
        if (revision === saveRevisionRef.current) setSaveStatus("saved");
        return true;
      } catch {
        if (revision === saveRevisionRef.current) {
          setSaveStatus("error");
          toast.error(isAr ? "تعذّر حفظ التعديلات" : "Failed to save changes");
        }
        return false;
      }
    };
    const queued = saveQueueRef.current.then(run, run);
    saveQueueRef.current = queued;
    return queued;
  }, [id, isAr, mapData]);

  const handleMapChange = useCallback((nextMap: MindMap) => {
    setMapData((current) => current ? { ...current, map: nextMap } : current);
    setSaveStatus("idle");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!isMindMapValid(nextMap)) return;
    saveTimerRef.current = setTimeout(() => void saveMap(nextMap), 700);
  }, [saveMap]);

  const handlePrint = useCallback(() => {
    const svgEl = document.getElementById("mindmap-svg") as SVGSVGElement | null;
    if (!svgEl || !mapData?.map) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute("class");
    clone.setAttribute("style", "width:100%;height:auto;max-height:100vh;display:block");
    const html = `<!doctype html><html dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8">
      <title>${mapData.map.center || (isAr ? "خريطة ذهنية" : "Mind map")}</title>
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
  }, [mapData, isAr]);

  const handleCopyText = () => {
    if (!mapData?.map) return;
    const { map } = mapData;
    const lines: string[] = [`- ${map.center}`, ""];
    map.branches.forEach((b) => {
      lines.push(`${b.icon || "-"} ${b.label}`);
      b.children.forEach((c) => lines.push(`    - ${c}`));
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast.success(isAr ? "تم نسخ الخريطة كنص" : "Mind map copied as text");
    });
  };

  const handleExportPng = useCallback(async () => {
    const svgEl = document.getElementById("mindmap-svg") as SVGSVGElement | null;
    if (!svgEl || !mapData?.map) return;
    try {
      const scale = 2;
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
            a.download = `خريطة-${mapData.map.center || "ذهنية"}.png`;
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
    }
  }, [mapData, isAr]);

  const handleExportSvg = useCallback(() => {
    const svgEl = document.getElementById("mindmap-svg") as SVGSVGElement | null;
    if (!svgEl || !mapData?.map) return;
    const vb = (svgEl.getAttribute("viewBox") || "0 0 1400 900").split(" ").map(Number);
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width",  String(vb[2]));
    clone.setAttribute("height", String(vb[3]));
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob    = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const a       = document.createElement("a");
    a.href        = URL.createObjectURL(blob);
    a.download    = `خريطة-${mapData.map.center || "ذهنية"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast.success(isAr ? "تم تحميل ملف SVG ✓" : "SVG file downloaded ✓");
  }, [mapData, isAr]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] flex flex-col items-center justify-center text-emerald-600/50" data-testid="loading-indicator">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold text-sm">{isAr ? "جارٍ تحميل الخريطة…" : "Loading map…"}</p>
      </div>
    );
  }

  if (!mapData) return null;

  return (
    <div dir={dir} className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-32 font-display">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
        <button
          type="button"
          onClick={() => setLocation("/teacher/mindmaps")}
          className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
          aria-label={isAr ? "رجوع" : "Back"}
          data-testid="btn-back"
        >
          {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
              {mapData.map.center}
            </h1>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5 truncate max-w-xl">
              {mapData.topic}
            </p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/teacher/mindmap/create")}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/60 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
          data-testid="btn-new-map"
        >
          <Layers className="w-4 h-4" />
          <span className="mt-0.5 hidden sm:inline">{isAr ? "خريطة جديدة" : "New Map"}</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-colors ${editing ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                data-testid="btn-edit-map"
              >
                <Pencil className="w-4 h-4" />
                <span>{editing ? (isAr ? "إغلاق المحرر" : "Close editor") : (isAr ? "تعديل الخريطة" : "Edit map")}</span>
              </button>
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400" data-testid="status-saving">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{isAr ? "جاري الحفظ" : "Saving"}
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400" data-testid="status-saved">
                  <CheckCheck className="h-3.5 w-3.5" />{isAr ? "تم الحفظ" : "Saved"}
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-xs font-bold text-red-500" data-testid="status-error">
                  {isAr ? "تعذّر الحفظ — أعد المحاولة" : "Save failed — try again"}
                </span>
              )}
              <button
                onClick={handleCopyText}
                data-testid="btn-copy-text"
                className="flex items-center gap-1.5 bg-white dark:bg-[#15201B] hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-emerald-50 dark:border-emerald-900/30 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <Copy className="w-4 h-4" />
                <span>{isAr ? "نسخ كنص" : "Copy Text"}</span>
              </button>
              <button
                onClick={handleExportPng}
                data-testid="btn-export-png"
                className="flex items-center gap-1.5 bg-white dark:bg-[#15201B] hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-emerald-50 dark:border-emerald-900/30 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <ImageDown className="w-4 h-4" />
                <span>{isAr ? "صورة PNG" : "Save PNG"}</span>
              </button>
              <button
                onClick={handleExportSvg}
                data-testid="btn-export-svg"
                className="flex items-center gap-1.5 bg-white dark:bg-[#15201B] hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-emerald-50 dark:border-emerald-900/30 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <FileImage className="w-4 h-4" />
                <span>{isAr ? "ملف SVG" : "Save SVG"}</span>
              </button>
              <button
                onClick={handlePrint}
                data-testid="btn-print"
                className="flex items-center gap-1.5 bg-white dark:bg-[#15201B] hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-emerald-50 dark:border-emerald-900/30 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>{isAr ? "طباعة" : "Print"}</span>
              </button>
            </div>
          </div>

          {editing && (
            <div className="grid gap-4 rounded-3xl border border-emerald-100 bg-white p-3 shadow-sm dark:border-emerald-900/30 dark:bg-[#15201B] lg:grid-cols-[minmax(280px,360px)_1fr]">
              <div className="max-h-[720px] overflow-y-auto pe-1">
                <MindMapEditor map={mapData.map} isAr={isAr} onChange={handleMapChange} />
                <button
                  type="button"
                  onClick={() => {
                    if (!isMindMapValid(mapData.map)) {
                      toast.error(isAr ? "أكمل النصوص الفارغة قبل الحفظ" : "Complete empty fields before saving");
                      return;
                    }
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                    void saveMap(mapData.map);
                  }}
                  disabled={saveStatus === "saving"}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="btn-save-map-edits"
                >
                  {saveStatus === "saved" ? <CheckCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isAr ? "حفظ التعديلات الآن" : "Save changes now"}
                </button>
              </div>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-[#F8FAFC] dark:border-slate-800 dark:bg-[#15201B]">
                <MindMapSVG map={mapData.map} isAr={isAr} variant="screen" />
              </div>
            </div>
          )}

          {!editing && (
            <div className="w-full bg-white dark:bg-transparent rounded-3xl shadow-sm border border-emerald-50 dark:border-emerald-900/30 overflow-hidden" data-testid="map-container">
              <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-[800px] p-6">
                  <MindMapSVG map={mapData.map} isAr={isAr} variant="screen" />
                </div>
              </div>
            </div>
          )}
          
          <div className="hidden">
            <MindMapSVG map={mapData.map} isAr={isAr} variant="print" />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
