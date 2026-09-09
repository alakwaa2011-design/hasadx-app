import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useSeo } from "@/lib/seo";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { BadgeCheck, Trophy, Gamepad2, Star, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AvatarDisplay } from "@/components/avatar-display";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface StudentProfileResp {
  student: {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
    totalScore: number;
    gamesPlayed: number;
    rank: number;
    isVerified: boolean;
    createdAt: string;
  };
  isOwner: boolean;
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-2xl flex items-center justify-center">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export default function StudentPublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { t, lang, dir } = useI18n();
  const copy = t.publicProfiles.student;
  const common = t.publicProfiles.common;
  const [data, setData] = useState<StudentProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  useSeo({
    title: data?.student?.displayName
      ? copy.seoTitleNamed.replace("{name}", data.student.displayName)
      : copy.seoTitle,
    description: data?.student?.displayName
      ? copy.seoDescriptionNamed.replace("{name}", data.student.displayName)
      : copy.seoDescription,
    canonicalPath: `/stu/${username}`,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/student-auth/public/${encodeURIComponent(username)}`,
          { credentials: "include" },
        );
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error();
        const j = (await res.json()) as StudentProfileResp;
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
  }, [username]);

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex justify-center" role="status" aria-label={common.loading}>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" aria-hidden="true" />
        </div>
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

  const { student, isOwner } = data;
  const joinYear = new Date(student.createdAt).getFullYear();

  return (
    <Layout>
      <div className="max-w-xl mx-auto p-4 space-y-4" dir={dir}>
        {/* Profile card */}
        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 text-center">
          {/* Avatar / emoji */}
          <div className="flex justify-center">
            <AvatarDisplay avatar={student.avatar} size="4xl" fallback="🎓" />
          </div>

          {/* Name + verified badge */}
          <h1 className="text-2xl font-bold mt-2 flex items-center justify-center gap-2">
            {student.displayName}
            {student.isVerified && (
              <span title={common.verifiedAccount} aria-label={common.verifiedAccount}>
                <BadgeCheck className="w-6 h-6 text-emerald-500 shrink-0" />
              </span>
            )}
          </h1>

          {/* Username */}
          <p className="text-sm text-gray-500 mt-0.5">@{student.username}</p>

          {/* Member since */}
          <p className="text-xs text-gray-400 mt-1">
            {copy.memberSince.replace("{year}", joinYear.toLocaleString(lang, { useGrouping: false }))}
          </p>

          {/* Stats row */}
          <div className="flex justify-center gap-8 mt-5 flex-wrap">
            <StatItem
              icon={<Trophy className="w-6 h-6 text-amber-500" />}
              label={copy.points}
              value={student.totalScore.toLocaleString(lang)}
            />
            <StatItem
              icon={<Gamepad2 className="w-6 h-6 text-indigo-500" />}
              label={copy.games}
              value={student.gamesPlayed.toLocaleString(lang)}
            />
            <StatItem
              icon={<Star className="w-6 h-6 text-yellow-500" />}
              label={copy.rank}
              value={`#${student.rank.toLocaleString(lang)}`}
            />
          </div>
        </Card>

        {/* Verification prompt — shown only to the profile owner when unverified */}
        {isOwner && !student.isVerified && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <BadgeCheck className="w-4 h-4 shrink-0" />
            <span>
              {copy.unverifiedBefore}{" "}
              <Link href="/student/login" className="font-semibold underline">
                {copy.signInGoogle}
              </Link>
              {" "}{copy.unverifiedAfter}
            </span>
          </div>
        )}

        {/* Owner link to dashboard */}
        {isOwner && (
          <p className="text-center text-xs text-gray-500">
            {copy.ownerBefore}{" "}
            <Link href="/student/dashboard" className="text-emerald-700 underline">
              {copy.dashboard}
            </Link>
            .
          </p>
        )}
      </div>
    </Layout>
  );
}
