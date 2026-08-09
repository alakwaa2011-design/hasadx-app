/**
 * كاميرا مسح ضوئي للأوراق (نمط تطبيقات الـScanner):
 * - اكتشاف حدود الورقة تلقائياً عبر jscanify + OpenCV (يُحمَّل كسولاً من /opencv.js — 8.6MB مرة واحدة).
 * - إطار بصري حول الورقة: كهرماني عند الاكتشاف، أخضر عندما تصلح للالتقاط.
 * - التقاط تلقائي عندما تكون الورقة كاملة داخل الكادر، والإضاءة كافية، والصورة حادة،
 *   والجهاز ثابتاً لفترة قصيرة (حلقة تقدم تُظهر العد).
 * - بعد الالتقاط: قصّ الحواف وتصحيح الميل والمنظور محلياً في المتصفح (warpPerspective)
 *   فتصل صورة نظيفة تشبه المسح الضوئي — بلا أي تغيير على محرك التصحيح.
 * - معاينة سريعة مع «إعادة التصوير»، وتُعتمد تلقائياً بعد مهلة قصيرة (الوضع الافتراضي سريع).
 * - في التعدد: بعد قبول صفحة يعاد التسليح تلقائياً، مع اشتراط خروج الورقة من الكادر
 *   أولاً حتى لا تُلتقط نفس الصفحة مرتين.
 * - زر تصوير يدوي دائم كخيار احتياطي، ويصبح الوضع الوحيد إذا تعذّر تحميل OpenCV.
 *
 * ملاحظة: نستدعي OpenCV مباشرة (بدل دوال jscanify) لأن نسخته الحالية تسرّب
 * كائنات Mat في كل إطار تحليل — حزمة jscanify تبقى مصدر ملف public/opencv.js فقط.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCcw, CheckCircle2 } from "lucide-react";

/* ── تحميل OpenCV مرة واحدة على مستوى الصفحة ── */
declare global {
  // opencv.js يعرّف cv عالمياً
  // eslint-disable-next-line no-var
  var cv: any;
}

let openCvPromise: Promise<void> | null = null;
function loadOpenCv(): Promise<void> {
  if (openCvPromise) return openCvPromise;
  openCvPromise = new Promise<void>((resolve, reject) => {
    if (typeof cv !== "undefined" && cv?.Mat) { resolve(); return; }
    const s = document.createElement("script");
    s.src = `${import.meta.env.BASE_URL}opencv.js`;
    s.async = true;
    const timeout = setTimeout(() => reject(new Error("opencv timeout")), 25000);
    s.onload = () => {
      // cv جاهز إما فوراً أو عبر onRuntimeInitialized
      const done = () => { clearTimeout(timeout); resolve(); };
      if (typeof cv !== "undefined" && cv?.Mat) done();
      else if (typeof cv !== "undefined") cv.onRuntimeInitialized = done;
      else { clearTimeout(timeout); reject(new Error("cv missing")); }
    };
    s.onerror = () => { clearTimeout(timeout); reject(new Error("opencv load failed")); };
    document.head.appendChild(s);
  });
  openCvPromise.catch(() => { openCvPromise = null; }); // اسمح بإعادة المحاولة لاحقاً
  return openCvPromise;
}

type Corner = { x: number; y: number };
type Quad = { tl: Corner; tr: Corner; bl: Corner; br: Corner };

/**
 * يجد حدود أكبر ورقة في الصورة (نفس خوارزمية jscanify: Canny → Blur → Otsu →
 * أكبر كونتور → أبعد نقطة في كل ربع) مع تحرير كل كائنات Mat الوسيطة —
 * هذه الدالة تعمل كل ~160ms فأي تسريب يراكم ذاكرة WASM حتى يتوقف المسح.
 */
function findPaperQuad(srcCanvas: HTMLCanvasElement): Quad | null {
  // محاولتان: العادية أولاً، ثم حساسية أعلى للورق منخفض التباين —
  // حتى لا يظل الماسح «يبحث» طويلاً في الإضاءة العادية للفصول.
  return (
    findPaperQuadPass(srcCanvas, 50, 200) ?? findPaperQuadPass(srcCanvas, 25, 110)
  );
}

