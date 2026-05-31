import { useState, useEffect } from "react";
import { X, ArrowLeft, ArrowRight, Sparkles, Play, Plus, BookOpen, FolderOpen, CheckCircle } from "lucide-react";

const STORAGE_KEY = "hasadx-onboarding-done";

interface Step {
  icon: React.ReactNode;
  title: string;
  desc: string;
  highlight?: string; // لون خلفية الأيقونة
}

const STEPS_AR: Step[] = [
  {
    icon: <Sparkles className="w-7 h-7 text-white" />,
    title: "أهلاً بك في حصاد 🎉",
    desc: "المنصة التي تحوّل أسئلتك لتجربة تعليمية ممتعة — في ثوانٍ.",
    highlight: "#1e4d35",
  },
  {
    icon: <Play className="w-7 h-7 text-white" fill="white" />,
    title: "ابدأ مسابقة مباشرة",
    desc: "من الزر الذهبي في أعلى الصفحة تبدأ مسابقة حية مع طلابك أو جمهورك الآن.",
    highlight: "#b8860b",
  },
  {
    icon: <Plus className="w-7 h-7 text-white" />,
    title: "أنشئ نشاطك",
    desc: "أنشئ نشاطك بالذكاء الاصطناعي أو أضف أسئلتك بنفسك.",
    highlight: "#1e4d35",
  },
  {
    icon: <FolderOpen className="w-7 h-7 text-white" />,
    title: "واجباتي",
    desc: "بعد إنشاء نشاطك ستجده هنا دائماً وتقدر تشاركه أو تعيد استخدامه.",
    highlight: "#4a6fa5",
  },
  {
    icon: <BookOpen className="w-7 h-7 text-white" />,
    title: "مكتبة الأنشطة",
    desc: "هنا أنشطة أنشأها معلمون آخرون — استخدمها مباشرة أو عدّل عليها.",
    highlight: "#7c4d9f",
  },
  {
    icon: <CheckCircle className="w-7 h-7 text-white" />,
    title: "جاهز تبدأ؟",
    desc: "أنشئ أول نشاط لك الآن واكتشف كيف يصبح التعليم أكثر متعة.",
    highlight: "#1e4d35",
  },
];

interface Props {
  lang?: string;
  onCreateActivity?: () => void;
}

export function OnboardingTour({ lang = "ar", onCreateActivity }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // تأخير بسيط حتى تنتهي الصفحة من التحميل
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  function next() {
    if (step < STEPS_AR.length - 1) {
      setStep((s) => s + 1);
    } else {
      close();
      onCreateActivity?.();
    }
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!visible) return null;

  const current = STEPS_AR[step];
  const isLast = step === STEPS_AR.length - 1;
  const isFirst = step === 0;

  return (
    <>
      {/* الطبقة الداكنة خلف البطاقة */}
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 9998,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* البطاقة الرئيسية */}
      <div
        dir="rtl"
        style={{
          position: "fixed",
          zIndex: 9999,
          bottom: "50%",
          left: "50%",
          transform: "translate(-50%, 50%)",
          width: "min(92vw, 400px)",
          background: "#fff",
          borderRadius: 20,
          padding: "28px 24px 22px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* زر الإغلاق */}
        <button
          onClick={close}
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#999",
            padding: 4,
            borderRadius: 8,
          }}
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* الأيقونة والعنوان */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: current.highlight ?? "#1e4d35",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.3s ease",
            }}
          >
            {current.icon}
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.35 }}>
            {current.title}
          </h2>
        </div>

        {/* الوصف */}
        <p style={{ margin: 0, fontSize: 14.5, color: "#555", lineHeight: 1.7 }}>
          {current.desc}
        </p>

        {/* مؤشر الخطوات */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
          {STEPS_AR.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 7,
                height: 7,
                borderRadius: 99,
                background: i === step ? "#1e4d35" : "#ddd",
                transition: "all 0.25s ease",
              }}
            />
          ))}
        </div>

        {/* أزرار التنقل */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          {!isFirst ? (
            <button
              onClick={prev}
              style={{
                flex: 1,
                padding: "11px 16px",
                borderRadius: 12,
                border: "1.5px solid #e0e0e0",
                background: "#fff",
                color: "#555",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "inherit",
              }}
            >
              <ArrowRight className="w-4 h-4" />
              السابق
            </button>
          ) : (
            <button
              onClick={close}
              style={{
                flex: 1,
                padding: "11px 16px",
                borderRadius: 12,
                border: "1.5px solid #e0e0e0",
                background: "#fff",
                color: "#999",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              تخطّى
            </button>
          )}

          <button
            onClick={next}
            style={{
              flex: 2,
              padding: "11px 16px",
              borderRadius: 12,
              border: "none",
              background: isLast ? "#e8a80e" : "#1e4d35",
              color: isLast ? "#1e4d35" : "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "inherit",
              transition: "background 0.25s ease",
            }}
          >
            {isLast ? "أنشئ أول نشاط 🚀" : "التالي"}
            {!isLast && <ArrowLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );
}
