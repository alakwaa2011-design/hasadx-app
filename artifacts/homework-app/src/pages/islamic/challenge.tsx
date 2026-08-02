import html2canvas from "html2canvas";
import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  api, IslamicShell, IslamicCard, GoldButton, GhostButton, BackLink,
  ISLAMIC_GOLD, playCorrect, playWrong,
} from "./_shared";
import AudioPlayer from "@/components/AudioPlayer";

interface Section {
  id: number; name: string; ownerId?: number | null;
  categories: Array<{ id: number; name: string; questionCount: number; hardCount?: number; ownerId?: number | null }>;
}

const EXPERTS_MIN_HARD = 5;
interface Q { id: number; questionText: string; audioUrl: string | null; options: string[]; correctAnswer: string }
interface Challenge {
  id: number; pin: string; categoryId: number; creatorId: number;
  opponentId: number | null; status: string; creatorScore: number; opponentScore: number;
  creatorTimeMs: number; opponentTimeMs: number; creatorCorrect: number; opponentCorrect: number;
  winnerId: number | null; startedAt: string | null;
}
interface Tournament {
  id: number; pin: string; name: string; categoryId: number;
  teamNames: string[]; teamScores: Record<string, { score: number; correct: number; timeMs: number; status: string }>;
  status: string;
  questions: Q[];
  teamLinks?: Record<string, string>;
}

const TIMER_SECONDS = 20;
/** Seconds after server-set startedAt before either player sees Q1.
 *  Gives creator's 2s poll time to fire, so both start within <200ms of each other. */
const SYNC_DELAY_MS = 4000;

/* ── Shared category picker ──────────────────────────────────── */
function CategoryPicker({ onPick, title, expertsOnly }: { onPick: (id: number) => void; title: string; expertsOnly?: boolean }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [myName, setMyName] = useState("");
  const [myDesc, setMyDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { api<Section[]>("/islamic/sections").then(setSections); }, [refresh]);

  async function createMyCat() {
    if (!myName.trim()) return;
    setCreating(true);
    try {
      await api("/islamic/my-categories", { method: "POST", body: JSON.stringify({ name: myName.trim(), description: myDesc.trim() }) });
      setMyName(""); setMyDesc(""); setRefresh((r) => r + 1);
    } finally { setCreating(false); }
  }

  const allCats = sections.flatMap((s) => s.categories.map((c) => ({ ...c, sectionName: s.name, sectionOwned: !!s.ownerId })));

  return (
    <>
      <p style={{ textAlign: "center", marginBottom: 16, opacity: 0.9, fontSize: "clamp(13px, 3.5vw, 15px)" }}>{title}</p>

      {sections.map((s) => (
        <div key={s.id} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <h3 style={{ fontSize: "clamp(14px, 4vw, 17px)", color: ISLAMIC_GOLD, margin: 0 }}>
              {s.name}
              {s.ownerId && <span style={{ fontSize: 11, color: "#86efac", marginRight: 6 }}>🔒 خاصة</span>}
            </h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 155px), 1fr))", gap: 8 }}>
            {s.categories
              .filter((c) => c.questionCount > 0)
              .map((c) => {
                const hard = c.hardCount || 0;
                const eligible = !expertsOnly || hard >= EXPERTS_MIN_HARD;
                return (
                  <IslamicCard
                    key={c.id}
                    onClick={eligible ? () => onPick(c.id) : undefined}
                    style={!eligible ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                  >
                    <div style={{ fontWeight: 700, fontSize: "clamp(13px, 3.5vw, 15px)" }}>{c.name}</div>
                    <div style={{ fontSize: "clamp(11px, 3vw, 13px)", opacity: 0.8 }}>
                      {expertsOnly ? `${hard} سؤال صعب` : `${c.questionCount} سؤال`}
                    </div>
                    {expertsOnly && !eligible && (
                      <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>
                        تحتاج {EXPERTS_MIN_HARD} أسئلة صعبة على الأقل
                      </div>
                    )}
                  </IslamicCard>
                );
              })}
          </div>
        </div>
      ))}

      {/* Add personal category */}
      <IslamicCard style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, color: ISLAMIC_GOLD, marginBottom: 10, fontSize: 15 }}>➕ أنشئ فئة خاصة بك</div>
        <input
          value={myName} onChange={(e) => setMyName(e.target.value)}
          placeholder="اسم الفئة (مثال: أسئلة مادتي)"
          style={{ display: "block", width: "100%", background: "rgba(0,0,0,0.3)", color: "#fefce8", border: `1px solid ${ISLAMIC_GOLD}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
        />
        <input
          value={myDesc} onChange={(e) => setMyDesc(e.target.value)}
          placeholder="وصف اختياري"
          style={{ display: "block", width: "100%", background: "rgba(0,0,0,0.3)", color: "#fefce8", border: `1px solid ${ISLAMIC_GOLD}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
        />
        <GhostButton onClick={createMyCat} disabled={!myName.trim() || creating}>{creating ? "جاري الإنشاء…" : "إنشاء الفئة"}</GhostButton>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8, marginBottom: 0 }}>بعد الإنشاء، اطلب من الأدمن إضافة الأسئلة لفئتك.</p>
      </IslamicCard>
    </>
  );
}