function findPaperQuadPass(srcCanvas: HTMLCanvasElement, cannyLo: number, cannyHi: number): Quad | null {
  const src = cv.imread(srcCanvas);
  const edges = new cv.Mat();
  const blur = new cv.Mat();
  const thresh = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let best: any = null;
  try {
    cv.Canny(src, edges, cannyLo, cannyHi);
    cv.GaussianBlur(edges, blur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.threshold(blur, thresh, 0, 255, cv.THRESH_OTSU);
    cv.findContours(thresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
    let maxArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const a = cv.contourArea(c);
      if (a > maxArea) { maxArea = a; best?.delete(); best = c; }
      else c.delete();
    }
    if (!best) return null;
    const center = cv.minAreaRect(best).center;
    const pts = best.data32S as Int32Array;
    let tl: Corner | null = null, tr: Corner | null = null, bl: Corner | null = null, br: Corner | null = null;
    let dTl = 0, dTr = 0, dBl = 0, dBr = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const p = { x: pts[i], y: pts[i + 1] };
      const d = Math.hypot(p.x - center.x, p.y - center.y);
      if (p.x < center.x && p.y < center.y) { if (d > dTl) { tl = p; dTl = d; } }
      else if (p.x > center.x && p.y < center.y) { if (d > dTr) { tr = p; dTr = d; } }
      else if (p.x < center.x && p.y > center.y) { if (d > dBl) { bl = p; dBl = d; } }
      else if (p.x > center.x && p.y > center.y) { if (d > dBr) { br = p; dBr = d; } }
    }
    return tl && tr && bl && br ? { tl, tr, bl, br } : null;
  } finally {
    best?.delete();
    hierarchy.delete(); contours.delete(); thresh.delete(); blur.delete(); edges.delete(); src.delete();
  }
}

/** قصّ الورقة وتصحيح المنظور (warpPerspective) مع تحرير كل الكائنات الوسيطة */
function warpPaper(srcCanvas: HTMLCanvasElement, q: Quad, outW: number, outH: number): HTMLCanvasElement {
  const img = cv.imread(srcCanvas);
  const dst = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    q.tl.x, q.tl.y, q.tr.x, q.tr.y, q.bl.x, q.bl.y, q.br.x, q.br.y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, 0, outH, outW, outH]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  try {
    cv.warpPerspective(img, dst, M, new cv.Size(outW, outH), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    const out = document.createElement("canvas");
    cv.imshow(out, dst);
    return out;
  } finally {
    M.delete(); dstTri.delete(); srcTri.delete(); dst.delete(); img.delete();
  }
}

/* ── معايير الالتقاط التلقائي ──
 * مضبوطة للسرعة (نمط تطبيقات السكانر): الالتقاط خلال ~ثلث ثانية من ظهور
 * الورقة كاملة، والفحوص متساهلة — الهدف منع الصور السيئة فعلاً فقط. */
const ANALYZE_MS = 100;          // فاصل تحليل الإطارات
const WORK_MAX_SIDE = 400;       // دقة التحليل (منخفضة = سريعة)
const MIN_AREA_RATIO = 0.14;     // الورقة يجب أن تملأ ≥14% من الكادر
const MAX_AREA_RATIO = 0.99;
const EDGE_MARGIN_RATIO = 0.008; // كل الزوايا داخل الكادر بهامش
const MIN_BRIGHTNESS = 45;       // متوسط الإضاءة (0-255)
const MIN_SHARPNESS = 30;        // تباين لابلاس التقريبي (يمنع الضبابي جداً فقط)
const STABLE_MOVE_RATIO = 0.035; // أقصى حركة للزوايا بين إطارين
const HOLD_MS = 320;             // مدة الثبات قبل الالتقاط
const REARM_LOST_FRAMES = 3;     // إطارات بلا ورقة قبل إعادة التسليح
const PREVIEW_AUTO_MS = 1200;    // اعتماد المعاينة تلقائياً
const OUT_MAX_SIDE = 1800;       // أقصى بعد للصورة الناتجة

