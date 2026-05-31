import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, IslamicShell, IslamicCard, IslamicNavBar, GoldButton, GhostButton, ISLAMIC_GOLD } from "./_shared";

interface Category {
  id: number;
  name: string;
  description: string | null;
  level: string;
  isVisible: boolean;
  order: number;
  questionCount: number;
  availableLevels: number[];
  userMaxLevel: number;
}
interface Section {
  id: number;
  name: string;
  description: string | null;
  isVisible: boolean;
  order: number;
  categories: Category[];
}
interface Progress {
  totalPoints: number;
  streak: number;
  todayBonus: number;
  certificates: Array<{ id: number; serial: string; categoryName: string; issuedAt: string; totalStars: number }>;
}

const ONBOARDING_KEY = "islamic_onboarded_v1";

const LEVEL_LABELS: Record<number, string> = { 1: "المستوى ١", 2: "المستوى ٢", 3: "المستوى ٣" };
const LEVEL_ICONS: Record<number, string> = { 1: "🌱", 2: "🔥", 3: "💎" };
const LEVEL_COLORS: Record<number, string> = { 1: "#16a34a", 2: "#d97706", 3: "#dc2626" };

export default function IslamicHome() {
  const [, setLocation] = useLocation();
  const [access, setAccess] = useState<{ hasAccess: boolean; isAdmin: boolean; showCertificates?: boolean } | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [welcome, setWelcome] = useState<string>("");
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  useEffect(() => {
    api<{ hasAccess: boolean; isAdmin: boolean; showCertificates?: boolean }>("/islamic/access")
      .then(setAccess)
      .catch(() => setAccess({ hasAccess: false, isAdmin: false, showCertificates: false }));
  }, []);

  useEffect(() => {
    if (!access?.hasAccess) return;
    if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
    api<Section[]>("/islamic/sections").then(setSections).catch(() => {});
    api<Progress>("/islamic/my-progress").then((p) => {
      setProgress(p);
      const msgs: string[] = [];
      if (p.streak === 6) msgs.push("تبقى لك يوم واحد لمكافأة 7 أيام! 🔥");
      else if (p.streak >= 3) msgs.push(`أنت في سلسلة ${p.streak} أيام! استمر 🔥`);
      else if (p.streak === 0) msgs.push("اقتربت تخسر سلسلتك 🔥 — ابدأ اليوم!");
      else msgs.push("جاهز تكسر رقمك السابق؟");
      if (p.todayBonus) msgs.push(`+${p.todayBonus} نقاط لدخولك اليومي 🎉`);
      setWelcome(msgs.join(" · "));
    }).catch(() => {});
  }, [access?.hasAccess]);

  if (access === null) {
    return (
      <IslamicShell topSlot={<IslamicNavBar />}>
        <div style={{ textAlign: "center", padding: 60 }}>جاري التحميل…</div>
      </IslamicShell>
    );
  }

  if (!access.hasAccess) {
    return (
      <IslamicShell title="مسابقات عامة" topSlot={<IslamicNavBar />}>
        <IslamicCard>
          <p style={{ textAlign: "center", fontSize: 18, lineHeight: 1.8 }}>
            يجب تسجيل الدخول للوصول إلى مسابقات عامة.
          </p>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <GhostButton onClick={() => setLocation("/")}>العودة للقائمة الرئيسية</GhostButton>
          </div>
        </IslamicCard>
      </IslamicShell>
    );
  }

  return (
    <IslamicShell title="مسابقات عامة" topSlot={<IslamicNavBar />}>
      {welcome && (
        <div style={{ textAlign: "center", color: "#fefce8", marginBottom: 24, fontSize: 16, opacity: 0.95 }}>{welcome}</div>
      )}

      {showOnboarding && (
        <div
          onClick={() => {
            localStorage.setItem(ONBOARDING_KEY, "1");
            setShowOnboarding(false);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#0d6334", borderRadius: 24, padding: 32, maxWidth: 520, border: `2px solid ${ISLAMIC_GOLD}`, boxShadow: `0 0 60px ${ISLAMIC_GOLD}` }}>
            <h2 style={{ color: ISLAMIC_GOLD, fontSize: 26, marginBottom: 16, textAlign: "center" }}>أهلاً بك في مسابقات حصاد!</h2>
            <ul style={{ listStyle: "none", padding: 0, lineHeight: 2.2, fontSize: 17 }}>
              <li>🎮 طريقة اللعب — اختر فئة وأجب قبل انتهاء الوقت.</li>
              <li>⭐ نظام النجوم — أجب أسرع لتحصل على ⭐⭐⭐.</li>
              <li>🔥 سلسلة الأيام — ادخل يومياً للحفاظ على سلسلتك.</li>
              <li>🏆 نظام المستويات — أجب بدون خطأ لفتح مستوى أصعب!</li>
            </ul>
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <GoldButton
                onClick={() => {
                  localStorage.setItem(ONBOARDING_KEY, "1");
                  setShowOnboarding(false);
                }}
              >
                لنبدأ!
              </GoldButton>
            </div>
          </div>
        </div>
      )}

      {progress && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <IslamicCard glow>
            <div style={{ fontSize: 13, opacity: 0.8 }}>إجمالي نقاطك</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: ISLAMIC_GOLD }}>{progress.totalPoints}</div>
          </IslamicCard>
          <IslamicCard>
            <div style={{ fontSize: 13, opacity: 0.8 }}>سلسلة الأيام</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>
              {progress.streak} {progress.streak >= 7 ? "🔥🔥🔥" : progress.streak >= 3 ? "🔥🔥" : progress.streak >= 1 ? "🔥" : ""}
            </div>
          </IslamicCard>
          {access.showCertificates && (
            <IslamicCard>
              <div style={{ fontSize: 13, opacity: 0.8 }}>الشهادات</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{progress.certificates.length} 🏆</div>
            </IslamicCard>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <GoldButton onClick={() => setLocation("/islamic/leaderboard")}>🏆 لوحات المتصدرين</GoldButton>
        <GhostButton onClick={() => setLocation("/islamic/challenge/new")}>⚔️ أنشئ تحدياً</GhostButton>
        <GhostButton onClick={() => setLocation("/islamic/challenge/join")}>🎯 ادخل تحدياً</GhostButton>
        {access.isAdmin || access.hasAccess ? (
          <GhostButton onClick={() => setLocation("/islamic/admin")}>⚙️ لوحة التحكم</GhostButton>
        ) : null}
      </div>

      {sections.length === 0 && (
        <IslamicCard>
          <p style={{ textAlign: "center" }}>لا توجد أقسام بعد. اطلب من المسؤول إضافة الأسئلة.</p>
        </IslamicCard>
      )}

      {sections
        .filter((s) => !/فن|مشاهير|celebrit/i.test(s.name))
        .map((s) => {
          const visibleCategories = s.categories.filter(
            (c) => !/فن|مشاهير|celebrit/i.test(c.name),
          );
          if (visibleCategories.length === 0) return null;
          return (
            <div key={s.id} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: ISLAMIC_GOLD }}>{s.name}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                {visibleCategories.map((c) => {
                  const hasMultipleLevels = c.availableLevels && c.availableLevels.length > 1;
                  const isExpanded = expandedCategory === c.id;

                  return (
                    <IslamicCard
                      key={c.id}
                      onClick={
                        c.questionCount > 0 && !hasMultipleLevels
                          ? () => setLocation(`/islamic/play/${c.id}`)
                          : hasMultipleLevels
                          ? () => setExpandedCategory(isExpanded ? null : c.id)
                          : undefined
                      }
                    >
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{c.name}</div>
                      {c.description && <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>{c.description}</div>}
                      <div style={{ fontSize: 13, color: ISLAMIC_GOLD, marginBottom: 8 }}>
                        {c.questionCount} سؤال
                        {hasMultipleLevels && ` · ${c.availableLevels.length} مستويات`}
                      </div>

                      {hasMultipleLevels ? (
                        <>
                          {/* Level pills summary */}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            {c.availableLevels.map((lv) => {
                              const isUnlocked = lv <= (c.userMaxLevel ?? 1);
                              return (
                                <span
                                  key={lv}
                                  style={{
                                    fontSize: 12,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    background: isUnlocked ? LEVEL_COLORS[lv] : "rgba(255,255,255,0.1)",
                                    color: isUnlocked ? "#fff" : "rgba(255,255,255,0.4)",
                                    border: isUnlocked ? "none" : "1px solid rgba(255,255,255,0.2)",
                                  }}
                                >
                                  {isUnlocked ? LEVEL_ICONS[lv] : "🔒"} {LEVEL_LABELS[lv]}
                                </span>
                              );
                            })}
                          </div>

                          {/* Expanded level buttons */}
                          {isExpanded && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                              {c.availableLevels.map((lv) => {
                                const isUnlocked = lv <= (c.userMaxLevel ?? 1);
                                return (
                                  <button
                                    key={lv}
                                    onClick={() => isUnlocked && setLocation(`/islamic/play/${c.id}?level=${lv}`)}
                                    style={{
                                      padding: "10px 16px",
                                      borderRadius: 12,
                                      border: `2px solid ${isUnlocked ? LEVEL_COLORS[lv] : "rgba(255,255,255,0.15)"}`,
                                      background: isUnlocked
                                        ? `${LEVEL_COLORS[lv]}22`
                                        : "rgba(255,255,255,0.04)",
                                      color: isUnlocked ? "#fff" : "rgba(255,255,255,0.35)",
                                      cursor: isUnlocked ? "pointer" : "not-allowed",
                                      fontFamily: "inherit",
                                      fontSize: 15,
                                      fontWeight: 700,
                                      textAlign: "right",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      transition: "all 0.15s",
                                    }}
                                  >
                                    <span style={{ fontSize: 20 }}>{isUnlocked ? LEVEL_ICONS[lv] : "🔒"}</span>
                                    <span>
                                      {LEVEL_LABELS[lv]}
                                      {lv === 1 && " — أساسي"}
                                      {lv === 2 && " — متقدم"}
                                      {lv === 3 && " — خبراء"}
                                    </span>
                                    {isUnlocked
                                      ? <span style={{ fontSize: 13, color: LEVEL_COLORS[lv] }}>ابدأ ←</span>
                                      : <span style={{ fontSize: 11, opacity: 0.5 }}>أكمل السابق بدون خطأ</span>
                                    }
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {!isExpanded && (
                            <div style={{ fontSize: 12, opacity: 0.6, textAlign: "center" }}>
                              {isExpanded ? "▲ إخفاء" : "▼ اختر المستوى"}
                            </div>
                          )}
                        </>
                      ) : (
                        c.questionCount === 0 && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>لم تُضف أسئلة بعد</div>
                      )}
                    </IslamicCard>
                  );
                })}
              </div>
            </div>
          );
        })}
    </IslamicShell>
  );
}
