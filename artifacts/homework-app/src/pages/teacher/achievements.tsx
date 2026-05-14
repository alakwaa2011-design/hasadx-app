import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { Trophy, Star, Flame, Target, Lock, CheckCircle2, Sparkles } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface AchievementsData {
  stats: {
    totalXp: number;
    seasonXp: number;
    level: number;
    levelNameAr: string;
    nextLevelMinXp: number | null;
    nextLevelNameAr: string | null;
    xpToNext: number;
    currentStreakDays: number;
    longestStreakDays: number;
    badgeCount: number;
    questsCompleted: number;
  };
  levels: Array<{ level: number; nameAr: string; minXp: number }>;
  badges: Array<{
    id: number;
    key: string;
    nameAr: string;
    descriptionAr: string;
    icon: string;
    tier: string;
    earned: boolean;
    earnedAt: string | null;
    isAchievable: boolean;
  }>;
  rewards: Array<{
    id: number;
    nameAr: string;
    metric: string;
    threshold: number;
    prizeKind: string;
    prizeLabelAr: string;
    prizeDescriptionAr: string | null;
    granted: boolean;
    autoApplied: boolean;
    fulfilled: boolean;
    progress: number;
  }>;
}

interface Quest {
  id: number;
  titleAr: string;
  descriptionAr: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardXp: number;
  endsAt: string;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-900 border-amber-300",
  silver: "bg-slate-100 text-slate-900 border-slate-300",
  gold: "bg-yellow-100 text-yellow-900 border-yellow-300",
  legendary: "bg-purple-100 text-purple-900 border-purple-300",
};

export default function TeacherAchievements() {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [aRes, qRes] = await Promise.all([
          fetch(`${API_BASE}/api/me/achievements`, { credentials: "include" }),
          fetch(`${API_BASE}/api/me/quests`, { credentials: "include" }),
        ]);
        if (!aRes.ok) throw new Error("achievements");
        const a = (await aRes.json()) as AchievementsData;
        const q = qRes.ok ? ((await qRes.json()) as { quests: Quest[] }) : { quests: [] };
        if (!cancelled) {
          setData(a);
          setQuests(q.quests);
        }
      } catch (e) {
        if (!cancelled) setError("تعذّر تحميل البيانات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-600">جارٍ التحميل…</div>
      </Layout>
    );
  }
  if (error || !data) {
    return (
      <Layout>
        <div className="p-8 text-center text-red-600">{error ?? "لا توجد بيانات"}</div>
      </Layout>
    );
  }

  const s = data.stats;
  const progressPct =
    s.nextLevelMinXp != null
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((s.totalXp - (data.levels.find((l) => l.level === s.level)?.minXp ?? 0)) /
                Math.max(
                  1,
                  s.nextLevelMinXp - (data.levels.find((l) => l.level === s.level)?.minXp ?? 0),
                )) *
                100,
            ),
          ),
        )
      : 100;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 space-y-6" dir="rtl">
        {/* Stats hero */}
        <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-indigo-700 font-semibold">
                <Sparkles size={16} /> المستوى {s.level}
              </div>
              <h2 className="text-3xl font-bold mt-1">{s.levelNameAr}</h2>
              <p className="text-gray-700 mt-1">إجمالي الخبرة: {s.totalXp.toLocaleString("ar")}</p>
              {s.nextLevelNameAr && (
                <p className="text-sm text-gray-600 mt-2">
                  باقي {s.xpToNext.toLocaleString("ar")} نقطة للوصول إلى{" "}
                  <span className="font-semibold">{s.nextLevelNameAr}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <Stat icon={<Flame className="text-orange-500" />} label="السلسلة الحالية" value={`${s.currentStreakDays} يوم`} />
              <Stat icon={<Star className="text-yellow-500" />} label="أطول سلسلة" value={`${s.longestStreakDays} يوم`} />
              <Stat icon={<Trophy className="text-amber-600" />} label="الشارات" value={s.badgeCount} />
              <Stat icon={<Target className="text-green-600" />} label="مهام منجزة" value={s.questsCompleted} />
            </div>
          </div>
          {s.nextLevelMinXp != null && (
            <div className="mt-5">
              <div className="h-3 bg-white/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1 text-left">{progressPct}%</p>
            </div>
          )}
        </Card>

        {/* Quests */}
        {quests.length > 0 && (
          <Card className="p-5">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Target size={18} /> مهام الأسبوع
            </h3>
            <div className="space-y-3">
              {quests.map((q) => {
                const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
                return (
                  <div key={q.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{q.titleAr}</p>
                        <p className="text-xs text-gray-600">{q.descriptionAr}</p>
                      </div>
                      <div className="text-sm">
                        {q.completed ? (
                          <span className="text-green-700 flex items-center gap-1">
                            <CheckCircle2 size={16} /> +{q.rewardXp}
                          </span>
                        ) : (
                          <span className="text-gray-700">{q.progress}/{q.target}</span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Badges */}
        <Card className="p-5">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Trophy size={18} /> الشارات ({data.badges.filter((b) => b.earned).length}/{data.badges.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {data.badges.map((b) => (
              <div
                key={b.id}
                className={`border-2 rounded-xl p-3 text-center transition ${
                  b.earned ? TIER_COLORS[b.tier] : "bg-gray-50 border-gray-200 opacity-60"
                }`}
              >
                <div className="text-3xl mb-1">{b.earned ? b.icon : <Lock size={28} className="mx-auto" />}</div>
                <p className="font-semibold text-sm">{b.nameAr}</p>
                <p className="text-xs mt-1">{b.descriptionAr}</p>
                {b.earned && b.earnedAt && (
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(b.earnedAt).toLocaleDateString("ar")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Threshold rewards */}
        {data.rewards.length > 0 && (
          <Card className="p-5">
            <h3 className="text-lg font-bold mb-3">الجوائز والمكافآت</h3>
            <div className="space-y-3">
              {data.rewards.map((r) => {
                const pct = Math.min(100, Math.round((r.progress / r.threshold) * 100));
                return (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="font-semibold">{r.nameAr}</p>
                        <p className="text-sm text-gray-700">🎁 {r.prizeLabelAr}</p>
                        {r.prizeDescriptionAr && (
                          <p className="text-xs text-gray-600 mt-1">{r.prizeDescriptionAr}</p>
                        )}
                      </div>
                      <div className="text-sm shrink-0">
                        {r.granted ? (
                          <span className="text-green-700 font-semibold">
                            {r.fulfilled ? "✓ تم الاستلام" : "✓ مستحقة"}
                          </span>
                        ) : (
                          <span className="text-gray-700">
                            {r.progress.toLocaleString("ar")}/{r.threshold.toLocaleString("ar")}
                          </span>
                        )}
                      </div>
                    </div>
                    {!r.granted && (
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-2 min-w-[110px] flex items-center gap-2">
      <div>{icon}</div>
      <div className="text-right">
        <p className="text-[11px] text-gray-600">{label}</p>
        <p className="font-bold">{value}</p>
      </div>
    </div>
  );
}
