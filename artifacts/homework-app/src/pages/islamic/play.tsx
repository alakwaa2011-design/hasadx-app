import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { api, IslamicShell, IslamicCard, GoldButton, GhostButton, BackLink, ISLAMIC_GOLD, ISLAMIC_GREEN, playCorrect, playWrong } from "./_shared";
import AudioPlayer from "@/components/AudioPlayer";

interface Q {
  id: number;
  questionText: string;
  audioUrl: string | null;
  options: string[];
  correctAnswer: string;
  difficulty: string;
  level?: number;
}

const BASE_TIME = 25;
const QURRA_NAME = "من القارئ";

const LEVEL_NAMES: Record<number, string> = { 1: "الأساسي", 2: "المتقدم", 3: "الخبراء" };
const LEVEL_COLORS: Record<number, string> = { 1: "#16a34a", 2: "#d97706", 3: "#dc2626" };
const LEVEL_ICONS: Record<number, string> = { 1: "🌱", 2: "🔥", 3: "💎" };

export default function IslamicPlay() {
  const [, params] = useRoute("/islamic/play/:categoryId");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const categoryId = parseInt(params?.categoryId || "0");
  const level = parseInt(new URLSearchParams(search).get("level") || "1") || 1;

  const [questions, setQuestions] = useState<Q[] | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const answeredCountRef = useRef<number>(0);
  const doneRef = useRef<boolean>(false);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stars, setStars] = useState<number[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wrongAttempt, setWrongAttempt] = useState<boolean | null>(null);
  const [shake, setShake] = useState(false);
  const [glow, setGlow] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(BASE_TIME);
  const [audioPenaltyExtra, setAudioPenaltyExtra] = useState(0);
  const [certificateMode, setCertificateMode] = useState<boolean | null>(null);
  const [askedAboutCert, setAskedAboutCert] = useState(false);
  const [finalCert, setFinalCert] = useState<{ serial: string } | null>(null);
  const [certEnabled, setCertEnabled] = useState<boolean>(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [waitingReveal, setWaitingReveal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [nextLevelUnlocked, setNextLevelUnlocked] = useState<number | null>(null);

  const startRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const audioListensRef = useRef<number>(0);

  useEffect(() => {
    api<{ questions: Q[]; sessionId: string; level: number }>(`/islamic/play/${categoryId}?level=${level}`)
      .then((r) => {
        if (r.questions.length === 0) setErrorMsg("لا أسئلة في هذا المستوى بعد");
        setQuestions(r.questions);
        sessionIdRef.current = r.sessionId;
        sessionStartRef.current = Date.now();
        answeredCountRef.current = 0;
      })
      .catch((e) => setErrorMsg(e.message));
    api<Array<{ id: number; name: string; categories: Array<{ id: number; name: string }> }>>("/islamic/sections").then((sections) => {
      for (const s of sections) {
        const c = s.categories.find((c) => c.id === categoryId);
        if (c) setCategoryName(c.name);
      }
    });
    api<{ showCertificates?: boolean }>("/islamic/access")
      .then((a) => setCertEnabled(!!a?.showCertificates))
      .catch(() => setCertEnabled(false));
  }, [categoryId, level]);

  useEffect(() => {
    if (!questions || done || revealed) return;
    startRef.current = Date.now();
    audioListensRef.current = 0;
    setAudioPenaltyExtra(0);
    setWaitingReveal(false);
    setSecondsLeft(BASE_TIME);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        const elapsed = (Date.now() - startRef.current) / 1000;
        const remaining = Math.max(0, BASE_TIME - elapsed - audioPenaltyExtra);
        if (remaining <= 0) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          // For audio questions: freeze and wait for manual reveal instead of auto-revealing
          const currentQ = questions[idx];
          if (currentQ?.audioUrl) {
            setWaitingReveal(true);
          } else {
            handleAnswer(null);
          }
          return 0;
        }
        return remaining;
      });
    }, 100);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [idx, questions, done, revealed, audioPenaltyExtra]);

  const q = questions?.[idx];

  function timeColor(): string {
    const ratio = secondsLeft / BASE_TIME;
    if (ratio > 0.5) return "#10b981";
    if (ratio > 0.25) return "#eab308";
    return "#ef4444";
  }

  async function handleAnswer(choice: string | null) {
    if (!q || revealed) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    // audio is managed by AudioPlayer component; nothing to pause here
    const elapsed = (Date.now() - startRef.current) / 1000;
    const isCorrect = choice !== null && choice === q.correctAnswer;
    setSelected(choice);
    setRevealed(true);
    setWrongAttempt(!isCorrect);
    if (isCorrect) {
      playCorrect();
      setGlow(true);
      setTimeout(() => setGlow(false), 800);
    } else {
      playWrong();
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    let starThis = 0;
    if (isCorrect) starThis = elapsed < 5 ? 3 : elapsed < 15 ? 2 : 1;
    setStars((s) => [...s, starThis]);

    try {
      const r = await api<{ stars: number; pointsAwarded: number; dailyBonus: number }>("/islamic/answer", {
        method: "POST",
        body: JSON.stringify({
          questionId: q.id,
          categoryId,
          isCorrect,
          timeSeconds: elapsed,
          currentStreak: streak,
          isFirstQuestion: idx === 0,
          sessionId: sessionIdRef.current,
        }),
      });
      setPoints((p) => p + r.pointsAwarded + r.dailyBonus);
    } catch {}
    answeredCountRef.current += 1;

    if (isCorrect) setStreak((s) => s + 1);
    else setStreak(0);

    if (certEnabled) {
      if (!isCorrect && !askedAboutCert) {
        setCertificateMode(false);
        setAskedAboutCert(true);
      }
    }
  }

  async function next() {
    if (!questions) return;
    if (idx + 1 >= questions.length) {
      const allCorrect = stars.every((s) => s > 0);
      const totalStars = stars.reduce((a, b) => a + b, 0);
      try {
        const durationSeconds = (Date.now() - sessionStartRef.current) / 1000;
        const r = await api<{ completionBonus: number; certificate: { serial: string } | null; nextLevel: number | null; unlockedNextLevel: boolean }>("/islamic/complete", {
          method: "POST",
          body: JSON.stringify({
            categoryId,
            totalQuestions: questions.length,
            allCorrect,
            certificateEligible: allCorrect && (certificateMode ?? true),
            totalStars,
            sessionId: sessionIdRef.current,
            durationSeconds,
            level,
          }),
        });
        setPoints((p) => p + r.completionBonus);
        if (r.certificate) setFinalCert(r.certificate);
        if (r.unlockedNextLevel && r.nextLevel) setNextLevelUnlocked(r.nextLevel);
      } catch {}
      doneRef.current = true;
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setRevealed(false);
    setWrongAttempt(null);
  }

  function handleAudioListen() {
    audioListensRef.current++;
    if (audioListensRef.current > 1) setAudioPenaltyExtra((p) => p + 2);
  }

  function restartFromZero() {
    setIdx(0);
    setSelected(null);
    setRevealed(false);
    setStars([]);
    setPoints(0);
    setStreak(0);
    setCertificateMode(true);
    setAskedAboutCert(false);
    setWrongAttempt(null);
    setDone(false);
    doneRef.current = false;
    sessionStartRef.current = Date.now();
    answeredCountRef.current = 0;
  }

  useEffect(() => {
    function emitExit() {
      if (doneRef.current || !sessionIdRef.current) return;
      const payload = JSON.stringify({
        categoryId,
        sessionId: sessionIdRef.current,
        questionsAnswered: answeredCountRef.current,
        durationSeconds: (Date.now() - sessionStartRef.current) / 1000,
      });
      const url = `${import.meta.env.BASE_URL}api/islamic/events/exit`.replace(/\/+/g, "/");
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            credentials: "include",
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    }
    window.addEventListener("beforeunload", emitExit);
    window.addEventListener("pagehide", emitExit);
    return () => {
      window.removeEventListener("beforeunload", emitExit);
      window.removeEventListener("pagehide", emitExit);
      emitExit();
    };
  }, [categoryId]);

  if (errorMsg) {
    return (
      <IslamicShell title={categoryName || "مسابقة"}>
        <BackLink />
        <IslamicCard><p style={{ textAlign: "center" }}>{errorMsg}</p></IslamicCard>
      </IslamicShell>
    );
  }
  if (!questions || !q) {
    return (
      <IslamicShell title="جاري التحميل">
        <BackLink />
        <IslamicCard><p style={{ textAlign: "center" }}>…</p></IslamicCard>
      </IslamicShell>
    );
  }

  if (done) {
    const totalStars = stars.reduce((a, b) => a + b, 0);
    const allCorrect = stars.every((s) => s > 0);
    return (
      <IslamicShell title="انتهت الجلسة">
        <BackLink />

        {/* Level unlock celebration */}
        {nextLevelUnlocked && (
          <div style={{
            background: "linear-gradient(135deg, #7c2d12, #dc2626)",
            border: `3px solid ${ISLAMIC_GOLD}`,
            borderRadius: 20,
            padding: 28,
            textAlign: "center",
            marginBottom: 20,
            boxShadow: `0 0 40px ${ISLAMIC_GOLD}88`,
            animation: "levelUnlock 0.5s ease-out",
          }}>
            <style>{`@keyframes levelUnlock { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{LEVEL_ICONS[nextLevelUnlocked] ?? "🏆"}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: ISLAMIC_GOLD, marginBottom: 6 }}>
              🔓 تهانينا! فتحت المستوى {nextLevelUnlocked === 2 ? "الثاني" : "الثالث"}!
            </div>
            <div style={{ fontSize: 16, opacity: 0.9, marginBottom: 16 }}>
              {LEVEL_NAMES[nextLevelUnlocked]} — {nextLevelUnlocked === 2 ? "أسئلة أصعب تنتظرك!" : "أنت من الخبراء!"}
            </div>
            <GoldButton onClick={() => setLocation(`/islamic/play/${categoryId}?level=${nextLevelUnlocked}`)}>
              {LEVEL_ICONS[nextLevelUnlocked]} العب المستوى {nextLevelUnlocked === 2 ? "الثاني" : "الثالث"} الآن!
            </GoldButton>
          </div>
        )}

        <IslamicCard glow>
          <div style={{ textAlign: "center", fontSize: 22, lineHeight: 2 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{
                background: LEVEL_COLORS[level] ?? ISLAMIC_GREEN,
                color: "#fff",
                borderRadius: 8,
                padding: "2px 12px",
                fontSize: 14,
                fontWeight: 700,
              }}>
                {LEVEL_ICONS[level]} المستوى {level === 1 ? "الأساسي" : level === 2 ? "المتقدم" : "الخبراء"}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              {allCorrect ? "ممتاز! أجبت بدون أي خطأ 🎉" : "أحسنت! 🎉"}
            </div>
            <div>النقاط المكتسبة: <span style={{ color: ISLAMIC_GOLD, fontWeight: 900 }}>{points}</span></div>
            <div>إجمالي النجوم: {"⭐".repeat(Math.min(totalStars, 30))} ({totalStars})</div>
            {!allCorrect && level > 1 && (
              <div style={{ fontSize: 15, color: "#fca5a5", marginTop: 8 }}>
                ⚠️ يلزم الإجابة بدون أخطاء لفتح المستوى التالي
              </div>
            )}
            {certEnabled && finalCert && (
              <>
                <div style={{ marginTop: 16, color: ISLAMIC_GOLD, fontWeight: 900 }}>
                  🏆 حصلت على شهادة! رقم {finalCert.serial}
                </div>
                <GoldButton onClick={() => setLocation(`/islamic/certificate/${finalCert.serial}`)} style={{ marginTop: 12 }}>
                  عرض الشهادة
                </GoldButton>
              </>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <GhostButton onClick={() => setLocation("/islamic")}>الرئيسية</GhostButton>
              <GhostButton onClick={() => setLocation("/islamic/leaderboard")}>المتصدرون</GhostButton>
              {!allCorrect && (
                <GoldButton onClick={restartFromZero}>إعادة المحاولة ↺</GoldButton>
              )}
            </div>
          </div>
        </IslamicCard>
      </IslamicShell>
    );
  }

  const isQurra = categoryName.includes(QURRA_NAME) || !!q.audioUrl;

  return (
    <IslamicShell>
      <BackLink />

      {/* Level badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          background: LEVEL_COLORS[level] ?? ISLAMIC_GREEN,
          color: "#fff",
          borderRadius: 8,
          padding: "3px 12px",
          fontSize: 13,
          fontWeight: 700,
        }}>
          {LEVEL_ICONS[level]} المستوى {level === 1 ? "الأساسي" : level === 2 ? "المتقدم" : "الخبراء"}
        </span>
        {categoryName && <span style={{ fontSize: 14, opacity: 0.8 }}>{categoryName}</span>}
      </div>

      {certEnabled && idx === 0 && certificateMode === null && !askedAboutCert && (
        <IslamicCard glow style={{ marginBottom: 12 }}>
          <p style={{ textAlign: "center", fontSize: 17, fontWeight: 700 }}>
            تنبيه: الشهادة تُمنح فقط عند إجابة جميع الأسئلة صحيحةً في جلسة واحدة بدون أي خطأ.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <GoldButton onClick={() => { setCertificateMode(true); setAskedAboutCert(true); }}>أريد الشهادة</GoldButton>
            <GhostButton onClick={() => { setCertificateMode(false); setAskedAboutCert(true); }}>متابعة بدون شهادة</GhostButton>
          </div>
        </IslamicCard>
      )}

      {certEnabled && revealed && wrongAttempt && certificateMode === true && (
        <IslamicCard style={{ marginBottom: 12, border: `1px solid ${ISLAMIC_GOLD}` }}>
          <p style={{ textAlign: "center" }}>أخطأت! هل تريد البدء من الصفر للحصول على الشهادة؟</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
            <GoldButton onClick={restartFromZero}>نعم، ابدأ من الصفر</GoldButton>
            <GhostButton onClick={() => { setCertificateMode(false); }}>لا، أكمل بدون شهادة</GhostButton>
          </div>
        </IslamicCard>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
        <div>السؤال {idx + 1} / {questions.length}</div>
        <div>النقاط: <strong style={{ color: ISLAMIC_GOLD }}>{points}</strong></div>
        <div>سلسلة: {streak}🔥</div>
      </div>

      <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: `${(secondsLeft / BASE_TIME) * 100}%`, height: "100%", background: timeColor(), transition: "all 0.1s linear, background-color 0.3s" }} />
      </div>

      <IslamicCard
        glow={glow}
        style={{
          animation: shake ? "islamicShake 0.5s" : undefined,
          marginBottom: 16,
        }}
      >
        <style>{`@keyframes islamicShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 50%{transform:translateX(8px)} 75%{transform:translateX(-4px)} }`}</style>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, lineHeight: 1.8, textAlign: "center" }}>{q.questionText}</div>
        {q.audioUrl && (
          <div style={{ marginBottom: 16 }}>
            <AudioPlayer
              src={q.audioUrl}
              onListen={handleAudioListen}
              listenCount={audioListensRef.current}
            />
          </div>
        )}
      </IslamicCard>

      <style>{`
        .islamic-opt { position: relative; padding: 16px 60px 16px 20px; border-radius: 16px;
          font-family: inherit; font-size: 17px; font-weight: 600; line-height: 1.7;
          text-align: right; cursor: pointer; transition: all .18s ease; width: 100%;
          border: 2px solid transparent; color: #1c1208;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
        .islamic-opt:hover:not(:disabled) { transform: translateY(-3px);
          box-shadow: 0 8px 22px rgba(0,0,0,0.13); filter: brightness(0.96); }
        .islamic-opt:active:not(:disabled) { transform: translateY(0); }
        .islamic-opt:disabled { cursor: default; }
        .islamic-opt .ltr { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px; background: rgba(0,0,0,0.1); color: inherit;
          border: 2px solid rgba(0,0,0,0.12); }
        .opt-0 { background: #fef9c3; border-color: #fbbf24; }
        .opt-1 { background: #dbeafe; border-color: #60a5fa; }
        .opt-2 { background: #dcfce7; border-color: #4ade80; }
        .opt-3 { background: #ede9fe; border-color: #a78bfa; }
        .islamic-opt.correct { background: linear-gradient(135deg, #16a34a, #15803d) !important;
          border-color: #4ade80 !important; color: #fff !important;
          box-shadow: 0 0 0 3px rgba(74,222,128,0.3), 0 8px 22px rgba(22,163,74,0.4) !important; }
        .islamic-opt.correct .ltr { background: rgba(255,255,255,0.25); color: #fff; border-color: rgba(255,255,255,0.4); }
        .islamic-opt.wrong { background: linear-gradient(135deg, #b91c1c, #7f1d1d) !important;
          border-color: #fca5a5 !important; color: #fff !important; }
        .islamic-opt.wrong .ltr { background: rgba(255,255,255,0.25); color: #fff; border-color: rgba(255,255,255,0.4); }
        .islamic-opt.dim { opacity: .42; }
        .islamic-opt.waiting { opacity: .55; cursor: not-allowed; filter: grayscale(0.3); }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {q.options.map((opt, i) => {
          const isSel = selected === opt;
          const isCorrect = revealed && opt === q.correctAnswer;
          const isWrongPick = revealed && isSel && opt !== q.correctAnswer;
          const dim = revealed && !isCorrect && !isWrongPick;
          const letter = ["أ", "ب", "ج", "د"][i] || String(i + 1);
          const cls = [
            "islamic-opt",
            !revealed && !waitingReveal ? `opt-${i}` : "",
            isCorrect ? "correct" : "",
            isWrongPick ? "wrong" : "",
            dim ? "dim" : "",
            waitingReveal && !revealed ? "waiting" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={opt} onClick={() => handleAnswer(opt)} disabled={revealed || waitingReveal} className={cls}>
              <span className="ltr" aria-hidden="true">
                {isCorrect ? "✓" : isWrongPick ? "✕" : letter}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {/* Audio question: time ran out — wait for manual reveal */}
      {waitingReveal && !revealed && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div style={{ background: "#fef3c7", border: "1.5px solid #d97706", borderRadius: 14,
            padding: "14px 20px", marginBottom: 12, display: "inline-block" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
              ⏰ انتهى الوقت — الإجابة الصحيحة مخفية
            </div>
            <div style={{ fontSize: 13, color: "#b45309", marginBottom: 12 }}>
              اضغط الزر أدناه عندما تريد كشف الإجابة
            </div>
            <GoldButton onClick={() => handleAnswer(null)}>🔍 كشف الإجابة</GoldButton>
          </div>
        </div>
      )}

      {revealed && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <GoldButton onClick={next}>{idx + 1 >= questions.length ? "إنهاء" : "السؤال التالي"}</GoldButton>
        </div>
      )}
    </IslamicShell>
  );
}
