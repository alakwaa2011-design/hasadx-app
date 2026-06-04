import { useState, useEffect, useRef } from "react";
import { Zap } from "lucide-react";

const QUESTIONS = [
  {
    text: "ما عاصمة المملكة العربية السعودية؟",
    options: ["الرياض", "جدة", "مكة المكرمة", "الدمام"],
    correct: 0,
  },
  {
    text: "كم عدد أيام الأسبوع؟",
    options: ["خمسة", "ستة", "سبعة", "ثمانية"],
    correct: 2,
  },
  {
    text: "ما أكبر كوكب في المجموعة الشمسية؟",
    options: ["زحل", "المشتري", "الأرض", "أورانوس"],
    correct: 1,
  },
];

const OPTION_COLORS = [
  {
    bgStyle: {
      background: "linear-gradient(135deg, rgba(220,70,95,0.95) 0%, rgba(175,45,70,0.95) 100%)",
      border: "1px solid rgba(255,165,180,0.28)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
    },
    label: "أ",
  },
  {
    bgStyle: {
      background: "linear-gradient(135deg, rgba(60,120,220,0.95) 0%, rgba(40,90,185,0.95) 100%)",
      border: "1px solid rgba(155,195,255,0.3)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
    },
    label: "ب",
  },
  {
    bgStyle: {
      background: "linear-gradient(135deg, rgba(34,180,115,0.95) 0%, rgba(22,140,85,0.95) 100%)",
      border: "1px solid rgba(140,235,180,0.3)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
    },
    label: "ج",
  },
  {
    bgStyle: {
      background: "linear-gradient(135deg, rgba(160,100,225,0.95) 0%, rgba(120,70,190,0.95) 100%)",
      border: "1px solid rgba(210,170,255,0.3)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)",
    },
    label: "د",
  },
];

type Phase = "question" | "reveal" | "next";

export function WameethPreviewCard({ onStart }: { onStart?: () => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [timer, setTimer] = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const question = QUESTIONS[qIndex];

  // تايمر العد التنازلي
  useEffect(() => {
    if (phase !== "question") return;
    setTimer(10);
    intervalRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          setPhase("reveal");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [phase, qIndex]);

  // بعد الكشف عن الإجابة ننتقل للسؤال التالي
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => {
      setPhase("next");
    }, 2000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "next") return;
    const t = setTimeout(() => {
      setQIndex((i) => (i + 1) % QUESTIONS.length);
      setPhase("question");
    }, 600);
    return () => clearTimeout(t);
  }, [phase]);

  const timerPct = (timer / 10) * 100;
  const timerColor = timer > 5 ? "#3dff8a" : timer > 2 ? "#f4c95d" : "#ff5555";

  return (
    <div
      dir="rtl"
      style={{
        borderRadius: 20,
        overflow: "hidden",
        background: "linear-gradient(180deg, #000503 0%, #010907 38%, #02140c 100%)",
        border: "1px solid rgba(212,166,58,0.22)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        position: "relative",
        cursor: "pointer",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px) scale(1.01)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 52px rgba(0,0,0,0.58), 0 0 0 1px rgba(212,166,58,0.32)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0) scale(1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.45)";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px) scale(0.99)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.38)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px) scale(1.01)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 52px rgba(0,0,0,0.58), 0 0 0 1px rgba(212,166,58,0.32)";
      }}
    >
      {/* شريط العنوان */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid rgba(212,166,58,0.15)",
          background: "rgba(10,58,34,0.4)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap style={{ width: 14, height: 14, color: "#f4c95d" }} />
            <span style={{ color: "#f4c95d", fontSize: 12, fontWeight: 700 }}>وميض</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>— معاينة</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, lineHeight: 1.4, paddingRight: 2 }}>
            تنافس مباشر بنتائج فورية · دخول برابط أو رمز أو باركود
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* التايمر الدائري */}
          <div style={{ position: "relative", width: 28, height: 28 }}>
            <svg width="28" height="28" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
              <circle
                cx="14" cy="14" r="11"
                fill="none"
                stroke={timerColor}
                strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 11}`}
                strokeDashoffset={`${2 * Math.PI * 11 * (1 - timerPct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
              />
            </svg>
            <span style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              color: timerColor, fontSize: 10, fontWeight: 700,
              transition: "color 0.3s",
            }}>
              {phase === "question" ? timer : ""}
            </span>
          </div>
        </div>
      </div>

      {/* نص السؤال */}
      <div style={{ padding: "16px 16px 10px" }}>
        <div
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.052) 0%, rgba(20,56,40,0.30) 100%)",
            border: "1px solid rgba(232,184,75,0.28)",
            borderRadius: 14,
            padding: "14px 16px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            marginBottom: 12,
          }}
        >
          {/* بيل السؤال */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99, padding: "2px 10px",
              color: "rgba(255,255,255,0.55)", fontSize: 11,
            }}>
              سؤال {qIndex + 1} من {QUESTIONS.length}
            </span>
          </div>
          <p style={{
            color: "rgba(255,255,255,0.95)", fontWeight: 700,
            fontSize: 15, textAlign: "center", lineHeight: 1.7, margin: 0,
          }}>
            {question.text}
          </p>
          {/* الماسة الذهبية */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
            <span style={{ height: 1, width: 32, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.15))" }} />
            <span style={{ width: 7, height: 7, transform: "rotate(45deg)", background: "rgba(232,184,75,0.6)", boxShadow: "0 0 8px rgba(232,184,75,0.4)", display: "block" }} />
            <span style={{ height: 1, width: 32, background: "linear-gradient(to left, transparent, rgba(255,255,255,0.15))" }} />
          </div>
        </div>

        {/* الخيارات */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {question.options.map((opt, i) => {
            const isCorrect = i === question.correct;
            let extraStyle: React.CSSProperties = {};

            if (phase === "reveal") {
              if (isCorrect) {
                extraStyle = {
                  boxShadow: "0 0 20px rgba(74,222,128,0.7), 0 0 0 3px rgba(74,222,128,0.5)",
                  transform: "scale(1.04)",
                  filter: "brightness(1.1)",
                };
              } else {
                extraStyle = { opacity: 0.3, transform: "scale(0.97)" };
              }
            }

            return (
              <div
                key={i}
                style={{
                  ...OPTION_COLORS[i].bgStyle,
                  ...extraStyle,
                  borderRadius: 12,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.4s ease",
                  cursor: "default",
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "rgba(255,255,255,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0,
                }}>
                  {OPTION_COLORS[i].label}
                </span>
                <span style={{ color: "#fff", fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
                  {opt}
                </span>
              </div>
            );
          })}
        </div>

        {/* زر ابدأ */}
        <button
          onClick={onStart}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(180deg, #ffe08a 0%, #f4c95d 16%, #d4a63a 48%, #9a7020 100%)",
            color: "#1a1008",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 16px rgba(212,166,58,0.4)",
            transition: "transform 0.1s, box-shadow 0.1s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          ابدأ مسابقة وميض الآن ⚡
        </button>
      </div>
    </div>
  );
}
