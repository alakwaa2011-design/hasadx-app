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
  Sparkles
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
  worksheetId: number | null;
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
  // نفس الصفحة تخدم أيضاً تصحيح أي واجب عادي بالتصوير
  const [, aParams] = useRoute("/teacher/assignments/:id/grade");
  const [, setLocation] = useLocation();
  const worksheetId = params?.id;
  const assignmentRouteId = aParams?.id;

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

  // ── التصحيح الدفعي: عدة صور (حتى 30) — كل صورة = ورقة طالب من صفحة واحدة
  const BATCH_MAX = 30;
  type BatchItem = { id: string; img: string; status: "pending" | "grading" | "done" | "failed" };
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchGrading, setBatchGrading] = useState(false);
  const batchCancelRef = useRef(false);
  // المرجع الدائم للحالة الحالية — حلقة التصحيح تقرأ منه بدل إغلاق قديم
  const batchItemsRef = useRef<BatchItem[]>([]);
  useEffect(() => { batchItemsRef.current = batchItems; }, [batchItems]);

  /* ── تحميل معلومات التصحيح، مع إعادة توجيه لتسجيل الدخول والرجوع تلقائياً */
  useEffect(() => {
    if (!worksheetId && !assignmentRouteId) return;
    (async () => {
      try {
        const url = worksheetId
          ? `${API_BASE}/api/worksheets/${worksheetId}/grading-info`
          : `${API_BASE}/api/assignments/${assignmentRouteId}/grading-info`;
        const res = await fetch(url, { credentials: "include" });
        if (res.status === 401) {
          const returnTo = encodeURIComponent(
            worksheetId
              ? `/teacher/worksheets/${worksheetId}/grade`
              : `/teacher/assignments/${assignmentRouteId}/grade`
          );
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
  }, [worksheetId, assignmentRouteId]);

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
    e.target.value = "";
    if (files.length === 0) return;
    // عدة صور لورقة من صفحة واحدة = دفعة أوراق طلاب (كل صورة طالب مستقل)
    if (files.length > 1 && totalPagesRef.current === 1) {
      void addToBatch(files);
      return;
    }
    for (const f of files) {
      const r = new FileReader();
      r.onload = () => { void ingestImage(r.result as string); };
      r.readAsDataURL(f);
    }
  };

  /**
   * إضافة ملفات إلى دفعة التصحيح (مع الضغط) — بحد أقصى 30 صورة.
   * حارس: إن كشف QR أول صورة أن الورقة متعددة الصفحات، نحوّل الصور كلها
   * لمسار الصفحات المعتاد بدل اعتبارها أوراق طلاب منفصلة.
   */
  const addToBatch = async (files: File[]) => {
    setDetecting(true);
    try {
      const raws: string[] = [];
      for (const f of files) {
        const raw = await new Promise<string | null>((ok) => {
          const r = new FileReader();
          r.onload = () => ok(r.result as string);
          r.onerror = () => ok(null);
          r.readAsDataURL(f);
        });
        if (raw) raws.push(raw);
      }
      if (raws.length === 0) return;
      // فحص QR لأول صورة — قد يكشف أن الورقة متعددة الصفحات
      const qr = await detectPageFromQr(raws[0], worksheetId);
      if (qr && qr.total > 1) {
        setDetecting(false);
        for (const raw of raws) await ingestImage(raw);
        return;
      }
      const room = BATCH_MAX - batchItemsRef.current.length;
      if (room <= 0) { toast.error(`الحد الأقصى ${BATCH_MAX} صورة في الدفعة`); return; }
      if (raws.length > room) toast.warning(`أُضيفت أول ${room} صورة — الحد الأقصى ${BATCH_MAX}`);
      const items: BatchItem[] = [];
      for (const raw of raws.slice(0, room)) {
        items.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          img: await compressImage(raw),
          status: "pending",
        });
      }
      setBatchItems((prev) => [...prev, ...items]);
      // إفراغ أي التقاط فردي سابق حتى لا يختلط المساران
      setImgPrev(null); setImageB64(null); setPagesMap({}); setResult(null);
    } finally {
      setDetecting(false);
    }
  };

  /**
   * تصحيح الدفعة تسلسلياً — كل صورة تُرسل كورقة طالب مستقلة لنفس محرك التصحيح.
   * لقطة ثابتة بالمعرّفات عند البدء: المكتملة تُستثنى دائماً (لا تكرار إرسال)،
   * والتحديث يتم بالمعرّف لا بالفهرس — الحذف أثناء/قبل الإعادة آمن.
   */
  const gradeBatch = async () => {
    if (!info || batchGrading) return;
    batchCancelRef.current = false;
    setBatchGrading(true);
    const run = batchItemsRef.current
      .filter((b) => b.status !== "done")
      .map((b) => ({ id: b.id, img: b.img }));
    let ok = 0, fail = 0;
    const setStatus = (id: string, status: BatchItem["status"]) =>
      setBatchItems((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    try {
      for (const item of run) {
        if (batchCancelRef.current) break;
        // تجاهل ما حُذف من الدفعة بعد بدء التشغيل
        if (!batchItemsRef.current.some((b) => b.id === item.id)) continue;
        setStatus(item.id, "grading");
        try {
          const res = await fetch(`${API_BASE}/api/assignments/${info.assignmentId}/submit-image`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentName: "",
              studentClass: "",
              imageBase64: item.img,
              deviceFingerprint: `ws-grade-${info.worksheetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error();
          setSessionResults((prev) => [...prev, data]);
          setStatus(item.id, "done");
          ok++;
        } catch {
          setStatus(item.id, "failed");
          fail++;
        }
      }
    } finally {
      setBatchGrading(false);
      if (info) void loadSubmissions(info.assignmentId);
      if (batchCancelRef.current) toast.info(`أُوقفت الدفعة — صُحّح ${ok} قبل الإيقاف`);
      else if (fail === 0 && ok > 0) toast.success(`اكتمل تصحيح الدفعة — ${ok} ورقة`);
      else if (ok + fail > 0) toast.warning(`صُحّحت ${ok} ورقة، وتعذّرت ${fail} — أعد المحاولة للمتعثرة`);
    }
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

  /* ── حالات التحميل ── */
  if (loadState === "loading") {
    return (
      <div dir="rtl" className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f4f7f5] dark:bg-[#0B100E]">
        <div className="w-20 h-20 relative flex items-center justify-center">
           <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-900" />
           <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
           <Camera className="w-6 h-6 text-emerald-600 dark:text-emerald-500 animate-pulse" />
        </div>
        <p className="mt-6 font-extrabold text-emerald-800 dark:text-emerald-300 animate-pulse">جاري تجهيز التصحيح الذكي...</p>
      </div>
    );
  }

  if (loadState === "forbidden" || loadState === "disabled") {
    return (
      <div dir="rtl" className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 bg-[#f4f7f5] dark:bg-[#0B100E] p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shadow-inner relative overflow-hidden">
           <div className="absolute inset-0 bg-rose-500/10 animate-pulse" />
           <XCircle className="w-10 h-10 text-rose-500 relative z-10" />
        </div>
        <div className="max-w-sm">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">عذراً</h2>
          <p className="text-base font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
            {loadState === "forbidden"
              ? "هذه الصفحة خاصة بمالك ورقة العمل فقط. لا تملك صلاحية الوصول."
              : "التصحيح الذكي غير مفعّل لهذه الورقة. فضلاً، فعّله من إعدادات الورقة ثم حاول مجدداً."}
          </p>
        </div>
        <button
          onClick={() => setLocation("/teacher/worksheets/create")}
          className="mt-4 px-8 py-3.5 rounded-2xl bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-extrabold text-base hover:bg-slate-700 dark:hover:bg-slate-100 shadow-xl shadow-slate-900/10 hover:-translate-y-0.5 transition-all btn-bounce"
        >
          العودة لأوراق العمل
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-24 font-display">
      {/* الترويسة */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
        <button
          onClick={() =>
            setLocation(
              info?.worksheetId != null
                ? `/teacher/worksheets/create?edit=${info.worksheetId}`
                : `/teacher/new/paper-grading`
            )
          }
          className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform"
          aria-label="رجوع"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate">
            التصحيح الورقي الذكي
          </h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">
        
        {/* شريط الجلسة — يظهر إذا تم تصحيح طلاب بالفعل */}
        {sessionResults.length > 0 && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl p-4 text-white shadow-xl shadow-emerald-600/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-50">إنجاز الجلسة</p>
                <p className="font-extrabold text-lg">
                  {sessionResults.length === 1 ? "طالب واحد" : sessionResults.length === 2 ? "طالبين" : `${sessionResults.length} طلاب`}
                </p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-white/20 flex items-center justify-center relative shadow-inner">
               <span className="font-black">{sessionResults.length}</span>
               <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>
        )}

        {/* إدخال الاسم اليدوي — كشريط مدمج بأناقة بدل أن يكون نموذجاً كبيراً */}
        <section className="bg-white dark:bg-[#15201B] rounded-3xl p-5 shadow-sm border border-emerald-50 dark:border-emerald-900/30 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                الاسم يُقرأ تلقائياً من الورقة
              </span>
            </div>
            <button
              onClick={() => setShowManualName((v) => !v)}
              className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {showManualName ? "إلغاء" : "إدخال يدوي"}
            </button>
          </div>
          {showManualName && (
            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="اسم الطالب (يتقدم على المقروء من الورقة)"
                className="w-full rounded-2xl border-2 border-slate-100 focus:border-emerald-400 focus:ring-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 px-4 py-3.5 text-sm font-bold outline-none transition-all shadow-sm"
              />
              <input
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                placeholder="الصف (اختياري)"
                className="w-full rounded-2xl border-2 border-slate-100 focus:border-emerald-400 focus:ring-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 px-4 py-3.5 text-sm font-bold outline-none transition-all shadow-sm"
              />
            </div>
          )}
        </section>

        {/* منطقة التصوير والتصحيح */}
        <section className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 font-black text-lg text-slate-800 dark:text-slate-100">
              <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> صورة الورقة
            </div>
            {detecting && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> نعالج الصورة…
              </span>
            )}
          </div>

          {/* حالة الصفحات للأوراق المتعددة */}
          {isMulti && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <div
                    key={n}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all duration-300 ${
                      pagesMap[n]
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 shadow-sm scale-105"
                        : "bg-slate-50 border-dashed border-slate-300 text-slate-400 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-500"
                    }`}
                  >
                    {pagesMap[n] && <CheckCircle2 className="w-3.5 h-3.5" />}
                    صفحة {n}
                  </div>
                ))}
              </div>

              {capturedCount > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(pagesMap)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([n, img]) => (
                      <div key={n} className="group relative rounded-2xl overflow-hidden border-2 border-emerald-200 dark:border-emerald-800 shadow-sm aspect-[3/4]">
                        <img src={img} alt={`صفحة ${n}`} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-between">
                            <select
                              value={n}
                              onChange={(e) => movePage(Number(n), Number(e.target.value))}
                              className="text-xs font-bold bg-white/20 text-white rounded-lg px-2 py-1 outline-none backdrop-blur-md appearance-none"
                              aria-label="تغيير رقم الصفحة"
                            >
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((k) => (
                                <option key={k} value={k} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">صفحة {k}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setPagesMap((prev) => { const c = { ...prev }; delete c[Number(n)]; return c; })}
                              className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors shadow-sm"
                              aria-label={`حذف صفحة ${n}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {missingPages.length > 0 ? (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                   <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                   <p className="text-sm font-bold leading-relaxed">
                     بقيت الصفحة {missingPages.join(" و")} — التقطها لإكمال أوراق الطالب
                   </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                   <CheckCircle2 className="w-5 h-5 shrink-0" />
                   <p className="text-sm font-bold leading-relaxed">
                     اكتملت جميع الصفحات ({totalPages}/{totalPages}) — الورقة جاهزة للتصحيح!
                   </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={grade}
                  disabled={grading || missingPages.length > 0}
                  className="flex-1 flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-lg hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-600/20 hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all btn-bounce relative overflow-hidden"
                >
                  {grading ? (
                     <>
                       <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                       <span className="relative z-10">الذكاء الاصطناعي يصحح...</span>
                       <div className="absolute inset-0 bg-emerald-400/20 animate-shimmer relative z-0" />
                     </>
                  ) : (
                     <>
                       <Sparkles className="w-5 h-5" />
                       <span>صحّح الآن {isMulti && `(${capturedCount}/${totalPages})`}</span>
                     </>
                  )}
                </button>
                {capturedCount > 0 && (
                  <button
                    onClick={resetCapture}
                    disabled={grading}
                    className="px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors btn-bounce"
                    aria-label="مسح الصفحات"
                  >
                    <RefreshCcw className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* التصحيح الدفعي — عدة أوراق طلاب (صفحة واحدة لكل طالب) */}
          {!isMulti && batchItems.length > 0 ? (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                  دفعة أوراق: {batchItems.length} صورة — كل صورة ورقة طالب
                </p>
                {!batchGrading && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={batchItems.length >= BATCH_MAX}
                    className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-black hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition-colors"
                  >
                    + إضافة صور ({batchItems.length}/{BATCH_MAX})
                  </button>
                )}
              </div>

              {/* شريط التقدم أثناء التصحيح */}
              {(batchGrading || batchItems.some((b) => b.status === "done" || b.status === "failed")) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>
                      {batchGrading ? "الذكاء الاصطناعي يصحح الدفعة…" : "نتيجة الدفعة"}
                    </span>
                    <span>
                      {batchItems.filter((b) => b.status === "done").length}/{batchItems.length}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                      style={{ width: `${(batchItems.filter((b) => b.status === "done").length / batchItems.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {batchItems.map((b, i) => (
                  <div
                    key={b.id}
                    className={`relative rounded-2xl overflow-hidden border-2 aspect-[3/4] transition-all ${
                      b.status === "done"
                        ? "border-emerald-400 dark:border-emerald-600"
                        : b.status === "failed"
                          ? "border-rose-400 dark:border-rose-600"
                          : b.status === "grading"
                            ? "border-emerald-500 animate-pulse"
                            : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <img src={b.img} alt={`ورقة ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1 text-[10px] font-black bg-black/60 text-white rounded-md px-1.5 py-0.5">{i + 1}</div>
                    {b.status === "grading" && (
                      <div className="absolute inset-0 bg-emerald-600/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                    {b.status === "done" && (
                      <div className="absolute bottom-1 left-1 bg-emerald-500 text-white rounded-full p-1 shadow">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    {b.status === "failed" && (
                      <div className="absolute bottom-1 left-1 bg-rose-500 text-white rounded-full p-1 shadow">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}
                    {!batchGrading && b.status !== "done" && (
                      <button
                        onClick={() => setBatchItems((prev) => prev.filter((x) => x.id !== b.id))}
                        className="absolute top-1 left-1 p-1 bg-black/60 text-white rounded-md hover:bg-rose-600 transition-colors"
                        aria-label={`حذف الورقة ${i + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {batchGrading ? (
                  <button
                    onClick={() => { batchCancelRef.current = true; }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-slate-800 dark:bg-slate-700 text-white font-black hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" /> إيقاف بعد الورقة الحالية
                  </button>
                ) : (
                  <>
                    <button
                      onClick={gradeBatch}
                      disabled={batchItems.every((b) => b.status === "done")}
                      className="flex-1 flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-lg hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 shadow-xl shadow-emerald-600/20 hover:-translate-y-0.5 transition-all btn-bounce"
                    >
                      <Sparkles className="w-5 h-5" />
                      {batchItems.some((b) => b.status === "failed")
                        ? `أعد تصحيح المتعثرة (${batchItems.filter((b) => b.status !== "done").length})`
                        : `صحّح الكل (${batchItems.filter((b) => b.status !== "done").length})`}
                    </button>
                    <button
                      onClick={() => setBatchItems([])}
                      className="px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors btn-bounce"
                      aria-label="إفراغ الدفعة"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
            </div>
          ) : !isMulti && imgPrev ? (
            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
              <div className="relative rounded-3xl overflow-hidden shadow-lg border-2 border-emerald-200 dark:border-emerald-800/60 max-w-sm mx-auto">
                <img src={imgPrev} alt="ورقة الطالب" className="w-full aspect-[3/4] object-cover" />
                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] pointer-events-none" />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={grade}
                  disabled={grading}
                  className="flex-1 flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-lg hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all btn-bounce overflow-hidden relative"
                >
                  {grading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                      <span className="relative z-10">الذكاء الاصطناعي يصحح...</span>
                      <div className="absolute inset-0 bg-white/20 animate-shimmer z-0" />
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>تصحيح الورقة</span>
                    </>
                  )}
                </button>
                <button
                  onClick={resetCapture}
                  disabled={grading}
                  className="px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors btn-bounce"
                  aria-label="إعادة التصوير"
                >
                  <RefreshCcw className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : scanning ? (
            <div className="relative rounded-3xl overflow-hidden shadow-lg border border-emerald-100 dark:border-emerald-900/50 bg-black animate-in fade-in zoom-in-95 duration-300">
              <DocScannerCamera
                hint={
                  isMulti && missingPages.length > 0
                    ? `صوّر الصفحة ${missingPages[0]} (الترتيب يقرأ من الـ QR)`
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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => setScanning(true)}
                className="group flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all hover:scale-[1.02] active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-200/50 dark:bg-emerald-800/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-sm">
                  <Camera className="w-7 h-7" />
                </div>
                <span className="font-extrabold text-emerald-800 dark:text-emerald-300 text-sm sm:text-base">مسح بالكاميرا</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="group flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95"
              >
                <div className="w-14 h-14 rounded-full bg-slate-200/50 dark:bg-slate-800/80 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform shadow-sm">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <span className="font-extrabold text-slate-700 dark:text-slate-300 text-sm sm:text-base">اختيار صورة</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
            </div>
          )}
        </section>

        {/* نتيجة التصحيح الأخيرة (الاحتفالية) */}
        {result && (
          <section className="bg-gradient-to-b from-emerald-50 to-white dark:from-[#11241A] dark:to-[#15201B] rounded-3xl border border-emerald-200 dark:border-emerald-800 p-6 shadow-xl shadow-emerald-100/50 dark:shadow-none animate-in zoom-in-95 duration-500 relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between relative z-10">
              <div>
                 <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">النتيجة النهائية</p>
                 <h2 className="text-6xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                   {result.earnedPoints} <span className="text-3xl text-slate-400 dark:text-slate-500 font-bold">/ {result.totalPoints ?? info?.totalPoints}</span>
                 </h2>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shadow-inner shrink-0">
                 <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            {/* الاسم المستخرج من الورقة */}
            {result.studentName && (
               <div className="mt-6 flex flex-wrap items-center gap-2 p-3 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0">
                     <User className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">{result.studentName}</span>
                  {result.nameExtraction?.extractedClass && (
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {result.nameExtraction.extractedClass}
                    </span>
                  )}
                  {result.nameExtraction?.matchedStudentId != null ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-black border border-emerald-200/50 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> مرتبط بطالب
                    </span>
                  ) : result.nameExtraction && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-[11px] font-black border border-slate-200/50 dark:border-slate-700">
                      <User className="w-3.5 h-3.5" /> اسم مقروء
                    </span>
                  )}
               </div>
            )}

            {/* قراءة غير مؤكدة → تأكيد أو تعديل سريع */}
            {result.nameExtraction?.nameConfidence === "uncertain" && (
              <div className="mt-5 rounded-2xl border-2 border-amber-300/60 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/20 p-4 animate-in slide-in-from-bottom-2">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">الاسم غير واضح تماماً</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">هل هذا هو اسم الطالب الصحيح؟</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={nameFix}
                    onChange={(e) => setNameFix(e.target.value)}
                    placeholder="اسم الطالب"
                    className="flex-1 rounded-xl border-amber-200 focus:border-amber-400 focus:ring-amber-400 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100 px-4 py-2.5 text-sm font-bold outline-none transition-all shadow-sm"
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
                    className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-black hover:bg-amber-600 disabled:opacity-60 shadow-md shadow-amber-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center shrink-0"
                  >
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد"}
                  </button>
                </div>
              </div>
            )}
            
            {result.aiFeedback && (
              <div className="mt-6 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">ملاحظات الذكاء الاصطناعي</span>
                </div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  {result.aiFeedback}
                </p>
              </div>
            )}
            
            {Array.isArray(result.answers) && result.answers.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3 px-1">تفاصيل الإجابات</h3>
                <ul className="grid grid-cols-1 gap-2">
                  {result.answers.map((r, i) => (
                    <li key={i} className="flex items-stretch overflow-hidden rounded-xl border border-white/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 shadow-sm transition-all hover:border-emerald-200 dark:hover:border-emerald-800">
                      <div className={`w-1.5 shrink-0 ${r.isCorrect ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <div className="flex-1 flex items-center justify-between p-3 min-w-0">
                         <div className="flex items-center gap-3 min-w-0">
                           <span className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-500 dark:text-slate-400 shrink-0">
                             {i + 1}
                           </span>
                           <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                             {r.selectedAnswer || "—"}
                           </span>
                         </div>
                         <span className={`text-xs font-black px-2 py-1 rounded-md shrink-0 border ${r.isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900' : 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900'}`}>
                           {r.earnedPoints} / {r.points}
                         </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* أزرار الإجراءات */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
              <button
                onClick={nextStudent}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-lg hover:from-emerald-700 hover:to-emerald-600 shadow-xl shadow-emerald-600/20 hover:-translate-y-0.5 transition-all btn-bounce"
              >
                <UserPlus className="w-5 h-5" /> تصحيح طالب آخر
              </button>
              {info?.worksheetId != null && (
                <button
                  onClick={() => setLocation(`/teacher/worksheets/${info?.worksheetId}/report`)}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-5 py-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-slate-900/50 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all btn-bounce"
                >
                  <BarChart3 className="w-5 h-5" /> تقرير التصحيح
                </button>
              )}
            </div>
          </section>
        )}

        {/* قائمة طلاب الجلسة الحالية */}
        {sessionResults.length > 0 && (
          <section className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-50 dark:border-emerald-900/30 transition-all">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100">
                طلاب هذه الجلسة <span className="text-emerald-600 dark:text-emerald-400 text-sm">({sessionResults.length})</span>
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessionResults.map((r, i) => (
                <button
                  key={r.id ?? i}
                  onClick={() => setReviewIdx(i)}
                  className="group flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800/60 hover:shadow-md transition-all text-start"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 text-slate-600 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 text-xs font-black flex items-center justify-center shrink-0 transition-colors">
                      {i + 1}
                    </span>
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                      {r.studentName || "غير معروف"}
                    </p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 font-black text-emerald-600 dark:text-emerald-400 text-sm border border-emerald-100 dark:border-emerald-900/30">
                    {r.earnedPoints} / {r.totalPoints ?? info?.totalPoints}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* نافذة مراجعة نتيجة طالب من الجلسة */}
        {reviewIdx !== null && sessionResults[reviewIdx] && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={() => setReviewIdx(null)}
          >
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-[#15201B] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-emerald-900/30 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300"
            >
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0">
                     <User className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <span className="font-black text-lg text-slate-800 dark:text-slate-100 truncate">
                    {sessionResults[reviewIdx].studentName || "غير معروف"}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 font-black text-lg text-emerald-700 dark:text-emerald-400">
                    {sessionResults[reviewIdx].earnedPoints} / {sessionResults[reviewIdx].totalPoints ?? info?.totalPoints}
                  </span>
                  <button onClick={() => setReviewIdx(null)} aria-label="إغلاق" className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {sessionResults[reviewIdx].aiFeedback && (
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                      {sessionResults[reviewIdx].aiFeedback}
                    </p>
                  </div>
                )}
                
                {Array.isArray(sessionResults[reviewIdx].answers) && (
                  <ul className="space-y-2">
                    {sessionResults[reviewIdx].answers!.map((r, i) => (
                      <li key={i} className="flex items-stretch overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                        <div className={`w-1.5 shrink-0 ${r.isCorrect ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <div className="flex-1 flex items-center justify-between p-3 min-w-0">
                           <div className="flex items-center gap-3 min-w-0">
                             <span className="text-xs font-bold text-slate-400 w-5 text-center shrink-0">س{i + 1}</span>
                             <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                               {r.selectedAnswer || "—"}
                             </span>
                           </div>
                           <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                             {r.earnedPoints}/{r.points}
                           </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* إجمالي الأوراق المصححة للمهمة */}
        <section className="bg-white dark:bg-[#15201B] rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-all">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <ListChecks className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100">
                الأوراق المصححة <span className="text-slate-500 text-sm">({subs.length})</span>
              </h3>
            </div>
            {subs.length > 0 && info?.worksheetId != null && (
              <button
                onClick={() => setLocation(`/teacher/worksheets/${info?.worksheetId}/report`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              >
                <BarChart3 className="w-4 h-4" /> تقرير
              </button>
            )}
          </div>
          
          {subs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <ListChecks className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">لم تُصحَّح أي ورقة بعد</p>
              <p className="text-xs text-slate-500 mt-1">ابدأ بتصوير الأوراق وستظهر النتائج هنا</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {subs.map((s) => (
                <li key={s.id} className="py-3.5 flex items-center justify-between gap-3 group">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{s.studentName}</p>
                    {s.studentClass && <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{s.studentClass}</p>}
                  </div>
                  <span className="shrink-0 font-black text-slate-600 dark:text-slate-300 text-sm group-hover:text-emerald-600 transition-colors">
                    {s.earnedPoints ?? 0} <span className="text-slate-400 text-xs font-semibold">/ {s.totalPoints ?? info?.totalPoints}</span>
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
