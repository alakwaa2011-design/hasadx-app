import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { Trophy, Flame, Star, Users, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface FollowerSummary {
  id: number;
  name: string;
  profileSlug: string | null;
  displaySchool: string | null;
  followedAt: string;
}

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
  followerCount: number;
  isOwner: boolean;
  isFollowing: boolean;
  canFollow: boolean;
  followers?: FollowerSummary[];
}

export default function TeacherPublicProfile() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/profile/${encodeURIComponent(idOrSlug)}`,
          { credentials: "include" },
        );
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

  const toggleFollow = async () => {
    if (!data || following) return;
    setFollowing(true);
    const wasFollowing = data.isFollowing;
    try {
      const res = await fetch(
        `${API_BASE}/api/profile/${encodeURIComponent(idOrSlug)}/follow`,
        {
          method: wasFollowing ? "DELETE" : "POST",
          credentials: "include",
        },
      );
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast.error("سجّل الدخول لتتمكن من المتابعة");
        return;
      }
      if (!res.ok) throw new Error(j?.message || "Failed");
      setData({
        ...data,
        isFollowing: !!j.isFollowing,
        followerCount: typeof j.followerCount === "number" ? j.followerCount : data.followerCount,
      });
      toast.success(j.isFollowing ? "تمت المتابعة" : "تم إلغاء المتابعة");
    } catch (err: any) {
      toast.error(err?.message || "تعذّر تنفيذ الإجراء");
    } finally {
      setFollowing(false);
    }
  };

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
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            <Stat icon={<Trophy className="text-amber-600" />} label="شارات" value={data.stats.badgeCount} />
            <Stat icon={<Flame className="text-orange-500" />} label="السلسلة" value={`${data.stats.currentStreakDays}`} />
            <Stat icon={<Star className="text-yellow-500" />} label="الأطول" value={`${data.stats.longestStreakDays}`} />
            <Stat icon={<Users className="text-emerald-600" />} label="متابعون" value={data.followerCount.toLocaleString("ar")} />
          </div>
          {data.canFollow && (
            <div className="mt-5">
              <Button
                onClick={toggleFollow}
                disabled={following}
                className={
                  data.isFollowing
                    ? "gap-2 bg-gray-200 text-gray-800 hover:bg-gray-300"
                    : "gap-2 bg-indigo-600 hover:bg-indigo-700"
                }
              >
                {following ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : data.isFollowing ? (
                  <UserMinus className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {data.isFollowing ? "إلغاء المتابعة" : "متابعة"}
              </Button>
            </div>
          )}
          {data.isOwner && (
            <p className="mt-4 text-xs text-gray-500">
              هذا ملفك العام. يمكنك تعديل إعداداته من{" "}
              <Link href="/teacher/settings" className="text-indigo-700 underline">
                الإعدادات
              </Link>
              .
            </p>
          )}
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
        {data.isOwner && (
          <Card className="p-5">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              المتابعون ({data.followerCount.toLocaleString("ar")})
            </h3>
            {data.followers && data.followers.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {data.followers.map((f) => {
                  const target = f.profileSlug ?? String(f.id);
                  return (
                    <li key={f.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/t/${target}`}
                          className="font-semibold text-indigo-700 hover:underline truncate block"
                        >
                          {f.name}
                        </Link>
                        {f.displaySchool && (
                          <p className="text-xs text-gray-500 truncate">{f.displaySchool}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {new Date(f.followedAt).toLocaleDateString("ar")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">لا يوجد متابعون بعد. شارك ملفك ليبدأ الناس بمتابعتك!</p>
            )}
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
