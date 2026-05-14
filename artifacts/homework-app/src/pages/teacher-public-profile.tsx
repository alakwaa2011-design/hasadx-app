import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { Trophy, Flame, Star } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ProfileResp {
  teacher: { id: number; name: string; displaySchool: string | null; profileSlug: string | null };
  stats: {
    totalXp: number;
    level: number;
    levelNameAr: string;
    currentStreakDays: number;
    longestStreakDays: number;
    badgeCount: number;
  };
  badges: Array<{ nameAr: string; icon: string; tier: string; awardedAt: string }>;
}

export default function TeacherPublicProfile() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(idOrSlug)}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error();
        const j = (await res.json()) as ProfileResp;
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idOrSlug]);

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-600">جارٍ التحميل…</div>
      </Layout>
    );
  }
  if (notFound || !data) {
    return (
      <Layout>
        <div className="p-8 text-center text-red-600">الملف غير موجود أو غير عام</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4 space-y-4" dir="rtl">
        <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 text-center">
          <div className="text-5xl">👨‍🏫</div>
          <h1 className="text-2xl font-bold mt-2">{data.teacher.name}</h1>
          {data.teacher.displaySchool && <p className="text-gray-700">{data.teacher.displaySchool}</p>}
          <p className="text-indigo-700 font-semibold mt-2">
            {data.stats.levelNameAr} · المستوى {data.stats.level}
          </p>
          <p className="text-gray-700">{data.stats.totalXp.toLocaleString("ar")} نقطة خبرة</p>
          <div className="flex justify-center gap-6 mt-4">
            <Stat icon={<Trophy className="text-amber-600" />} label="شارات" value={data.stats.badgeCount} />
            <Stat icon={<Flame className="text-orange-500" />} label="السلسلة" value={`${data.stats.currentStreakDays}`} />
            <Stat icon={<Star className="text-yellow-500" />} label="الأطول" value={`${data.stats.longestStreakDays}`} />
          </div>
        </Card>
        {data.badges.length > 0 && (
          <Card className="p-5">
            <h3 className="text-lg font-bold mb-3">الشارات المكتسبة</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {data.badges.map((b, i) => (
                <div key={i} className="text-center border rounded-lg p-2">
                  <div className="text-3xl">{b.icon}</div>
                  <p className="text-sm font-semibold mt-1">{b.nameAr}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="flex justify-center">{icon}</div>
      <p className="font-bold mt-1">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}
