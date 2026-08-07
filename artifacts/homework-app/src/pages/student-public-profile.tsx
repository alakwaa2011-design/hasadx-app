import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useSeo } from "@/lib/seo";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { BadgeCheck, Trophy, Gamepad2, Star, Loader2 } from "lucide-react";

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
  const [data, setData] = useState<StudentProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  useSeo({
    title: data?.student?.displayName
      ? `${data.student.displayName} | منصة حصاد`
      : "ملف الطالب | منصة حصاد",
    description: data?.student?.displayName
      ? `ملف ${data.student.displayName} في منصة حصاد — النقاط والإنجازات والمسابقات التعليمية.`
      : "ملف طالب في منصة حصاد التعليمية.",
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
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      </Layout>
    );
  }

  if (notFound || !data) {
    return (
      <Layout>
        <div className="p-8 text-center text-red-600">الملف غير موجود</div>
      </Layout>
    );
  }

  const { student, isOwner } = data;
  const joinYear = new Date(student.createdAt).getFullYear();

  return (
    <Layout>
      <div className="max-w-xl mx-auto p-4 space-y-4" dir="rtl">
        {/* Profile card */}
        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 text-center">
          {/* Avatar / emoji */}
          <div className="text-5xl">
            {student.avatar ? (
              <span>{student.avatar}</span>
            ) : (
              <span>🎓</span>
            )}
          </div>

          {/* Name + verified badge */}
          <h1 className="text-2xl font-bold mt-2 flex items-center justify-center gap-2">
            {student.displayName}
            {student.isVerified && (
              <span title="حساب موثّق">
                <BadgeCheck className="w-6 h-6 text-emerald-500 shrink-0" />
              </span>
            )}
          </h1>

          {/* Username */}
          <p className="text-sm text-gray-500 mt-0.5">@{student.username}</p>

          {/* Member since */}
          <p className="text-xs text-gray-400 mt-1">عضو منذ {joinYear}</p>

          {/* Stats row */}
          <div className="flex justify-center gap-8 mt-5 flex-wrap">
            <StatItem
              icon={<Trophy className="w-6 h-6 text-amber-500" />}
              label="النقاط"
              value={student.totalScore.toLocaleString("ar-SA")}
            />
            <StatItem
              icon={<Gamepad2 className="w-6 h-6 text-indigo-500" />}
              label="الألعاب"
              value={student.gamesPlayed.toLocaleString("ar-SA")}
            />
            <StatItem
              icon={<Star className="w-6 h-6 text-yellow-500" />}
              label="الترتيب"
              value={`#${student.rank.toLocaleString("ar-SA")}`}
            />
          </div>
        </Card>

        {/* Verification prompt — shown only to the profile owner when unverified */}
        {isOwner && !student.isVerified && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <BadgeCheck className="w-4 h-4 shrink-0" />
            <span>
              حسابك غير موثّق بعد.{" "}
              <Link href="/student/login" className="font-semibold underline">
                سجّل الدخول بـ Google
              </Link>
              {" "}لربط حسابك وإظهار شارة التوثيق.
            </span>
          </div>
        )}

        {/* Owner link to dashboard */}
        {isOwner && (
          <p className="text-center text-xs text-gray-500">
            هذا ملفك العام.{" "}
            <Link href="/student/dashboard" className="text-emerald-700 underline">
              اذهب إلى لوحة التحكم
            </Link>
            .
          </p>
        )}
      </div>
    </Layout>
  );
}