/* ── 1. Create new challenge ─────────────────────────────────── */
export function IslamicChallengeNew() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"choose" | "challenge" | "tournament">("choose");
  const [created, setCreated] = useState<Challenge | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tourName, setTourName] = useState("");
  const [teams, setTeams] = useState<string[]>(["الفريق الأول", "الفريق الثاني"]);
  const [creating, setCreating] = useState(false);
  const [tourStep, setTourStep] = useState<"setup" | "category">("setup");
  const [expertsOnly, setExpertsOnly] = useState(false);
  const [createErr, setCreateErr] = useState("");

  async function createChallenge(categoryId: number) {
    setCreateErr("");
    try {
      const c = await api<Challenge>("/islamic/challenges", { method: "POST", body: JSON.stringify({ categoryId, expertsOnly }) });
      setCreated(c);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "تعذر إنشاء التحدي");
    }
  }

  async function createTournament(categoryId: number) {
    if (!tourName.trim()) return;
    const cleanTeams = teams.filter((t) => t.trim());
    if (cleanTeams.length < 2) return;
    setCreating(true);
    setCreateErr("");
    try {
      const t = await api<Tournament>("/islamic/tournaments", {
        method: "POST",
        body: JSON.stringify({ name: tourName.trim(), categoryId, teamNames: cleanTeams, expertsOnly }),
      });
      setTournament(t);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "تعذر إنشاء البطولة");
    } finally { setCreating(false); }
  }

  function ExpertsToggle() {
    return (
      <IslamicCard style={{ marginBottom: 14, background: expertsOnly ? "rgba(217,119,6,0.18)" : undefined, borderColor: expertsOnly ? ISLAMIC_GOLD : undefined }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={expertsOnly}
            onChange={(e) => setExpertsOnly(e.target.checked)}
            style={{ marginTop: 4, width: 18, height: 18, accentColor: ISLAMIC_GOLD, cursor: "pointer" }}
          />
          <div>
            <div style={{ fontWeight: 800, color: ISLAMIC_GOLD, fontSize: 15 }}>🔥 وضع تحدّي الخبراء</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, lineHeight: 1.6 }}>
              عند التفعيل، يتم اختيار الأسئلة الصعبة فقط. يتطلب {EXPERTS_MIN_HARD} أسئلة صعبة على الأقل في الفئة.
            </div>
          </div>
        </label>
      </IslamicCard>
    );
  }

  function CreateError() {
    if (!createErr) return null;
    return (
      <IslamicCard style={{ marginBottom: 12, borderColor: "#ef4444", background: "rgba(239,68,68,0.12)" }}>
        <div style={{ color: "#fca5a5", fontWeight: 700, fontSize: 13 }}>{createErr}</div>
      </IslamicCard>
    );
  }

  /* ── Challenge created ──────────────────────────────────────── */
  if (created) {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}islamic/challenge/play/${created.pin}`;
    return (
      <IslamicShell title="تحدي جديد">
        <BackLink />
        <IslamicCard glow>
          <p style={{ textAlign: "center", fontSize: "clamp(15px, 4vw, 17px)" }}>أرسل هذا الرابط أو الرمز لخصمك:</p>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div style={{ fontSize: "clamp(28px, 9vw, 40px)", fontWeight: 900, color: ISLAMIC_GOLD, letterSpacing: 4 }}>{created.pin}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, wordBreak: "break-all", padding: "0 4px" }}>{url}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 16 }}>
            <GoldButton onClick={() => navigator.clipboard?.writeText(url)}>نسخ الرابط</GoldButton>
            <GoldButton onClick={() => setLocation(`/islamic/challenge/play/${created.pin}?role=creator`)}>ابدأ جولتك</GoldButton>
            <GhostButton onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`تحدي حصاد: ${url}`)}`)}>واتساب</GhostButton>
          </div>
        </IslamicCard>
      </IslamicShell>
    );
  }

  /* ── Tournament created ─────────────────────────────────────── */
  if (tournament) {
    const base = `${window.location.origin}${import.meta.env.BASE_URL}islamic/tournament/play/${tournament.pin}`;
    return (
      <IslamicShell title={`بطولة: ${tournament.name}`}>
        <BackLink />
        <IslamicCard glow style={{ marginBottom: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>رمز البطولة</div>
            <div style={{ fontSize: "clamp(30px, 9vw, 44px)", fontWeight: 900, color: ISLAMIC_GOLD, letterSpacing: 4 }}>{tournament.pin}</div>
          </div>
        </IslamicCard>
        <p style={{ color: ISLAMIC_GOLD, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>روابط الفرق — شارك كل رابط مع فريقه:</p>
        {tournament.teamNames.map((team) => {
          const token = (tournament.teamLinks || {})[team] || "";
          const link = `${base}?team=${encodeURIComponent(team)}&token=${token}`;
          return (
            <IslamicCard key={team} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15 }}>🏅 {team}</div>
              <div style={{ fontSize: 11, opacity: 0.75, wordBreak: "break-all", marginBottom: 8 }}>{link}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <GhostButton onClick={() => navigator.clipboard?.writeText(link)}>نسخ</GhostButton>
                <GhostButton onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`رابط ${team}: ${link}`)}`)}>واتساب</GhostButton>
              </div>
            </IslamicCard>
          );
        })}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <GoldButton onClick={() => setLocation(`/islamic/tournament/host/${tournament.pin}`)}>🏆 لوحة المتابعة</GoldButton>
        </div>
      </IslamicShell>
    );
  }

  /* ── Mode choose ────────────────────────────────────────────── */
  if (mode === "choose") {
    return (
      <IslamicShell title="تحدي حصاد">
        <BackLink />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
          <IslamicCard glow onClick={() => setMode("challenge")} style={{ textAlign: "center", padding: "24px 12px" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚔️</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: ISLAMIC_GOLD }}>تحدي 1 ضد 1</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>أرسل رابطاً لخصمك</div>
          </IslamicCard>
          <IslamicCard glow onClick={() => setMode("tournament")} style={{ textAlign: "center", padding: "24px 12px" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: ISLAMIC_GOLD }}>بطولة فرق</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>فرق متعددة — لوحة نتائج</div>
          </IslamicCard>
        </div>
      </IslamicShell>
    );
  }

  /* ── Tournament setup ───────────────────────────────────────── */
  if (mode === "tournament") {
    if (tourStep === "category") {
      return (
        <IslamicShell title="اختر فئة البطولة">
          <GhostButton onClick={() => setTourStep("setup")} style={{ marginBottom: 16 }}>← رجوع</GhostButton>
          <CreateError />
          <ExpertsToggle />
          <CategoryPicker title="اختر الفئة التي ستلعب بها جميع الفرق:" onPick={createTournament} expertsOnly={expertsOnly} />
          {creating && <p style={{ textAlign: "center", color: ISLAMIC_GOLD }}>جاري إنشاء البطولة…</p>}
        </IslamicShell>
      );
    }

    return (
      <IslamicShell title="إعداد البطولة">
        <GhostButton onClick={() => setMode("choose")} style={{ marginBottom: 16 }}>← رجوع</GhostButton>
        <IslamicCard style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: ISLAMIC_GOLD, marginBottom: 10 }}>اسم البطولة</div>
          <input
            value={tourName} onChange={(e) => setTourName(e.target.value)}
            placeholder="مثال: بطولة الفصل السادس"
            style={{ display: "block", width: "100%", background: "rgba(0,0,0,0.3)", color: "#fefce8", border: `1px solid ${ISLAMIC_GOLD}55`, borderRadius: 8, padding: "10px 12px", fontFamily: "inherit", fontSize: 15, boxSizing: "border-box" }}
          />
        </IslamicCard>
        <IslamicCard style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: ISLAMIC_GOLD, marginBottom: 10 }}>أسماء الفرق ({teams.length})</div>
          {teams.map((team, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={team} onChange={(e) => setTeams((prev) => prev.map((t, j) => j === i ? e.target.value : t))}
                placeholder={`الفريق ${i + 1}`}
                style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: "#fefce8", border: `1px solid ${ISLAMIC_GOLD}55`, borderRadius: 8, padding: "8px 12px", fontFamily: "inherit", fontSize: 14 }}
              />
              {teams.length > 2 && (
                <button onClick={() => setTeams((prev) => prev.filter((_, j) => j !== i))}
                  style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 18 }}>✕</button>
              )}
            </div>
          ))}
          {teams.length < 16 && (
            <GhostButton onClick={() => setTeams((prev) => [...prev, `الفريق ${prev.length + 1}`])} style={{ marginTop: 4 }}>+ إضافة فريق</GhostButton>
          )}
        </IslamicCard>
        <GoldButton disabled={!tourName.trim() || teams.filter((t) => t.trim()).length < 2} onClick={() => setTourStep("category")}>
          التالي: اختر الفئة ←
        </GoldButton>
      </IslamicShell>
    );
  }

  /* ── Regular challenge category picker ─────────────────────── */
  return (
    <IslamicShell title="أنشئ تحدياً">
      <GhostButton onClick={() => setMode("choose")} style={{ marginBottom: 16 }}>← رجوع</GhostButton>
      <CreateError />
      <ExpertsToggle />
      <CategoryPicker
        title={expertsOnly ? "اختر فئة (الأسئلة الصعبة فقط):" : "اختر فئة لتنشئ تحدياً مع 10 أسئلة عشوائية:"}
        onPick={createChallenge}
        expertsOnly={expertsOnly}
      />
    </IslamicShell>
  );
}

/* ── 2. Join challenge ───────────────────────────────────────── */
export function IslamicChallengeJoin() {
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  function go() {
    if (pin.trim()) setLocation(`/islamic/challenge/play/${pin.trim()}`);
    else setErr("أدخل الرمز");
  }
  return (
    <IslamicShell title="ادخل تحدي">
      <BackLink />
      <IslamicCard>
        <p>أدخل رمز التحدي أو البطولة (PIN):</p>
        <input
          value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && go()}
          style={{ display: "block", width: "100%", background: "rgba(0,0,0,0.3)", color: "#fefce8", border: `1px solid ${ISLAMIC_GOLD}`, borderRadius: 8, padding: 12, fontSize: 22, letterSpacing: 4, textAlign: "center", marginTop: 8, fontFamily: "inherit" }}
        />
        {err && <p style={{ color: "#fca5a5", marginTop: 6 }}>{err}</p>}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <GoldButton onClick={() => {
            const p = pin.trim();
            if (!p) { setErr("أدخل الرمز"); return; }
            if (p.startsWith("T")) setLocation(`/islamic/tournament/play/${p}`);
            else setLocation(`/islamic/challenge/play/${p}`);
          }}>دخول</GoldButton>
        </div>
      </IslamicCard>
    </IslamicShell>
  );
}

/* ── Shareable result card ───────────────────────────────────── */
function ShareResultCard({
  headline,
  subline,
  score,
  correct,
  total,
  outcome,
}: {
  headline: string;
  subline?: string;
  score: number;
  correct: number;
  total: number;
  outcome: "win" | "lose" | "draw" | "done";
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const outcomeEmoji = outcome === "win" ? "🏆" : outcome === "draw" ? "🤝" : outcome === "done" ? "✅" : "😤";
  const outcomeLabel = outcome === "win" ? "فزت!" : outcome === "draw" ? "تعادل!" : outcome === "done" ? "أكملت التحدي" : "أحسنت المحاولة";

  async function downloadImage() {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `hasadx-result-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      /* silently ignore capture errors */
    } finally {
      setDownloading(false);
    }
  }

  async function share() {
    const text =
      `${outcomeEmoji} ${outcomeLabel}\n` +
      `👤 ${headline}\n` +
      (subline ? `📚 ${subline}\n` : "") +
      `🏅 النقاط: ${score}\n` +
      `✔️ الإجابات الصحيحة: ${correct}/${total}\n` +
      `\nحصادX · منصة التعلم التفاعلية`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "نتيجتي في حصادX", text });
        return;
      } catch {
        /* user cancelled or share not supported — fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked */
    }
  }

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div
      ref={cardRef}
      style={{
        background: "linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)",
        border: `2px solid ${ISLAMIC_GOLD}`,
        borderRadius: 20,
        padding: "28px 24px 20px",
        textAlign: "center",
        boxShadow: `0 0 40px rgba(251,191,36,0.25), 0 8px 32px rgba(0,0,0,0.4)`,
        position: "relative",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {/* decorative corner stars */}
      {["topleft","topright","bottomleft","bottomright"].map((pos) => (
        <div key={pos} style={{
          position: "absolute",
          top: pos.startsWith("top") ? 8 : undefined,
          bottom: pos.startsWith("bottom") ? 8 : undefined,
          left: pos.endsWith("left") ? 8 : undefined,
          right: pos.endsWith("right") ? 8 : undefined,
          color: ISLAMIC_GOLD, fontSize: 14, opacity: 0.5,
        }}>✦</div>
      ))}

      <div style={{ fontSize: 52, marginBottom: 4 }}>{outcomeEmoji}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: ISLAMIC_GOLD, marginBottom: 2 }}>{outcomeLabel}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#fefce8", marginBottom: subline ? 2 : 12 }}>{headline}</div>
      {subline && <div style={{ fontSize: 13, color: "#fde68a", opacity: 0.9, marginBottom: 12 }}>{subline}</div>}

      {/* score + accuracy row */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 16 }}>
        <div style={{
          background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "10px 18px",
          border: "1px solid rgba(251,191,36,0.4)",
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: ISLAMIC_GOLD, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 11, color: "#fde68a", marginTop: 2 }}>نقطة</div>
        </div>
        <div style={{
          background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "10px 18px",
          border: "1px solid rgba(251,191,36,0.4)",
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#86efac", lineHeight: 1 }}>{correct}/{total}</div>
          <div style={{ fontSize: 11, color: "#fde68a", marginTop: 2 }}>إجابة صحيحة</div>
        </div>
      </div>

      {/* accuracy bar */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#fde68a", marginBottom: 4 }}>
          <span>الدقة</span><span>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)" }}>
          <div style={{
            height: "100%", borderRadius: 4,
            width: `${pct}%`,
            background: pct >= 70 ? ISLAMIC_GOLD : pct >= 40 ? "#fb923c" : "#ef4444",
            transition: "width 1s ease",
          }} />
        </div>
      </div>

      {/* branding — visible in downloaded image */}
      <div style={{ fontSize: 11, color: "#fde68a", opacity: 0.55, marginBottom: 14, letterSpacing: 1 }}>
        حصادX · منصة التعلم التفاعلية
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={share}
          style={{
            background: copied ? "#16a34a" : ISLAMIC_GOLD,
            color: copied ? "#fff" : "#1f2937",
            border: "none", borderRadius: 10,
            padding: "10px 22px", fontSize: 15, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: copied ? "0 0 16px #16a34a" : `0 0 16px ${ISLAMIC_GOLD}55`,
            transition: "all 0.3s",
          }}
        >
          {copied ? "✓ تم النسخ!" : "📤 شارك النتيجة"}
        </button>
        <button
          onClick={downloadImage}
          disabled={downloading}
          style={{
            background: downloading ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.15)",
            color: ISLAMIC_GOLD,
            border: `1.5px solid ${ISLAMIC_GOLD}`,
            borderRadius: 10,
            padding: "10px 22px", fontSize: 15, fontWeight: 800,
            cursor: downloading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.3s",
            opacity: downloading ? 0.7 : 1,
          }}
        >
          {downloading ? "⏳ جاري الحفظ…" : "🖼️ حفظ كصورة"}
        </button>
      </div>
    </div>
  );
}