function quadArea(q: Quad): number {
  const pts = [q.tl, q.tr, q.br, q.bl];
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = pts[i], n = pts[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** إضاءة وحدة من ImageData رمادية تقريبية + حدة (تباين لابلاس مبسط) */
function frameStats(d: Uint8ClampedArray, w: number, h: number) {
  // عينة رمادية مصغرة
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const g = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
    gray[i] = g; sum += g;
  }
  const mean = sum / (w * h);
  // لابلاس 4-جوار على شبكة متباعدة (خطوة 2) لتسريع الحساب
  let lapSum = 0, lapSq = 0, n = 0;
  for (let y = 2; y < h - 2; y += 2) {
    for (let x = 2; x < w - 2; x += 2) {
      const i = y * w + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += v; lapSq += v * v; n++;
    }
  }
  const lapMean = lapSum / n;
  const sharpness = lapSq / n - lapMean * lapMean; // التباين
  return { brightness: mean, sharpness };
}

export type DocScannerCameraProps = {
  /**
   * استلام الصورة النهائية (data URL) بعد القص والتصحيح.
   * بعد كل اعتماد تعود الكاميرا لوضع انتظار الصفحة التالية —
   * الأب يقرر متى تُغلق (لأنه وحده يعرف عدد الصفحات بعد قراءة QR).
   */
  onCapture: (dataUrl: string) => void;
  /** إغلاق الكاميرا (زر إلغاء أو اكتمال الالتقاط من جهة الأب) */
  onClose: () => void;
  /** نص إرشادي أعلى الكاميرا (مثل: صوّر الصفحة 2) */
  hint?: string;
};

export default function DocScannerCamera({ onCapture, onClose, hint }: DocScannerCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef(0);

  // حالة الثبات (refs — تُحدَّث كل إطار بلا إعادة رسم)
  const prevQuadRef = useRef<Quad | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const armedRef = useRef(true);          // مسموح بالالتقاط التلقائي؟
  const lostFramesRef = useRef(0);
  const capturingRef = useRef(false);

  const [phase, setPhase] = useState<"starting" | "scanning" | "preview">("starting");
  const [cvReady, setCvReady] = useState<boolean | null>(null); // null=يُحمَّل، false=فشل (وضع يدوي)
  const [status, setStatus] = useState("جارٍ تشغيل الكاميرا…");
  const [holdPct, setHoldPct] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [autoLeft, setAutoLeft] = useState(0);
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /* ── فتح الكاميرا وتحميل الماسح ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        setPhase("scanning");
      } catch {
        setStatus("تعذّر الوصول للكاميرا");
        onClose();
        return;
      }
      loadOpenCv()
        .then(() => { if (!cancelled) setCvReady(true); })
        .catch(() => { if (!cancelled) setCvReady(false); });
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      cancelAnimationFrame(rafRef.current);
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ربط البث بعد رسم <video>
  useEffect(() => {
    if (phase !== "scanning" || !streamRef.current || !videoRef.current) return;
    const v = videoRef.current;
    v.srcObject = streamRef.current;
    v.play().catch(() => { /* تشغيل تلقائي */ });
  }, [phase]);

  /* ── الالتقاط الفعلي: كادر كامل الدقة + قص وتصحيح منظور ── */
  const doCapture = useCallback((quadWork: Quad | null, workW: number, workH: number) => {
    const v = videoRef.current;
    // videoWidth=0: البث لم يجهز بعد — تجاهل الضغط المبكر بدل التقاط صورة فارغة
    if (!v || capturingRef.current || v.videoWidth === 0) return;
    capturingRef.current = true;
    // نزع التسليح لكل مسارات الالتقاط (تلقائي ويدوي): لا التقاط تلقائي جديد
    // حتى تخرج الورقة الحالية من الكادر — يمنع التقاط نفس الصفحة مرتين.
    armedRef.current = false;
    try {
      const full = document.createElement("canvas");
      full.width = v.videoWidth; full.height = v.videoHeight;
      full.getContext("2d")!.drawImage(v, 0, 0);
      let out: HTMLCanvasElement = full;
      if (quadWork && cvReady) {
        const sx = full.width / workW, sy = full.height / workH;
        const q: Quad = {
          tl: { x: quadWork.tl.x * sx, y: quadWork.tl.y * sy },
          tr: { x: quadWork.tr.x * sx, y: quadWork.tr.y * sy },
          bl: { x: quadWork.bl.x * sx, y: quadWork.bl.y * sy },
          br: { x: quadWork.br.x * sx, y: quadWork.br.y * sy },
        };
        // أبعاد الناتج من متوسط أطوال الأضلاع (يحفظ نسبة الورقة الحقيقية)
        const dist = (a: Corner, b: Corner) => Math.hypot(a.x - b.x, a.y - b.y);
        let w = (dist(q.tl, q.tr) + dist(q.bl, q.br)) / 2;
        let h = (dist(q.tl, q.bl) + dist(q.tr, q.br)) / 2;
        const scale = Math.min(1, OUT_MAX_SIDE / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        try {
          out = warpPaper(full, q, w, h);
        } catch { /* عند فشل التصحيح نستخدم الكادر الكامل */ }
      }
      const url = out.toDataURL("image/jpeg", 0.85);
      setPreview(url);
      setPhase("preview");
      setHoldPct(0);
      stableSinceRef.current = null;
      prevQuadRef.current = null;
    } finally {
      capturingRef.current = false;
    }
  }, [cvReady]);

  /* ── حلقة التحليل: اكتشاف + رسم الإطار + منطق الثبات ── */
  useEffect(() => {
    if (phase !== "scanning") return;
    const work = document.createElement("canvas");
    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (ts - lastTickRef.current < ANALYZE_MS) return;
      lastTickRef.current = ts;
      const v = videoRef.current, overlay = overlayRef.current;
      if (!v || !overlay || v.videoWidth === 0) return;
      if (cvReady !== true) {
        setStatus(cvReady === false ? "الاكتشاف التلقائي غير متاح — استخدم زر التصوير" : "جارٍ تجهيز الاكتشاف التلقائي…");
        return;
      }

      // إطار عمل مصغّر
      const ratio = Math.min(1, WORK_MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * ratio), h = Math.round(v.videoHeight * ratio);
      work.width = w; work.height = h;
      const wctx = work.getContext("2d", { willReadFrequently: true })!;
      wctx.drawImage(v, 0, 0, w, h);

      // اكتشاف حدود الورقة (كل كائنات OpenCV تُحرَّر داخل الدالة)
      let quad: Quad | null = null;
      try {
        quad = findPaperQuad(work);
      } catch { /* إطار فاسد — تجاهل */ }

      // فحوص الجودة
      const now = performance.now();
      let ok = false;
      let msg = "وجّه الكاميرا نحو الورقة";
      if (quad) {
        const area = quadArea(quad) / (w * h);
        const m = EDGE_MARGIN_RATIO * Math.max(w, h);
        const inside = [quad.tl, quad.tr, quad.bl, quad.br].every(
          (p) => p.x > m && p.y > m && p.x < w - m && p.y < h - m
        );
        if (area < MIN_AREA_RATIO) msg = "اقترب أكثر من الورقة";
        else if (!inside || area > MAX_AREA_RATIO) msg = "أدخل الورقة كاملة داخل الكادر";
        else {
          const { brightness, sharpness } = frameStats(wctx.getImageData(0, 0, w, h).data, w, h);
          if (brightness < MIN_BRIGHTNESS) msg = "الإضاءة ضعيفة — حسّن الإضاءة";
          else if (sharpness < MIN_SHARPNESS) msg = "الصورة غير واضحة — ثبّت الجهاز";
          else ok = true;
        }
      }

      // منطق الثبات وإعادة التسليح
      if (!quad) {
        lostFramesRef.current++;
        if (lostFramesRef.current >= REARM_LOST_FRAMES) armedRef.current = true;
      } else {
        lostFramesRef.current = 0;
      }
      let pct = 0;
      if (ok && quad) {
        const prev = prevQuadRef.current;
        const diag = Math.hypot(w, h);
        const moved = prev
          ? Math.max(
              Math.hypot(quad.tl.x - prev.tl.x, quad.tl.y - prev.tl.y),
              Math.hypot(quad.tr.x - prev.tr.x, quad.tr.y - prev.tr.y),
              Math.hypot(quad.bl.x - prev.bl.x, quad.bl.y - prev.bl.y),
              Math.hypot(quad.br.x - prev.br.x, quad.br.y - prev.br.y)
            ) / diag
          : 1;
        if (moved < STABLE_MOVE_RATIO) {
          if (stableSinceRef.current == null) stableSinceRef.current = now;
          const held = now - stableSinceRef.current;
          pct = Math.min(1, held / HOLD_MS);
          msg = armedRef.current ? "ثبّت الجهاز…" : "ارفع الورقة ثم ضع التالية";
          if (held >= HOLD_MS && armedRef.current && !capturingRef.current) {
            armedRef.current = false; // لا التقاط ثانياً حتى تخرج الورقة من الكادر
            doCapture(quad, w, h);
            return;
          }
        } else {
          stableSinceRef.current = null;
          msg = "ثبّت الجهاز…";
        }
      } else {
        stableSinceRef.current = null;
      }
      prevQuadRef.current = quad;

      // رسم الإطار على الطبقة العلوية
      const rect = v.getBoundingClientRect();
      overlay.width = rect.width * devicePixelRatio;
      overlay.height = rect.height * devicePixelRatio;
      const octx = overlay.getContext("2d")!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
      if (quad) {
        // object-cover: احسب القص والقياس من إطار العمل إلى العرض
        const scale = Math.max(overlay.width / w, overlay.height / h);
        const offX = (overlay.width - w * scale) / 2;
        const offY = (overlay.height - h * scale) / 2;
        const P = (p: Corner) => [p.x * scale + offX, p.y * scale + offY] as const;
        octx.strokeStyle = ok ? "#10b981" : "#f59e0b";
        octx.lineWidth = 3 * devicePixelRatio;
        octx.fillStyle = ok ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.08)";
        octx.beginPath();
        octx.moveTo(...P(quad.tl)); octx.lineTo(...P(quad.tr));
        octx.lineTo(...P(quad.br)); octx.lineTo(...P(quad.bl));
        octx.closePath(); octx.fill(); octx.stroke();
      }
      setHoldPct(pct);
      setStatus(msg);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, cvReady, doCapture]);

  /* ── معاينة: اعتماد تلقائي سريع مع خيار إعادة التصوير ── */
  useEffect(() => {
    if (phase !== "preview" || !preview) return;
    const started = Date.now();
    setAutoLeft(PREVIEW_AUTO_MS);
    previewTimerRef.current = setInterval(() => {
      const left = PREVIEW_AUTO_MS - (Date.now() - started);
      setAutoLeft(Math.max(0, left));
      if (left <= 0) accept();
    }, 100);
    return () => { if (previewTimerRef.current) clearInterval(previewTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, preview]);

  const accept = useCallback(() => {
    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    const url = preview;
    setPreview(null);
    if (!url) return;
    onCapture(url);
    // العودة دائماً لوضع الانتظار — الأب يغلق الماسح عندما يتأكد من اكتمال
    // الالتقاط (قد يكشف QR أن الورقة متعددة الصفحات بعد الصفحة الأولى).
    setPhase("scanning");
  }, [preview, onCapture]);

  const retake = () => {
    if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    setPreview(null);
    armedRef.current = true;
    lostFramesRef.current = 0;
    setPhase("scanning");
  };

  const manualCapture = () => {
    // زر احتياطي: استخدم آخر إطار مكتشف إن وُجد، وإلا الكادر الكامل
    const v = videoRef.current;
    if (!v) return;
    const ratio = Math.min(1, WORK_MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    doCapture(prevQuadRef.current, Math.round(v.videoWidth * ratio), Math.round(v.videoHeight * ratio));
  };

  /* ── واجهة ── */
  if (phase === "preview" && preview) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <img src={preview} alt="الصفحة الملتقطة" className="w-full rounded-xl border-2 border-emerald-400" />
          <span className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> تم القص والتصحيح
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={accept}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4" />
            اعتماد {autoLeft > 0 ? `(${Math.ceil(autoLeft / 1000)})` : ""}
          </button>
          <button
            onClick={retake}
            className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1"
          >
            <RefreshCcw className="w-4 h-4" /> إعادة التصوير
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hint && <p className="text-xs font-bold text-slate-600 dark:text-slate-300 text-center">{hint}</p>}
      <div className="relative">
        <video ref={videoRef} playsInline muted className="w-full rounded-xl bg-black aspect-[3/4] object-cover" />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none rounded-xl" />
        {/* شريط الحالة + حلقة تقدم الثبات */}
        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-2">
          <span className="px-2.5 py-1.5 rounded-lg bg-black/60 text-white text-xs font-bold backdrop-blur-sm flex items-center gap-1.5">
            {phase === "starting" || cvReady === null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {status}
          </span>
          {holdPct > 0 && (
            <span className="w-9 h-9 shrink-0 rounded-full grid place-items-center bg-black/60 backdrop-blur-sm">
              <svg viewBox="0 0 36 36" className="w-7 h-7 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="#10b981" strokeWidth="4"
                  strokeDasharray={`${holdPct * 94.2} 94.2`} strokeLinecap="round"
                />
              </svg>
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={manualCapture}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
        >
          <Camera className="w-4 h-4" /> التقاط يدوي
        </button>
        <button
          onClick={onClose}
          className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
