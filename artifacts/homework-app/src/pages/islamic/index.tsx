import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/seo";
import { api, IslamicShell, IslamicCard, IslamicNavBar, GoldButton, GhostButton, ISLAMIC_GOLD, ISLAMIC_GOLD_LIGHT } from "./_shared";

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
const LEVEL_ICONS: Record<number, string>  = { 1: "🌱", 2: "🔥", 3: "💎" };
const LEVEL_COLORS: Record<number, string> = { 1: "#16a34a", 2: "#d97706", 3: "#dc2626" };

export default function IslamicHome() {
  useSeo({
    title: "المسابقات الإسلامية | منصة حصاد — قرآن وسيرة وفقه وتاريخ إسلامي",
    description: "خصّص وقتك للتعلم الإسلامي مع منصة حصاد: مسابقات في القرآن الكريم، السيرة النبوية، الفقه، التاريخ الإسلامي، مع شهادات ولوحة متصدرين وتحديات بين الأصدقاء.",
    canonicalPath: "/islamic",
    ogImage: "/opengraph.jpg",
  });
  const [, setLocation] = useLocation();
  const [access, setAccess] = useState<{ hasAccess: boolean; isAdmin: boolean; showCertificates?: boolean } | null>(null);
  const [sections, setSections]   = useState<Section[]>([]);
  const [progress, setProgress]   = useState<Progress | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [welcome, setWelcome]     = useState<string>("");
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
      if (p.streak === 6)       msgs.push("تبقى لك يوم واحد لمكافأة 7 أيام! 🔥");
      else if (p.streak >= 3)   msgs.push(`أنت في سلسلة ${p.streak} أيام! استمر 🔥`);
      else if (p.streak === 0)  msgs.push("اقتربت تخسر سلسلتك 🔥 — ابدأ اليوم!");
      else                      msgs.push("جاهز تكسر رقمك السابق؟");
      if (p.todayBonus) msgs.push(`+${p.todayBonus} نقاط لدخولك اليومي 🎉`);
      setWelcome(msgs.join("  ·  "));
    }).catch(() => {});
  }, [access?.hasAccess]);

  if (access === null) {
    return (
      <IslamicShell topSlot={<IslamicNavBar />}>
        <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>جاري التحميل…</div>
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

      {/* ── Onboarding overlay (dark overlay stays intentionally dark) ── */}
      {showOnboarding && (
        <div
          onClick={() => { localStorage.setItem(ONBOARDING_KEY, "1"); setShowOnboarding(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fffbf0",
              borderRadius: 24, padding: "32px 36px", maxWidth: 500, width: "100%",
              border: "2px solid rgba(180,83,9,0.4)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ color: "#92400e", fontSize: 24, marginBottom: 20, textAlign: "center", fontWeight: 900 }}>
              أهلاً بك في مسابقات حصاد!
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {[
                ["🎮", "اختر فئة وأجب قبل انتهاء الوقت"],
                ["⭐", "أجب أسرع لتحصل على ⭐⭐⭐"],
                ["🔥", "ادخل يومياً للحفاظ على سلسلتك"],
                ["🏆", "أجب بدون خطأ لفتح مستوى أصعب"],
              ].map(([icon, text]) => (
                <div key={text} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "10px 14px",
                  background: "rgba(180,83,9,0.07)",
                  borderRadius: 12,
                  border: "1px solid rgba(180,83,9,0.15)",
                  color: "#1c1208",
                }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center" }}>
              <GoldButton onClick={() => { localStorage.setItem(ONBOARDING_KEY, "1"); setShowOnboarding(false); }}>
                لنبدأ! 🚀
              </GoldButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Welcome banner ── */}
      {welcome && (
        <div style={{
          textAlign: "center",
          padding: "10px 20px",
          marginBottom: 20,
          background: "rgba(180,83,9,0.07)",
          border: "1px solid rgba(180,83,9,0.2)",
          borderRadius: 12,
          color: "#92400e",
          fontSize: 14,
          fontWeight: 600,
        }}>
          {welcome}
        </div>
      )}

      {/* ── Stats bar ── */}
      {progress && (
        <div style={{
          display: "flex",
          marginBottom: 24,
          background: "rgba(255,255,255,0.75)",
          border: "1px solid rgba(180,83,9,0.18)",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div style={{ flex: 1, padding: "18px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#78716c", marginBottom: 5, letterSpacing: "0.04em" }}>إجمالي نقاطك</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: ISLAMIC_GOLD, lineHeight: 1 }}>
              {progress.totalPoints.toLocaleString()}
            </div>
          </div>
          <div style={{ width: 1, background: "rgba(180,83,9,0.15)" }} />
          <div style={{ flex: 1, padding: "18px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#78716c", marginBottom: 5, letterSpacing: "0.04em" }}>سلسلة الأيام</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#1c1208", lineHeight: 1 }}>
              {progress.streak}
              <span style={{ fontSize: 20, marginRight: 4 }}>
                {progress.streak >= 7 ? "🔥🔥🔥" : progress.streak >= 3 ? "🔥🔥" : progress.streak >= 1 ? "🔥" : ""}
              </span>
            </div>
          </div>
          {access.showCertificates && progress.certificates.length > 0 && (
            <>
              <div style={{ width: 1, background: "rgba(180,83,9,0.15)" }} />
              <div style={{ flex: 1, padding: "18px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#78716c", marginBottom: 5 }}>الشهادات</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#1c1208", lineHeight: 1 }}>
                  {progress.certificates.length} 🏆
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Action buttons — 2×2 grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 36 }}>
        <GoldButton
          onClick={() => setLocation("/islamic/leaderboard")}
          style={{ borderRadius: 16, padding: "14px 12px", fontSize: 15, width: "100%", justifyContent: "center" }}
        >
          🏆 لوحات المتصدرين
        </GoldButton>
        <GhostButton
          onClick={() => setLocation("/islamic/challenge/new")}
          style={{ borderRadius: 16, padding: "14px 12px", fontSize: 15, width: "100%", textAlign: "center" }}
        >
          ⚔️ أنشئ تحدياً
        </GhostButton>
        <GhostButton
          onClick={() => setLocation("/islamic/challenge/join")}
          style={{ borderRadius: 16, padding: "14px 12px", fontSize: 15, width: "100%", textAlign: "center" }}
        >
          🎯 ادخل تحدياً
        </GhostButton>
        {(access.isAdmin || access.hasAccess) && (
          <GhostButton
            onClick={() => setLocation("/islamic/admin")}
            style={{ borderRadius: 16, padding: "14px 12px", fontSize: 15, width: "100%", textAlign: "center" }}
          >
            ⚙️ لوحة التحكم
          </GhostButton>
        )}
      </div>

      {/* ── Sections ── */}
      {sections.length === 0 && (
        <IslamicCard>
          <p style={{ textAlign: "center", opacity: 0.65 }}>لا توجد أقسام بعد. اطلب من المسؤول إضافة الأسئلة.</p>
        </IslamicCard>
      )}

      {sections
        .filter((s) => !/فن|مشاهير|celebrit/i.test(s.name))
        .map((s) => {
          const visibleCategories = s.categories.filter((c) => !/فن|مشاهير|celebrit/i.test(c.name));
          if (visibleCategories.length === 0) return null;
          return (
            <div key={s.id} style={{ marginBottom: 40 }}>

              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(180,83,9,0.5), transparent)" }} />
                <h2 style={{
                  fontSize: 17, fontWeight: 800, margin: 0,
                  color: ISLAMIC_GOLD_LIGHT,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                }}>
                  {s.name}
                </h2>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, rgba(180,83,9,0.5), transparent)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {visibleCategories.map((c) => {
                  const hasMultipleLevels = c.availableLevels?.length > 1;
                  const isExpanded = expandedCategory === c.id;
                  const canPlay = c.questionCount > 0;

                  return (
                    <IslamicCard
                      key={c.id}
                      onClick={
                        canPlay && !hasMultipleLevels
                          ? () => setLocation(`/islamic/play/${c.id}`)
                          : hasMultipleLevels
                          ? () => setExpandedCategory(isExpanded ? null : c.id)
                          : undefined
                      }
                    >
                      {/* Title */}
                      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3, marginBottom: c.description ? 6 : 12, color: "#1c1208" }}>
                        {c.name}
                      </div>

                      {/* Description */}
                      {c.description && (
                        <div style={{ fontSize: 12, color: "#78716c", lineHeight: 1.6, marginBottom: 12 }}>
                          {c.description}
                        </div>
                      )}

                      {/* Footer: question count + action */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasMultipleLevels ? 12 : 0 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          padding: "3px 10px", borderRadius: 8,
                          background: "rgba(180,83,9,0.1)",
                          border: "1px solid rgba(180,83,9,0.2)",
                          color: ISLAMIC_GOLD,
                        }}>
                          {c.questionCount} سؤال
                        </span>
                        {!hasMultipleLevels && canPlay && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: ISLAMIC_GOLD }}>ابدأ ←</span>
                        )}
                        {hasMultipleLevels && (
                          <span style={{ fontSize: 11, color: "#a8a29e" }}>{c.availableLevels.length} مستويات</span>
                        )}
                      </div>

                      {/* Multi-level */}
                      {hasMultipleLevels && (
                        <>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            {c.availableLevels.map((lv) => {
                              const isUnlocked = lv <= (c.userMaxLevel ?? 1);
                              return (
                                <span key={lv} style={{
                                  fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 700,
                                  background: isUnlocked ? LEVEL_COLORS[lv] : "rgba(0,0,0,0.06)",
                                  color: isUnlocked ? "#fff" : "#a8a29e",
                                  border: isUnlocked ? "none" : "1px solid rgba(0,0,0,0.1)",
                                }}>
                                  {isUnlocked ? LEVEL_ICONS[lv] : "🔒"} {LEVEL_LABELS[lv]}
                                </span>
                              );
                            })}
                          </div>

                          {isExpanded && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}
                              onClick={(e) => e.stopPropagation()}>
                              {c.availableLevels.map((lv) => {
                                const isUnlocked = lv <= (c.userMaxLevel ?? 1);
                                return (
                                  <button key={lv}
                                    onClick={() => isUnlocked && setLocation(`/islamic/play/${c.id}?level=${lv}`)}
                                    style={{
                                      padding: "11px 14px", borderRadius: 12,
                                      border: `2px solid ${isUnlocked ? LEVEL_COLORS[lv] : "rgba(0,0,0,0.1)"}`,
                                      background: isUnlocked ? `${LEVEL_COLORS[lv]}18` : "rgba(0,0,0,0.03)",
                                      color: isUnlocked ? "#1c1208" : "#a8a29e",
                                      cursor: isUnlocked ? "pointer" : "not-allowed",
                                      fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                                      textAlign: "right", direction: "rtl",
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      transition: "all 0.15s",
                                    }}>
                                    <span style={{ fontSize: 18 }}>{isUnlocked ? LEVEL_ICONS[lv] : "🔒"}</span>
                                    <span>
                                      {LEVEL_LABELS[lv]}
                                      {lv === 1 && " — أساسي"}
                                      {lv === 2 && " — متقدم"}
                                      {lv === 3 && " — خبراء"}
                                    </span>
                                    {isUnlocked
                                      ? <span style={{ fontSize: 12, color: LEVEL_COLORS[lv], fontWeight: 800 }}>ابدأ ←</span>
                                      : <span style={{ fontSize: 11, color: "#a8a29e" }}>أكمل السابق</span>
                                    }
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {!isExpanded && (
                            <div style={{ fontSize: 12, color: "#a8a29e", textAlign: "center", marginTop: 4 }}>
                              اضغط لاختيار المستوى ↓
                            </div>
                          )}
                        </>
                      )}

                      {!canPlay && (
                        <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 8 }}>لم تُضف أسئلة بعد</div>
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
