import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  StudentDetailModal,
  type ActivityResult,
  type StudentRow,
} from "./results";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ResultsPayload {
  session: { id: number; pin: string; status: string; startedAt: string | null };
  deck: { id: number; title: string };
  activities: ActivityResult[];
  students: StudentRow[];
  insights?: { classAvgPct: number | null };
}

// Standalone fullscreen Student Insights page for sharing/bookmarking.
export default function StudentInsightsPage() {
  const { t, dir } = useI18n();
  const params = useParams<{ sessionId: string; studentKey: string }>();
  const [, setLocation] = useLocation();
  const sid = Number(params.sessionId);
  const studentKey = decodeURIComponent(params.studentKey ?? "");

  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(sid)) {
      setError(t.presentation.invalidId);
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/presentations/sessions/${sid}/results`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) throw new Error("auth");
        if (!r.ok) throw new Error("load");
        return r.json() as Promise<ResultsPayload>;
      })
      .then((j) => setData(j))
      .catch((e: Error) => {
        if (e.message === "auth") setLocation("/login");
        else setError(t.presentation.studentLoadError);
      })
      .finally(() => setLoading(false));
  }, [sid, setLocation]);

  const goBack = () => setLocation(`/p/results/${sid}`);

  if (loading) {
    return (
      <div dir={dir} className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/70" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div dir={dir} className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center gap-3 text-white/80 p-6 text-center">
        <div>{error ?? t.presentation.loadError}</div>
        <button onClick={goBack} className="text-sm underline">{t.presentation.back}</button>
      </div>
    );
  }
  if (!data.students.find((s) => s.studentKey === studentKey)) {
    return (
      <div dir={dir} className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center gap-3 text-white/80 p-6 text-center">
        <div>{t.presentation.studentNotFound}</div>
        <button onClick={goBack} className="text-sm underline">{t.presentation.backToResults}</button>
      </div>
    );
  }

  return (
    <StudentDetailModal
      studentKey={studentKey}
      students={data.students}
      activities={data.activities}
      sessionStartedAt={data.session.startedAt}
      deckTitle={data.deck.title}
      sessionPin={data.session.pin}
      sessionId={sid}
      classAvgPct={data.insights?.classAvgPct ?? null}
      onClose={goBack}
    />
  );
}
