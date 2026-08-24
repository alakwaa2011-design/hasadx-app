import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useSeo } from "@/lib/seo";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { Trophy, Flame, Star, Users, UserPlus, UserMinus, Loader2, BadgeCheck } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface FollowerSummary {
  id: number;
  name: string;
  profileSlug: string | null;
  displaySchool: string | null;
  followedAt: string;
}

interface ProfileResp {
  teacher: { id: number; name: string; displaySchool: string | null; profileSlug: string | null; emailVerified: boolean };
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
  const { t, lang, dir } = useI18n();
  const copy = t.publicProfiles.teacher;
  const common = t.publicProfiles.common;
  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  useSeo({
    title: data?.teacher?.name
      ? copy.seoTitleNamed.replace("{name}", data.teacher.name)
      : copy.seoTitle,
    description: data?.teacher?.name
      ? copy.seoDescriptionNamed.replace("{name}", data.teacher.name)
      : copy.seoDescription,
    canonicalPath: `/t/${idOrSlug}`,
  });

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
        toast.error(copy.signInToFollow);
        return;
      }
      if (!res.ok) throw new Error(j?.message || copy.followError);
      setData({
        ...data,
        isFollowing: !!j.isFollowing,
        followerCount: typeof j.followerCount === "number" ? j.followerCount : data.followerCount,
      });
      toast.success(j.isFollowing ? copy.followed : copy.unfollowed);
    } catch (err: any) {
      toast.error(err?.message || copy.followError);
    } finally {
      setFollowing(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-600" role="status">{common.loading}</div>
      </Layout>
    );
  }
  if (notFound || !data) {
    return (
      <Layout>
        <div className="p-8 text-center text-red-600" role="alert">{copy.notFound}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4 space-y-4" dir={dir}>
        <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 text-center">
          <div className="text-5xl">👨‍🏫</div>
          <h1 className="text-2xl font-bold mt-2 flex items-center justify-center gap-2">
            {data.teacher.name}
            {data.teacher.emailVerified && (
              <motion.span
                title={common.verifiedAccount}
                aria-label={common.verifiedAccount}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.2 }}
              >
                <BadgeCheck className="w-6 h-6 text-indigo-500 shrink-0" />
              </motion.span>
            )}
          </h1>
          {data.teacher.displaySchool && <p className="text-gray-700">{data.teacher.displaySchool}</p>}
          <p className="text-indigo-700 font-semibold mt-2">
            {copy.levelStatus
              .replace("{name}", data.stats.levelNameAr)
              .replace("{level}", data.stats.level.toLocaleString(lang))}
          </p>
          <p className="text-gray-700">
            {copy.xp.replace("{count}", data.stats.totalXp.toLocaleString(lang))}
          </p>
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            <Stat icon={<Trophy className="text-amber-600" />} label={copy.badges} value={data.stats.badgeCount.toLocaleString(lang)} />
            <Stat icon={<Flame className="text-orange-500" />} label={copy.streak} value={data.stats.currentStreakDays.toLocaleString(lang)} />
            <Stat icon={<Star className="text-yellow-500" />} label={copy.longestStreak} value={data.stats.longestStreakDays.toLocaleString(lang)} />
            <Stat icon={<Users className="text-emerald-600" />} label={copy.followers} value={data.followerCount.toLocaleString(lang)} />
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
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : data.isFollowing ? (
                  <UserMinus className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {following ? copy.updatingFollow : data.isFollowing ? copy.unfollow : copy.follow}
              </Button>
            </div>
          )}
          {data.isOwner && !data.teacher.emailVerified && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <BadgeCheck className="w-4 h-4 shrink-0" />
              <span>
                {copy.unverifiedBefore}{" "}
                <Link href="/teacher/settings#verify" className="font-semibold underline">
                  {copy.verifyNow}
                </Link>
                {" "}{copy.unverifiedAfter}
              </span>
            </div>
          )}
          {data.isOwner && (
            <p className="mt-3 text-xs text-gray-500">
              {copy.ownerBefore}{" "}
              <Link href="/teacher/settings" className="text-indigo-700 underline">
                {copy.settings}
              </Link>
              .
            </p>
          )}
        </Card>
        {data.badges.length > 0 && (
          <Card className="p-5">
            <h3 className="text-lg font-bold mb-3">{copy.earnedBadges}</h3>
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
              {copy.followersHeading.replace("{count}", data.followerCount.toLocaleString(lang))}
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
                      <span
                        className="text-xs text-gray-500 shrink-0"
                        aria-label={copy.followedOn.replace(
                          "{date}",
                          new Date(f.followedAt).toLocaleDateString(lang),
                        )}
                      >
                        {new Date(f.followedAt).toLocaleDateString(lang)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">{copy.noFollowers}</p>
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
