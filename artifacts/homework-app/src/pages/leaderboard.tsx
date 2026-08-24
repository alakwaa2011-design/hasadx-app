import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { Link } from "wouter";
import { Trophy, Crown } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Row {
  teacherId: number;
  name: string;
  displaySchool: string | null;
  profileSlug: string | null;
  xp: number;
  level: number;
  badgeCount: number;
  rank: number;
}

const RANK_BG = ["bg-yellow-100 border-yellow-300", "bg-slate-100 border-slate-300", "bg-amber-100 border-amber-300"];

export default function Leaderboard() {
  const { t, lang, dir } = useI18n();
  useSeo({
    title: lang === "ar" ? "لوحة المتصدرين | منصة حصاد — أفضل المعلمين والطلاب" : "Leaderboard | HasadX — Top Teachers",
    description: lang === "ar" ? "تعرّف على أكثر المعلمين نشاطاً في منصة حصاد التعليمية. لوحة المتصدرين تُحدَّث يومياً بالنقاط والمستويات والشارات." : "Meet the most active teachers on HasadX. The leaderboard is updated with points, levels, and badges.",
    canonicalPath: "/leaderboard",
    ogImage: "/opengraph.jpg",
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const j = await res.json();
        if (!cancelled) setRows(j.rows ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4" dir={dir}>
        <div className="text-center mb-6">
          <Crown className="mx-auto text-yellow-500" size={48} />
          <h1 className="text-3xl font-bold mt-2">{t.leaderboardPage.title}</h1>
          <p className="text-gray-600 mt-1">{t.leaderboardPage.subtitle}</p>
        </div>
        {loading ? (
          <div className="text-center text-gray-600 p-6">{t.leaderboardPage.loading}</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-600 p-6">{t.leaderboardPage.empty}</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const linkTo = `/t/${r.profileSlug ?? r.teacherId}`;
              const bg = r.rank <= 3 ? RANK_BG[r.rank - 1] : "bg-white";
              return (
                <Card key={r.teacherId} className={`p-3 flex items-center gap-3 border-2 ${bg}`}>
                  <div className="w-10 text-center font-bold text-lg">
                    {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={linkTo} className="font-semibold hover:underline truncate block">
                      {r.name}
                    </Link>
                    {r.displaySchool && <p className="text-xs text-gray-600 truncate">{r.displaySchool}</p>}
                  </div>
                  <div className="text-end shrink-0">
                    <p className="font-bold text-indigo-700">{Number(r.xp ?? 0).toLocaleString(lang === "ar" ? "ar" : "en-US")} XP</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 justify-end">
                      <Trophy size={12} /> {r.badgeCount ?? 0} {t.leaderboardPage.badges} · {t.leaderboardPage.level} {r.level ?? 0}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