/* ── 3. Play challenge (1v1) with auto-start 20s timer ──────── */
export function IslamicChallengePlay() {
  const [, params] = useRoute("/islamic/challenge/play/:pin");
  const [, setLocation] = useLocation();
  const pin = params?.pin || "";
  const role = (new URLSearchParams(window.location.search).get("role") || "opponent") as "creator" | "opponent";

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [opName, setOpName] = useState("");
  const [nameReady, setNameReady] = useState(role === "creator");
  const [loadError, setLoadError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const [waitingForOpponent, setWaitingForOpponent] = useState(role === "creator");
  const [joiningErr, setJoiningErr] = useState("");
  const [joining, setJoining] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalStartRef = useRef(Date.now());
  const questionStartRef = useRef(Date.now());
  const audioListensRef = useRef<number>(0);

  useEffect(() => {
    api<{ challenge: Challenge; questions: Q[] }>(`/islamic/challenges/by-pin/${pin}`)
      .then((r) => {
        setChallenge(r.challenge);
        setQuestions(r.questions);
        /* If the opponent already joined before creator opened the page, start countdown */
        if (role === "creator" && (r.challenge.status === "active" || r.challenge.status === "completed")) {
          setWaitingForOpponent(false);
          startSyncCountdown(r.challenge.startedAt);
        }
      })
      .catch((e: Error) => setLoadError(e.message || "التحدي غير موجود"));
  }, [pin]);

  /* Creator polls every 2 s until the opponent joins (status → "active") */
  useEffect(() => {
    if (role !== "creator" || !waitingForOpponent || !challenge) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await api<{ challenge: Challenge; questions: Q[] }>(`/islamic/challenges/by-pin/${pin}`);
        if (r.challenge.status === "active" || r.challenge.status === "completed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setChallenge(r.challenge);
          setWaitingForOpponent(false);
          startSyncCountdown(r.challenge.startedAt);
        }
      } catch { /* ignore transient errors */ }
    }, 2000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [role, waitingForOpponent, challenge?.id]);

  /* Cleanup countdown interval on unmount */
  useEffect(() => {
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, []);

  /* Auto-start timer whenever question changes, data is loaded, countdown done, and both sides are ready */
  useEffect(() => {
    if (!questions.length || revealed || done || !nameReady || waitingForOpponent || countdownSec !== null) return;
    audioListensRef.current = 0;
    setSecondsLeft(TIMER_SECONDS);
    questionStartRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          autoAnswer();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [idx, questions.length, done, nameReady, waitingForOpponent, countdownSec]);

  /** Starts a synchronized countdown for both players.
   *  Both derive the target from the server's startedAt + SYNC_DELAY_MS,
   *  so they unlock Q1 at the same wall-clock moment regardless of poll lag. */
  function startSyncCountdown(startedAtStr: string | null) {
    const targetStart = startedAtStr
      ? new Date(startedAtStr).getTime() + SYNC_DELAY_MS
      : Date.now() + 3000;
    totalStartRef.current = targetStart;
    const remaining = targetStart - Date.now();
    if (remaining <= 200) return; // Already at or past target — start immediately
    setCountdownSec(Math.ceil(remaining / 1000));
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      const left = targetStart - Date.now();
      if (left <= 200) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdownSec(null);
      } else {
        setCountdownSec(Math.ceil(left / 1000));
      }
    }, 100);
  }

  function autoAnswer() {
    setSelected(null);
    setRevealed(true);
    playWrong();
  }

  function handleAudioListen() {
    audioListensRef.current++;
  }

  function answer(opt: string) {
    if (revealed || !questions[idx]) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const q = questions[idx];
    const isC = opt === q.correctAnswer;
    setSelected(opt);
    setRevealed(true);
    if (isC) {
      const elapsed = (Date.now() - questionStartRef.current) / 1000;
      const pts = elapsed < 5 ? 10 : 5;
      setScore((s) => s + pts);
      setCorrect((c) => c + 1);
      playCorrect();
    } else {
      playWrong();
    }
  }

  async function next() {
    if (idx + 1 >= questions.length) {
      const totalMs = Date.now() - totalStartRef.current;
      await api<Challenge>(`/islamic/challenges/${challenge?.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ score, timeMs: totalMs, correct, role, opponentName: role === "opponent" ? opName : undefined }),
      });
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  async function joinAndStart() {
    if (!opName.trim() || !challenge) return;
    setJoiningErr("");
    setJoining(true);
    try {
      const joined = await api<Challenge>(`/islamic/challenges/${challenge.id}/join`, {
        method: "POST",
        body: JSON.stringify({ opponentName: opName.trim() }),
      });
      setChallenge(joined);
      setNameReady(true);
      startSyncCountdown(joined.startedAt);
    } catch (e) {
      setJoiningErr(e instanceof Error ? e.message : "تعذر الانضمام للتحدي");
    } finally {
      setJoining(false);
    }
  }

  if (loadError) {
    return (
      <IslamicShell title="تحدي حصاد">
        <IslamicCard>
          <p style={{ textAlign: "center", color: "#fca5a5", fontSize: 18, marginBottom: 16 }}>❌ {loadError}</p>
          <div style={{ textAlign: "center" }}>
            <GhostButton onClick={() => window.history.back()}>رجوع</GhostButton>
          </div>
        </IslamicCard>
      </IslamicShell>
    );
  }

  if (!challenge || questions.length === 0) {
    return <IslamicShell><IslamicCard><p style={{ textAlign: "center" }}>جاري التحميل…</p></IslamicCard></IslamicShell>;
  }

  /* Creator waiting for opponent to join */
  if (role === "creator" && waitingForOpponent) {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}islamic/challenge/play/${pin}`;
    return (
      <IslamicShell title="تحدي حصاد">
        <IslamicCard glow>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }}>⚔️</div>
            <div style={{ fontSize: "clamp(17px, 5vw, 22px)", fontWeight: 800, color: ISLAMIC_GOLD, marginBottom: 8 }}>
              في انتظار الخصم…
            </div>
            <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 20, lineHeight: 1.7 }}>
              شارك الرابط أو الرمز مع خصمك، وسيبدأ التحدي تلقائياً عند انضمامه
            </div>
            <div style={{ fontSize: "clamp(28px, 9vw, 40px)", fontWeight: 900, color: ISLAMIC_GOLD, letterSpacing: 4, marginBottom: 12 }}>
              {pin}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <GoldButton onClick={() => navigator.clipboard?.writeText(url)}>نسخ الرابط</GoldButton>
              <GhostButton onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`تحدي حصاد: ${url}`)}`)}> واتساب</GhostButton>
            </div>
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0.7, fontSize: 13 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: ISLAMIC_GOLD, animation: "pulse 1s ease-in-out infinite" }} />
              يتم التحقق تلقائياً…
            </div>
          </div>
        </IslamicCard>
      </IslamicShell>
    );
  }

  /* Synchronized countdown — shown to both players between "join" and Q1 */
  if (nameReady && !waitingForOpponent && countdownSec !== null) {
    return (
      <IslamicShell title="تحدي حصاد">
        <IslamicCard glow>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 14, color: ISLAMIC_GOLD, opacity: 0.9, marginBottom: 16, letterSpacing: 1 }}>
              يبدأ التحدي بعد…
            </div>
            <div style={{
              fontSize: "clamp(72px, 20vw, 100px)", fontWeight: 900, color: ISLAMIC_GOLD,
              lineHeight: 1, textShadow: `0 0 40px ${ISLAMIC_GOLD}88`,
              animation: "pulse 0.9s ease-in-out infinite",
            }}>
              {countdownSec}
            </div>
            <div style={{ fontSize: 16, marginTop: 16, opacity: 0.7 }}>⚔️ استعد!</div>
          </div>
        </IslamicCard>
      </IslamicShell>
    );
  }

  /* Opponent must enter their name before the game starts */
  if (role === "opponent" && !nameReady) {
    return (
      <IslamicShell title="تحدي حصاد">
        <IslamicCard glow>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚔️</div>
            <div style={{ fontSize: "clamp(16px, 5vw, 20px)", fontWeight: 800, color: ISLAMIC_GOLD, marginBottom: 4 }}>
              أنت مدعو لتحدي!
            </div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>أدخل اسمك ليظهر للخصم</div>
          </div>
          <input
            value={opName}
            onChange={(e) => setOpName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && opName.trim() && !joining) joinAndStart(); }}
            placeholder="اسمك…"
            style={{
              display: "block", width: "100%", background: "rgba(0,0,0,0.3)", color: "#fefce8",
              border: `1px solid ${ISLAMIC_GOLD}`, borderRadius: 8, padding: "12px 14px",
              marginBottom: 14, fontFamily: "inherit", fontSize: 18, textAlign: "center", boxSizing: "border-box",
            }}
          />
          {joiningErr && <p style={{ color: "#fca5a5", fontSize: 13, marginBottom: 10, textAlign: "center" }}>{joiningErr}</p>}
          <GoldButton
            disabled={!opName.trim() || joining}
            onClick={joinAndStart}
          >
            {joining ? "جاري الانضمام…" : "ابدأ التحدي ⚔️"}
          </GoldButton>
        </IslamicCard>
      </IslamicShell>
    );
  }

  if (done) {
    const isCreator = role === "creator";
    const oppScore = isCreator ? challenge.opponentScore : challenge.creatorScore;
    const oppDone = isCreator ? challenge.status === "completed" : true;
    const myName = role === "creator" ? "أنت (المنشئ)" : opName || "أنت";
    const outcome = !oppDone ? "done" : score > oppScore ? "win" : score < oppScore ? "lose" : "draw";
    return (
      <IslamicShell title="نتيجة التحدي">
        <ShareResultCard
          headline={myName}
          subline={oppDone ? (score > oppScore ? "فزت على خصمك! 🎉" : score < oppScore ? `خصمك حصل على ${oppScore} نقطة` : "تعادل مع خصمك") : "في انتظار نتيجة الخصم…"}
          score={score}
          correct={correct}
          total={questions.length}
          outcome={outcome}
        />
        {oppDone && (
          <IslamicCard style={{ marginBottom: 12, textAlign: "center", padding: "12px 16px" }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>نقاط الخصم</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: score > oppScore ? "#fca5a5" : "#86efac" }}>{oppScore}</div>
          </IslamicCard>
        )}
        <div style={{ textAlign: "center" }}>
          <GhostButton onClick={() => setLocation("/islamic")}>الرئيسية</GhostButton>
        </div>
      </IslamicShell>
    );
  }

  const q = questions[idx];
  const timerPct = (secondsLeft / TIMER_SECONDS) * 100;
  const timerColor = secondsLeft > 10 ? ISLAMIC_GOLD : secondsLeft > 5 ? "#fb923c" : "#ef4444";

  return (
    <IslamicShell title="تحدي">
      {/* Timer bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
          <span>السؤال {idx + 1}/{questions.length} · النقاط: <strong style={{ color: ISLAMIC_GOLD }}>{score}</strong></span>
          <span style={{ color: timerColor, fontWeight: 700 }}>⏱ {secondsLeft}ث</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, borderRadius: 4, transition: "width 1s linear, background 0.5s" }} />
        </div>
      </div>

      <IslamicCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "clamp(17px, 5vw, 22px)", fontWeight: 700, lineHeight: 1.8, textAlign: "center", marginBottom: 16, wordBreak: "break-word" }}>{q.questionText}</div>
        {q.audioUrl && (
          <div style={{ marginBottom: 12 }}>
            <AudioPlayer src={q.audioUrl} onListen={handleAudioListen} listenCount={audioListensRef.current} />
          </div>
        )}
      </IslamicCard>

      <style>{`
        .ch-opt { position: relative; padding: 16px 60px 16px 20px; border-radius: 16px;
          font-family: inherit; font-size: clamp(14px, 4vw, 17px); font-weight: 600; line-height: 1.7;
          text-align: right; cursor: pointer; transition: all .18s ease; width: 100%;
          border: 2px solid transparent; color: #1c1208;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
        .ch-opt:hover:not(:disabled) { transform: translateY(-3px);
          box-shadow: 0 8px 22px rgba(0,0,0,0.13); filter: brightness(0.96); }
        .ch-opt:active:not(:disabled) { transform: translateY(0); }
        .ch-opt:disabled { cursor: default; }
        .ch-opt .ltr { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px; background: rgba(0,0,0,0.1); color: inherit;
          border: 2px solid rgba(0,0,0,0.12); }
        .ch-opt-0 { background: #fef9c3; border-color: #fbbf24; }
        .ch-opt-1 { background: #dbeafe; border-color: #60a5fa; }
        .ch-opt-2 { background: #dcfce7; border-color: #4ade80; }
        .ch-opt-3 { background: #ede9fe; border-color: #a78bfa; }
        .ch-opt.correct { background: linear-gradient(135deg, #16a34a, #15803d) !important;
          border-color: #4ade80 !important; color: #fff !important;
          box-shadow: 0 0 0 3px rgba(74,222,128,0.3), 0 8px 22px rgba(22,163,74,0.4) !important; }
        .ch-opt.correct .ltr { background: rgba(255,255,255,0.25); color: #fff; border-color: rgba(255,255,255,0.4); }
        .ch-opt.wrong { background: linear-gradient(135deg, #b91c1c, #7f1d1d) !important;
          border-color: #fca5a5 !important; color: #fff !important; }
        .ch-opt.wrong .ltr { background: rgba(255,255,255,0.25); color: #fff; border-color: rgba(255,255,255,0.4); }
        .ch-opt.dim { opacity: .42; }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
        {q.options.map((o, i) => {
          const isSel = selected === o;
          const isCorrect = revealed && o === q.correctAnswer;
          const isWrong = revealed && isSel && o !== q.correctAnswer;
          const dim = revealed && !isCorrect && !isWrong;
          const letter = ["أ", "ب", "ج", "د"][i] || String(i + 1);
          const cls = [
            "ch-opt",
            !revealed ? `ch-opt-${i}` : "",
            isCorrect ? "correct" : "",
            isWrong ? "wrong" : "",
            dim ? "dim" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={o} onClick={() => answer(o)} disabled={revealed} className={cls}>
              <span className="ltr" aria-hidden="true">
                {isCorrect ? "✓" : isWrong ? "✕" : letter}
              </span>
              {o}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          {selected === null && <div style={{ color: "#fca5a5", marginBottom: 8, fontWeight: 700 }}>⌛ انتهى الوقت!</div>}
          <GoldButton onClick={next}>{idx + 1 >= questions.length ? "إنهاء" : "التالي"}</GoldButton>
        </div>
      )}
    </IslamicShell>
  );
}

/* ── 4. Tournament play ──────────────────────────────────────── */
export function IslamicTournamentPlay() {
  const [, params] = useRoute("/islamic/tournament/play/:pin");
  const [, setLocation] = useLocation();
  const pin = params?.pin || "";
  const qs = new URLSearchParams(window.location.search);
  const teamName = qs.get("team") || "";
  const teamToken = qs.get("token") || "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalStartRef = useRef(Date.now());
  const questionStartRef = useRef(Date.now());
  const audioListensRef = useRef<number>(0);

  const [tourLoadError, setTourLoadError] = useState("");
  const [completedTournament, setCompletedTournament] = useState<Tournament | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api<Tournament>(`/islamic/tournaments/${pin}`)
      .then(setTournament)
      .catch((e: Error) => setTourLoadError(e.message || "البطولة غير موجودة"));
  }, [pin]);

  useEffect(() => {
    if (!done) return;
    const poll = () => {
      api<Tournament>(`/islamic/tournaments/${pin}`).then((t) => {
        setCompletedTournament(t);
        if (t.status === "completed") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      }).catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [done, pin]);

  useEffect(() => {
    if (!tournament || !tournament.questions.length || revealed || done) return;
    audioListensRef.current = 0;
    setSecondsLeft(TIMER_SECONDS);
    questionStartRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setSelected(null);
          setRevealed(true);
          playWrong();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [idx, tournament?.questions.length, done]);

  function handleAudioListen() {
    audioListensRef.current++;
  }

  function answer(opt: string) {
    if (revealed || !tournament) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const q = tournament.questions[idx];
    const isC = opt === q.correctAnswer;
    setSelected(opt);
    setRevealed(true);
    if (isC) {
      const elapsed = (Date.now() - questionStartRef.current) / 1000;
      const pts = elapsed < 5 ? 10 : 5;
      setScore((s) => s + pts);
      setCorrect((c) => c + 1);
      playCorrect();
    } else {
      playWrong();
    }
  }

  async function next() {
    if (!tournament) return;
    if (idx + 1 >= tournament.questions.length) {
      const totalMs = Date.now() - totalStartRef.current;
      await api(`/islamic/tournaments/${pin}/submit`, {
        method: "POST",
        body: JSON.stringify({ teamToken, score, timeMs: totalMs, correct }),
      });
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  if (tourLoadError) {
    return (
      <IslamicShell title="تحدي الفرق">
        <IslamicCard>
          <p style={{ textAlign: "center", color: "#fca5a5", fontSize: 18, marginBottom: 16 }}>❌ {tourLoadError}</p>
          <div style={{ textAlign: "center" }}>
            <GhostButton onClick={() => window.history.back()}>رجوع</GhostButton>
          </div>
        </IslamicCard>
      </IslamicShell>
    );
  }

  if (!tournament) {
    return <IslamicShell><IslamicCard><p style={{ textAlign: "center" }}>جاري التحميل…</p></IslamicCard></IslamicShell>;
  }

  if (done) {
    const finalT = completedTournament ?? tournament;
    const isCompleted = finalT.status === "completed";
    const sorted = [...finalT.teamNames].sort((a, b) => {
      const sa = finalT.teamScores[a]?.score ?? 0;
      const sb = finalT.teamScores[b]?.score ?? 0;
      return sb - sa;
    });
    const finalOutcome: "win" | "lose" | "done" = isCompleted
      ? sorted[0] === teamName ? "win" : "lose"
      : "done";

    return (
      <IslamicShell title="انتهت جولتك!">
        <ShareResultCard
          headline={teamName}
          subline={`بطولة: ${finalT.name}`}
          score={score}
          correct={correct}
          total={finalT.questions.length}
          outcome={finalOutcome}
        />
        {!isCompleted && (
          <IslamicCard style={{ marginBottom: 12, textAlign: "center", padding: "10px 16px" }}>
            <div style={{ fontSize: 13, color: "#fde68a", opacity: 0.85 }}>في انتظار نتائج الفرق الأخرى…</div>
          </IslamicCard>
        )}
        <div style={{ textAlign: "center" }}>
          <GoldButton onClick={() => setLocation(`/islamic/tournament/host/${pin}`)}>🏆 لوحة النتائج</GoldButton>
        </div>
      </IslamicShell>
    );
  }

  const q = tournament.questions[idx];
  const timerPct = (secondsLeft / TIMER_SECONDS) * 100;
  const timerColor = secondsLeft > 10 ? ISLAMIC_GOLD : secondsLeft > 5 ? "#fb923c" : "#ef4444";

  return (
    <IslamicShell title={`بطولة: ${tournament.name}`}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
          <span>🏅 {teamName} · السؤال {idx + 1}/{tournament.questions.length} · نقاط: <strong style={{ color: ISLAMIC_GOLD }}>{score}</strong></span>
          <span style={{ color: timerColor, fontWeight: 700 }}>⏱ {secondsLeft}ث</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, borderRadius: 4, transition: "width 1s linear, background 0.5s" }} />
        </div>
      </div>

      <IslamicCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "clamp(17px, 5vw, 22px)", fontWeight: 700, lineHeight: 1.8, textAlign: "center", marginBottom: 16, wordBreak: "break-word" }}>{q.questionText}</div>
        {q.audioUrl && (
          <div style={{ marginBottom: 12 }}>
            <AudioPlayer src={q.audioUrl} onListen={handleAudioListen} listenCount={audioListensRef.current} />
          </div>
        )}
      </IslamicCard>

      <style>{`
        .tour-opt { position: relative; padding: 16px 60px 16px 20px; border-radius: 16px;
          font-family: inherit; font-size: clamp(14px, 4vw, 17px); font-weight: 600; line-height: 1.7;
          text-align: right; cursor: pointer; transition: all .18s ease; width: 100%;
          border: 2px solid transparent; color: #1c1208;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
        .tour-opt:hover:not(:disabled) { transform: translateY(-3px);
          box-shadow: 0 8px 22px rgba(0,0,0,0.13); filter: brightness(0.96); }
        .tour-opt:active:not(:disabled) { transform: translateY(0); }
        .tour-opt:disabled { cursor: default; }
        .tour-opt .ltr { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px; background: rgba(0,0,0,0.1); color: inherit;
          border: 2px solid rgba(0,0,0,0.12); }
        .tour-opt-0 { background: #fef9c3; border-color: #fbbf24; }
        .tour-opt-1 { background: #dbeafe; border-color: #60a5fa; }
        .tour-opt-2 { background: #dcfce7; border-color: #4ade80; }
        .tour-opt-3 { background: #ede9fe; border-color: #a78bfa; }
        .tour-opt.correct { background: linear-gradient(135deg, #16a34a, #15803d) !important;
          border-color: #4ade80 !important; color: #fff !important;
          box-shadow: 0 0 0 3px rgba(74,222,128,0.3), 0 8px 22px rgba(22,163,74,0.4) !important; }
        .tour-opt.correct .ltr { background: rgba(255,255,255,0.25); color: #fff; border-color: rgba(255,255,255,0.4); }
        .tour-opt.wrong { background: linear-gradient(135deg, #b91c1c, #7f1d1d) !important;
          border-color: #fca5a5 !important; color: #fff !important; }
        .tour-opt.wrong .ltr { background: rgba(255,255,255,0.25); color: #fff; border-color: rgba(255,255,255,0.4); }
        .tour-opt.dim { opacity: .42; }
      `}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
        {q.options.map((o, i) => {
          const isSel = selected === o;
          const isCorrect = revealed && o === q.correctAnswer;
          const isWrong = revealed && isSel && o !== q.correctAnswer;
          const dim = revealed && !isCorrect && !isWrong;
          const letter = ["أ", "ب", "ج", "د"][i] || String(i + 1);
          const cls = [
            "tour-opt",
            !revealed ? `tour-opt-${i}` : "",
            isCorrect ? "correct" : "",
            isWrong ? "wrong" : "",
            dim ? "dim" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={o} onClick={() => answer(o)} disabled={revealed} className={cls}>
              <span className="ltr" aria-hidden="true">
                {isCorrect ? "✓" : isWrong ? "✕" : letter}
              </span>
              {o}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          {selected === null && <div style={{ color: "#fca5a5", marginBottom: 8, fontWeight: 700 }}>⌛ انتهى الوقت!</div>}
          <GoldButton onClick={next}>{idx + 1 >= tournament.questions.length ? "إنهاء وإرسال النتيجة" : "التالي"}</GoldButton>
        </div>
      )}
    </IslamicShell>
  );
}

/* ── 5. Tournament host/scoreboard ──────────────────────────── */
export function IslamicTournamentHost() {
  const [, params] = useRoute("/islamic/tournament/host/:pin");
  const [, setLocation] = useLocation();
  const pin = params?.pin || "";

  const [data, setData] = useState<Tournament | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => api<Tournament>(`/islamic/tournaments/${pin}`).then(setData).catch(() => {});
    load();
    intervalRef.current = setInterval(load, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pin]);

  if (!data) {
    return <IslamicShell><IslamicCard><p style={{ textAlign: "center" }}>جاري التحميل…</p></IslamicCard></IslamicShell>;
  }

  const sorted = [...data.teamNames].sort((a, b) => {
    const sa = data.teamScores[a]?.score ?? 0;
    const sb = data.teamScores[b]?.score ?? 0;
    return sb - sa;
  });

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <IslamicShell title={`🏆 ${data.name}`}>
      <BackLink />
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>رمز البطولة: <strong style={{ color: ISLAMIC_GOLD, letterSpacing: 3 }}>{pin}</strong></div>
        <div style={{ fontSize: 12, color: data.status === "completed" ? "#86efac" : "#fbbf24", marginTop: 4 }}>
          {data.status === "completed" ? "✅ اكتملت البطولة" : "⏳ جارية…"}
        </div>
      </div>

      {sorted.map((team, i) => {
        const ts = data.teamScores[team];
        const isDone = ts?.status === "done";
        const topScore = data.teamScores[sorted[0]]?.score ?? 0;
        const teamScore = ts?.score ?? 0;
        const shareOutcome: "win" | "lose" | "draw" =
          i === 0 ? "win" : teamScore === topScore ? "draw" : "lose";
        return (
          <IslamicCard key={team} glow={i === 0 && isDone} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28, minWidth: 36, textAlign: "center" }}>{medals[i] || `${i + 1}`}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: i === 0 ? ISLAMIC_GOLD : "#fefce8" }}>{team}</div>
                {isDone && (
                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                    {ts.correct}/{data.questions.length} صحيحة · {Math.round(ts.timeMs / 1000)}ث
                  </div>
                )}
                {!isDone && <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 2 }}>لم يكمل بعد…</div>}
              </div>
              <div style={{ textAlign: "center", minWidth: 56 }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: ISLAMIC_GOLD }}>{ts?.score ?? 0}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>نقطة</div>
              </div>
            </div>
            {isDone && data.status === "completed" && (
              <div style={{ marginTop: 14 }}>
                <ShareResultCard
                  headline={team}
                  subline={data.name}
                  score={teamScore}
                  correct={ts?.correct ?? 0}
                  total={data.questions.length}
                  outcome={shareOutcome}
                />
              </div>
            )}
          </IslamicCard>
        );
      })}

      {data.status === "completed" && (
        <IslamicCard glow style={{ marginTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🎉</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: ISLAMIC_GOLD }}>الفائز: {sorted[0]}</div>
          <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>بـ {data.teamScores[sorted[0]]?.score ?? 0} نقطة</div>
        </IslamicCard>
      )}
    </IslamicShell>
  );
}
