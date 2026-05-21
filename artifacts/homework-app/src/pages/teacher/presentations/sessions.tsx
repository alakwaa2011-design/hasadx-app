import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  Loader2,
  ChevronRight,
  BarChart3,
  Users,
  Clock,
  Download,
  ExternalLink,
  Calendar,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

interface SessionRow {
  id: number;
  pin: string;
  status: "lobby" | "live" | "ended" | string;
  mode: "class" | "guest";
  targetClassId: number | null;
  targetClassName: string | null;
  classSize: number | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMin: number | null;
  participantsCount: number;
  totalAnswers: number;
  avgScorePct: number | null;
  participationPct: number | null;
}

interface HistoryPayload {
  deck: { id: number; title: string; language: "ar" | "en" } | null;
  sessions: SessionRow[];
}

/* Past-results dashboard for one deck. Lists every live session that
   has ever been started for the deck, with quick-glance aggregates,
   a link through to the full per-question results, and direct CSV
   download buttons (responses + students). */
export default function PresentationSessionsHistory() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const deckId = Number(params.id);

  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(deckId)) {
      setError("معرّف غير صالح");
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/presentations/${deckId}/sessions/history`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) throw new Error("auth");
        if (r.status === 403) throw new Error("forbidden");
        if (!r.ok) throw new Error("load");
        return r.json();
      })
      .then((j: HistoryPayload) => setData(j))
      .catch((e: Error) => {
        if (e.message === "auth") {
          setLocation("/login");
          return;
        }
        if (e.message === "forbidden") setError("لا تملك صلاحية الوصول");
        else setError("تعذّر تحميل النتائج");
        toast.error("تعذّر تحميل النتائج");
      })
      .finally(() => setLoading(false));
  }, [deckId, setLocation]);

  return (
    <Layout>
      <div dir="rtl" className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-6xl">
        <button
          onClick={() => setLocation(`/teacher/presentations/${deckId}`)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
        >
          <ChevronRight className="w-4 h-4" /> العودة إلى المحرّر
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${BRAND_GREEN}15`, color: BRAND_GREEN }}
            >
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight">
                نتائج الجلسات السابقة
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.deck?.title ?? "العرض"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setLocation(`/teacher/presentations/${deckId}/compare`)}
              variant="outline"
              className="gap-2"
              style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
            >
              🔀 مقارنة الجلسات
            </Button>
            <Button
              onClick={() => setLocation(`/teacher/presentations/${deckId}`)}
              variant="outline"
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" /> فتح المحرّر
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            {error}
          </div>
        ) : !data || data.sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {data.sessions.map((s) => (
              <SessionRowCard key={s.id} s={s} onOpen={() => setLocation(`/p/results/${s.id}`)} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 px-6 rounded-2xl border-2 border-dashed border-border bg-muted/30">
      <div
        className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
        style={{ background: `${BRAND_GREEN}15`, color: BRAND_GREEN }}
      >
        <BarChart3 className="w-8 h-8" />
      </div>
      <h3 className="font-black text-lg mb-1">لا توجد جلسات سابقة</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        ابدأ جلسة تفاعلية عبر QR وكود الانضمام من زر «بدء جلسة تفاعلية» في المحرّر، وستظهر النتائج هنا بعد انتهاء الجلسة.
      </p>
    </div>
  );
}

function SessionRowCard({ s, onOpen }: { s: SessionRow; onOpen: () => void }) {
  const dateLabel = (() => {
    const d = new Date(s.startedAt ?? s.createdAt);
    return d.toLocaleString("ar", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();
  const isEnded = s.status === "ended";

  return (
    <div
      className="rounded-2xl border-2 border-border bg-card p-4 sm:p-5 hover:shadow-md transition-shadow"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = BRAND_GREEN)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: meta */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black"
              style={
                isEnded
                  ? { background: "#22573915", color: BRAND_GREEN }
                  : { background: "#D9A52122", color: "#7a5a00" }
              }
            >
              {isEnded ? "منتهية" : "قيد التشغيل"}
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-foreground/70"
              title="رقم الجلسة"
            >
              PIN <span className="tabular-nums" style={{ color: BRAND_GOLD }}>{s.pin}</span>
            </span>
            {s.targetClassName ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                صف · {s.targetClassName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">
                وضع الضيوف
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {dateLabel}
            </span>
            {s.durationMin != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {s.durationMin} د
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {s.participantsCount}
              {s.classSize != null ? ` / ${s.classSize}` : ""} مشارك
            </span>
          </div>
        </div>

        {/* Right: numeric stats + actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Stat label="المتوسط" value={s.avgScorePct != null ? `${s.avgScorePct}%` : "—"} accent={BRAND_GREEN} />
          <Stat label="المشاركة" value={s.participationPct != null ? `${s.participationPct}%` : "—"} accent={BRAND_GOLD} />
          <Stat label="الإجابات" value={String(s.totalAnswers)} />
          <div className="flex items-center gap-2">
            <Button
              onClick={onOpen}
              size="sm"
              className="gap-1 font-bold"
              style={{ background: BRAND_GREEN, color: "white" }}
            >
              فتح
            </Button>
            <a
              href={`${API_BASE}/api/presentations/sessions/${s.id}/students.csv`}
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded-md border border-border text-xs font-bold hover:bg-muted"
              title="تنزيل ملخّص الطلاب CSV"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-3.5 h-3.5" /> الطلاب
            </a>
            <a
              href={`${API_BASE}/api/presentations/sessions/${s.id}/results.csv`}
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded-md border border-border text-xs font-bold hover:bg-muted"
              title="تنزيل تفاصيل الإجابات CSV"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-3.5 h-3.5" /> الإجابات
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border px-3 py-1.5 min-w-[78px] text-center">
      <div className="text-[10px] text-muted-foreground font-bold">{label}</div>
      <div className="text-sm font-black tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}
