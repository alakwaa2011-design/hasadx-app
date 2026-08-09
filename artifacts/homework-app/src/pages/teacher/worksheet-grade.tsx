/**
 * صفحة التصحيح الورقي الذكي لورقة عمل.
 * رابط ثابت: /teacher/worksheets/:id/grade — يصلح للتشفير في QR لاحقاً.
 * المالك فقط. الكاميرا مدمجة (نمط smart-board-ask) + اختيار ملف احتياطي.
 * ترسل الصور لمحرك التصحيح الموجود (submit-image) خلف الكواليس —
 * كود الواجب الداخلي لا يظهر للمعلم إطلاقاً.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowRight, Camera, Image as ImageIcon, Loader2, RefreshCcw,
  CheckCircle2, XCircle, User, ListChecks, Trash2, Users, X, UserPlus, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";
import DocScannerCamera from "@/components/doc-scanner-camera";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * قراءة QR المطبوع داخل الصورة الملتقطة لمعرفة رقم الصفحة تلقائياً.
 * الـQR يحمل رابط /teacher/worksheets/:id/grade?p=X&of=Y — نستخرج p/of فقط.
 * نجرب عدة مقاسات لأن الـQR صغير في صورة كاملة للورقة.
 */
/** تصغير الصورة قبل الإرسال حتى تتسع 10 صفحات في طلب واحد. */
async function compressImage(dataUrl: string, maxSide = 1800, quality = 0.8): Promise<string> {
  try {
    const img = new Image();
    await new Promise<void>((ok, err) => { img.onload = () => ok(); img.onerror = () => err(new Error()); img.src = dataUrl; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale === 1 && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

async function detectPageFromQr(
  dataUrl: string,
  worksheetId: string | undefined,
): Promise<{ page: number; total: number } | null> {
  try {
    const img = new Image();
    await new Promise<void>((ok, err) => { img.onload = () => ok(); img.onerror = () => err(new Error()); img.src = dataUrl; });
    for (const maxSide of [1600, 2400, 1000]) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
      if (code?.data) {
        try {
          const u = new URL(code.data);
          // نتأكد أن الرابط يخص نفس الورقة حتى لا تختلط أوراق مختلفة
          if (worksheetId && !u.pathname.includes(`/worksheets/${worksheetId}/`)) return null;
          const p = parseInt(u.searchParams.get("p") || "", 10);
          const of = parseInt(u.searchParams.get("of") || "", 10);
          // حد أقصى 10 صفحات — نتجاهل أي QR بقيم خارج النطاق (تلف/تلاعب)
          if (p >= 1 && of >= 1 && of <= 10 && p <= of) return { page: p, total: of };
        } catch { /* ليس رابطاً */ }
        return null;
      }
    }
  } catch { /* تجاهل — سنستخدم الاحتياطي */ }
  return null;
}

type GradingInfo = {
  worksheetId: number;
  worksheetTitle: string;
  assignmentId: number;
  totalPoints: number;
  submissionCount: number;
};

type SubmissionRow = {
  id: number;
  studentName: string;
  studentClass: string | null;
  earnedPoints: number | null;
  totalPoints: number | null;
  submittedAt: string;
};

type GradeResult = {
  id: number;
  studentName?: string;
  nameExtraction?: {
    extractedName: string;
    extractedClass: string | null;
    nameConfidence: "clear" | "uncertain";
    matchedStudentId: number | null;
  };
  earnedPoints: number;
  totalPoints: number;
  aiFeedback?: string | null;
  answers?: Array<{
    questionText: string;
    selectedAnswer: string;
    isCorrect: boolean;
    earnedPoints: number;
    points: number;
  }>;
};

export default function WorksheetGrade() {
  const [, params] = useRoute("/teacher/worksheets/:id/grade");
  const [, setLocation] = useLocation();
  const worksheetId = params?.id;

  const [info, setInfo] = useState<GradingInfo | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "disabled" | "forbidden">("loading");

  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [showManualName, setShowManualName] = useState(false);
  // تأكيد/تعديل الاسم المستخرج عندما تكون القراءة غير مؤكدة
  const [nameFix, setNameFix] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [imgPrev, setImgPrev] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  // ── تعدد الصفحات: عدد الصفحات المتوقع + الصور الملتقطة برقم صفحتها
  const initQr = (() => {
    const q = new URLSearchParams(window.location.search);
    const p = parseInt(q.get("p") || "", 10);
    const of = parseInt(q.get("of") || "", 10);
    return of >= 1 && of <= 10 ? { p: p >= 1 && p <= of ? p : 1, of } : null;
  })();
  const [totalPages, setTotalPages] = useState<number>(initQr?.of ?? 1);
  const [pagesMap, setPagesMap] = useState<Record<number, string>>({});
  const [detecting, setDetecting] = useState(false);
  const isMulti = totalPages > 1;
  const capturedCount = Object.keys(pagesMap).length;
  const missingPages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => !pagesMap[n]);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  // ── جلسة التصحيح المتتابع: نتائج الطلاب المصححين في هذه الجلسة
  // (كل نتيجة محفوظة أصلاً في الخادم لحظة تصحيحها — هذه نسخة للعرض السريع)
  const [sessionResults, setSessionResults] = useState<GradeResult[]>([]);
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);

  const [subs, setSubs] = useState<SubmissionRow[]>([]);

  // كاميرا المسح الضوئي (اكتشاف الحدود + التقاط تلقائي + قص وتصحيح منظور)
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── تحميل معلومات التصحيح، مع إعادة توجيه لتسجيل الدخول والرجوع تلقائياً */
  useEffect(() => {
    if (!worksheetId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/worksheets/${worksheetId}/grading-info`, { credentials: "include" });
        if (res.status === 401) {
          const returnTo = encodeURIComponent(`/teacher/worksheets/${worksheetId}/grade`);
          setLocation(`/login?returnTo=${returnTo}`);
          return;
        }
        if (res.status === 403) { setLoadState("forbidden"); return; }
        if (res.status === 409) { setLoadState("disabled"); return; }
        if (!res.ok) throw new Error();
        const data: GradingInfo = await res.json();
        setInfo(data);
        setLoadState("ready");
        void loadSubmissions(data.assignmentId);
      } catch {
        toast.error("تعذّر تحميل صفحة التصحيح");
        setLoadState("disabled");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheetId]);

  const loadSubmissions = async (assignmentId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submissions`, { credentials: "include" });
      if (!res.ok) return;
      const rows = await res.json();
      setSubs(Array.isArray(rows) ? rows : []);
    } catch { /* غير حرج */ }
  };

  /**
   * استلام صورة (من الكاميرا أو ملف): يقرأ QR الصفحة تلقائياً لترتيبها،
   * فإن تعذّر استخدم أول صفحة ناقصة. المكررة تُستبدل مع تنبيه.
   */
  // عدد الصفحات الحالي في ref حتى تقرأه عمليات الاستلام المتزامنة بدقة
  const totalPagesRef = useRef(totalPages);
  useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);

  const ingestImage = useCallback(async (rawDataUrl: string) => {
    setDetecting(true);
    try {
      // قراءة QR على الدقة الأصلية، ثم ضغط الصورة للإرسال
      const qr = await detectPageFromQr(rawDataUrl, worksheetId);
      const dataUrl = await compressImage(rawDataUrl);
      if (qr && qr.total !== totalPagesRef.current) {
        totalPagesRef.current = qr.total;
        setTotalPages(qr.total);
      }
      const total = totalPagesRef.current;
      if (!qr && total === 1) {
        // ورقة صفحة واحدة (أو بلا QR) — نفس السلوك السابق تماماً
        setImgPrev(dataUrl);
        setImageB64(dataUrl);
        setPagesMap({ 1: dataUrl });
        return;
      }
      // تحديد الصفحة داخل التحديث الوظيفي نفسه — الالتقاطات المتزامنة
      // بلا QR تحجز خانات ناقصة مختلفة بدل أن تتزاحم على نفس الخانة.
      setPagesMap((prev) => {
        let page = qr?.page;
        if (!page) {
          page = Array.from({ length: total }, (_, i) => i + 1).find((n) => !prev[n]) ?? total;
          toast.info(`لم يُقرأ QR من الصورة — اعتُبرت الصفحة ${page} (يمكنك تغييرها)`);
        } else if (prev[page]) {
          toast.warning(`الصفحة ${page} ملتقطة مسبقاً — استُبدلت بالصورة الجديدة`);
        } else {
          toast.success(`تم استلام الصفحة ${page} من ${total}`);
        }
        return { ...prev, [page]: dataUrl };
      });
      if (total === 1) { setImgPrev(dataUrl); setImageB64(dataUrl); }
    } finally {
      setDetecting(false);
    }
  }, [worksheetId]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const r = new FileReader();
      r.onload = () => { void ingestImage(r.result as string); };
      r.readAsDataURL(f);
    }
    e.target.value = "";
  };

  const resetCapture = () => {
    setImgPrev(null);
    setImageB64(null);
    setPagesMap({});
    setResult(null);
  };

  const movePage = (from: number, to: number) => {
    setPagesMap((prev) => {
      const n = { ...prev };
      const img = n[from];
      if (!img) return prev;
      delete n[from];
      if (n[to]) toast.warning(`الصفحة ${to} كانت ملتقطة — استُبدلت`);
      n[to] = img;
      return n;
    });
  };

  /* ── إرسال للتصحيح عبر المحرك الموجود */
  const grade = async () => {
    if (!info) return;
    const ordered = Array.from({ length: totalPages }, (_, i) => pagesMap[i + 1]).filter(Boolean) as string[];
    if (ordered.length === 0) return;
    if (isMulti && missingPages.length > 0) {
      toast.error(`ما زالت الصفحة ${missingPages.join(" و")} مطلوبة قبل التصحيح`);
      return;
    }
    // الاسم يُستخرج تلقائياً من الورقة — الإدخال اليدوي اختياري ويتقدم عليه.
    setGrading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${info.assignmentId}/submit-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentClass: studentClass.trim(),
          imageBase64: ordered[0],
          ...(ordered.length > 1 ? { imagesBase64: ordered } : {}),
          // بصمة فريدة لكل عملية تصحيح — المعلم يصحح عدة أوراق من نفس الجهاز
          deviceFingerprint: `ws-grade-${info.worksheetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "فشل التصحيح — حاول مرة أخرى");
        return;
      }
      setResult(data);
      setNameFix(data?.nameExtraction?.extractedName && data.nameExtraction.extractedName !== "غير معروف" ? data.nameExtraction.extractedName : "");
      // إضافة النتيجة لقائمة الجلسة — النتيجة محفوظة في الخادم بالفعل
      setSessionResults((prev) => [...prev, data]);
      toast.success("تم التصحيح");
      void loadSubmissions(info.assignmentId);
      setStudentName("");
      setStudentClass("");
      setShowManualName(false);
      setImgPrev(null);
      setImageB64(null);
      setPagesMap({});
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setGrading(false);
    }
  };

  /**
   * الانتقال للطالب التالي في الجلسة: تصفير صور/صفحات الطالب السابق فقط
   * (نتيجته محفوظة في الخادم وفي قائمة الجلسة) وفتح الكاميرا مباشرة.
   * عدد صفحات الورقة يبقى معروفاً — لا حاجة لإعادة مسح QR.
   */
  const nextStudent = () => {
    setResult(null);
    setNameFix("");
    setStudentName("");
    setStudentClass("");
    setShowManualName(false);
    setImgPrev(null);
    setImageB64(null);
    setPagesMap({});
    setScanning(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── حالات التحميل */
  if (loadState === "loading") {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (loadState === "forbidden" || loadState === "disabled") {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <XCircle className="w-12 h-12 text-rose-500" />
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
          {loadState === "forbidden"
            ? "هذه الصفحة خاصة بمالك ورقة العمل فقط"
            : "التصحيح الذكي غير مفعّل لهذه الورقة — فعّله من صفحة إنشاء الورقة ثم احفظ"}
        </p>
        <button
          onClick={() => setLocation("/teacher/worksheets/create")}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
        >
          الذهاب لأوراق العمل
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      {/* الترويسة */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => setLocation(`/teacher/worksheets/create?edit=${info?.worksheetId}`)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="رجوع"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
            التصحيح الورقي الذكي
          </h1>
          <p className="text-xs text-slate-500 truncate">{info?.worksheetTitle}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* عدّاد الجلسة */}
        {sessionResults.length > 0 && (
          <div className="flex items-center justify-between gap-2 bg-emerald-600 text-white rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 font-extrabold">
              <Users className="w-5 h-5" />
              تم تصحيح {sessionResults.length === 1 ? "طالب واحد" : sessionResults.length === 2 ? "طالبين" : `${sessionResults.length} طلاب`}
            </div>
            <span className="text-xs font-bold bg-white/20 rounded-full px-2.5 py-1">في هذه الجلسة</span>
          </div>
        )}

        {/* الاسم يُقرأ تلقائياً من الورقة — إدخال يدوي اختياري فقط */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>اسم الطالب يُقرأ تلقائياً من خانة الاسم على الورقة</span>
            </div>
            <button
              onClick={() => setShowManualName((v) => !v)}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0 hover:underline"
            >
              {showManualName ? "إخفاء" : "إدخال يدوي"}
            </button>
          </div>
          {showManualName && (
            <div className="space-y-2">
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="اسم الطالب (يتقدم على المقروء من الورقة)"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm"
              />
              <input
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                placeholder="الصف (اختياري)"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm"
              />
            </div>
          )}
        </section>

        {/* التقاط الورقة */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
              <Camera className="w-4 h-4 text-emerald-600" /> صورة ورقة الطالب
            </div>
            {detecting && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin" /> قراءة QR…
              </span>
            )}
          </div>

          {/* حالة الصفحات — للأوراق متعددة الصفحات */}
          {isMulti && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <span
                    key={n}
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      pagesMap[n]
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-50 text-slate-400 border-dashed border-slate-300 dark:bg-slate-800/50 dark:border-slate-700"
                    }`}
                  >
                    {pagesMap[n] ? "✓" : ""} صفحة {n}
                  </span>
                ))}
              </div>

              {capturedCount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(pagesMap)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([n, img]) => (
                      <div key={n} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={img} alt={`صفحة ${n}`} className="w-full aspect-[3/4] object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 flex items-center justify-between px-1.5 py-1">
                          <select
                            value={n}
                            onChange={(e) => movePage(Number(n), Number(e.target.value))}
                            className="text-[11px] font-bold bg-transparent text-white outline-none"
                            aria-label="تغيير رقم الصفحة"
                          >
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((k) => (
                              <option key={k} value={k} className="text-slate-900">صفحة {k}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setPagesMap((prev) => { const c = { ...prev }; delete c[Number(n)]; return c; })}
                            className="text-white/90 hover:text-white"
                            aria-label={`حذف صفحة ${n}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {missingPages.length > 0 ? (
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  بقيت الصفحة: {missingPages.join(" ، ")} — صوّرها لإكمال التصحيح
                </p>
              ) : (
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  اكتملت جميع الصفحات ({totalPages}/{totalPages}) — جاهزة للتصحيح
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={grade}
                  disabled={grading || missingPages.length > 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {grading ? "جارٍ التصحيح…" : `صحّح (${capturedCount}/${totalPages})`}
                </button>
                {capturedCount > 0 && (
                  <button
                    onClick={resetCapture}
                    disabled={grading}
                    className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    aria-label="مسح الصفحات"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {!isMulti && imgPrev ? (
            <div className="space-y-3">
              <img src={imgPrev} alt="ورقة الطالب" className="w-full rounded-xl border border-slate-200 dark:border-slate-700" />
              <div className="flex gap-2">
                <button
                  onClick={grade}
                  disabled={grading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {grading ? "جارٍ التصحيح…" : "صحّح الآن"}
                </button>
                <button
                  onClick={resetCapture}
                  disabled={grading}
                  className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  aria-label="إعادة الالتقاط"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : scanning ? (
            <DocScannerCamera
              hint={
                isMulti && missingPages.length > 0
                  ? `صوّر الصفحة ${missingPages[0]} (أو أي صفحة أخرى — الترتيب يُقرأ من QR تلقائياً)`
                  : undefined
              }
              onCapture={(url) => {
                void (async () => {
                  await ingestImage(url);
                  // ورقة صفحة واحدة: أغلق الكاميرا بعد الاستلام. أما إذا كشف QR
                  // أنها متعددة الصفحات فتبقى مفتوحة لالتقاط بقية الصفحات تلقائياً.
                  if (totalPagesRef.current === 1) setScanning(false);
                })();
              }}
              onClose={() => setScanning(false)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setScanning(true)}
                className="flex flex-col items-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Camera className="w-6 h-6" /> فتح الكاميرا
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <ImageIcon className="w-6 h-6" /> اختيار صورة
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple={isMulti} onChange={handleFile} className="hidden" />
            </div>
          )}
        </section>

        {/* نتيجة آخر تصحيح */}
        {result && (
          <section className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">النتيجة</span>
              <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {result.earnedPoints} / {result.totalPoints ?? info?.totalPoints}
              </span>
            </div>

            {/* الاسم المستخرج من الورقة */}
            {result.studentName && (
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <User className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-100">{result.studentName}</span>
                {result.nameExtraction?.extractedClass && (
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {result.nameExtraction.extractedClass}
                  </span>
                )}
                {result.nameExtraction?.matchedStudentId != null ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    ✓ مرتبط بطالب موجود
                  </span>
                ) : result.nameExtraction && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    اسم من الورقة
                  </span>
                )}
              </div>
            )}

            {/* قراءة غير مؤكدة → تأكيد أو تعديل سريع */}
            {result.nameExtraction?.nameConfidence === "uncertain" && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  قراءة الاسم غير مؤكدة — أكّده أو عدّله:
                </p>
                <div className="flex gap-2">
                  <input
                    value={nameFix}
                    onChange={(e) => setNameFix(e.target.value)}
                    placeholder="اسم الطالب"
                    className="flex-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (!result?.id || nameFix.trim().length < 2) { toast.error("اكتب اسماً صحيحاً"); return; }
                      setSavingName(true);
                      try {
                        const r = await fetch(`${API_BASE}/api/submissions/${result.id}/student-name`, {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ studentName: nameFix.trim() }),
                        });
                        const d = await r.json().catch(() => ({}));
                        if (!r.ok) { toast.error(d.message || "تعذّر تحديث الاسم"); return; }
                        setResult((prev) => prev ? {
                          ...prev,
                          studentName: d.studentName,
                          nameExtraction: prev.nameExtraction
                            ? { ...prev.nameExtraction, nameConfidence: "clear", matchedStudentId: d.matchedStudentId }
                            : prev.nameExtraction,
                        } : prev);
                        toast.success("تم تحديث الاسم");
                        if (info) void loadSubmissions(info.assignmentId);
                      } catch {
                        toast.error("حدث خطأ في الاتصال");
                      } finally {
                        setSavingName(false);
                      }
                    }}
                    disabled={savingName}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60"
                  >
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد"}
                  </button>
                </div>
              </div>
            )}
            {result.aiFeedback && (
              <p className="text-sm text-slate-700 dark:text-slate-300">{result.aiFeedback}</p>
            )}
            {Array.isArray(result.answers) && result.answers.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {result.answers.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    {r.isCorrect
                      ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                      : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />}
                    <span className="min-w-0">
                      <span className="font-semibold">س{i + 1}:</span> {r.selectedAnswer || "—"}
                      <span className="text-xs text-slate-500"> ({r.earnedPoints}/{r.points})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* الانتقال السريع للطالب التالي — تصوير → تصحيح → نتيجة → الكاميرا */}
            <button
              onClick={nextStudent}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-600 text-white font-extrabold text-base hover:bg-emerald-700 shadow-sm mt-2"
            >
              <UserPlus className="w-5 h-5" /> تصحيح طالب آخر
            </button>
            <button
              onClick={() => setLocation(`/teacher/worksheets/${info?.worksheetId}/report`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <BarChart3 className="w-5 h-5" /> إنهاء جلسة التصحيح وعرض التقرير
            </button>
          </section>
        )}

        {/* نتائج الجلسة — مراجعة سريعة دون تعطيل التصوير */}
        {sessionResults.length > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 mb-3">
              <Users className="w-4 h-4 text-emerald-600" />
              طلاب هذه الجلسة ({sessionResults.length})
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessionResults.map((r, i) => (
                <li key={r.id ?? i}>
                  <button
                    onClick={() => setReviewIdx(i)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg px-1.5 -mx-1.5"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold flex items-center justify-center">{i + 1}</span>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                        {r.studentName || "غير معروف"}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                      {r.earnedPoints} / {r.totalPoints ?? info?.totalPoints}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* نافذة مراجعة نتيجة طالب من الجلسة */}
        {reviewIdx !== null && sessionResults[reviewIdx] && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setReviewIdx(null)}
          >
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                    {sessionResults[reviewIdx].studentName || "غير معروف"}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                    {sessionResults[reviewIdx].earnedPoints} / {sessionResults[reviewIdx].totalPoints ?? info?.totalPoints}
                  </span>
                  <button onClick={() => setReviewIdx(null)} aria-label="إغلاق" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {sessionResults[reviewIdx].aiFeedback && (
                <p className="text-sm text-slate-700 dark:text-slate-300">{sessionResults[reviewIdx].aiFeedback}</p>
              )}
              {Array.isArray(sessionResults[reviewIdx].answers) && (
                <ul className="space-y-1.5">
                  {sessionResults[reviewIdx].answers!.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      {r.isCorrect
                        ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                        : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />}
                      <span className="min-w-0">
                        <span className="font-semibold">س{i + 1}:</span> {r.selectedAnswer || "—"}
                        <span className="text-xs text-slate-500"> ({r.earnedPoints}/{r.points})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* الأوراق المصححة */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
              <ListChecks className="w-4 h-4 text-emerald-600" />
              الأوراق المصححة ({subs.length})
            </div>
            {subs.length > 0 && (
              <button
                onClick={() => setLocation(`/teacher/worksheets/${info?.worksheetId}/report`)}
                className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <BarChart3 className="w-4 h-4" /> عرض التقرير
              </button>
            )}
          </div>
          {subs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">لم تُصحَّح أي ورقة بعد</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {subs.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{s.studentName}</p>
                    {s.studentClass && <p className="text-xs text-slate-500">{s.studentClass}</p>}
                  </div>
                  <span className="shrink-0 font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {s.earnedPoints ?? 0} / {s.totalPoints ?? info?.totalPoints}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
