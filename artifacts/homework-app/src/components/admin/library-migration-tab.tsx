import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw, Wrench } from "lucide-react";
import { Button, Card, Input } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface MigrationRecord {
  fileId: number;
  teacherId: number;
  teacherName: string | null;
  teacherEmail: string | null;
  fileName: string | null;
  sourcePath: string;
  targetPath: string | null;
  state: "pending" | "copied" | "committed";
  attemptCount: number;
  lastError: string | null;
  blockedAt: string;
}

interface MigrationResponse {
  count: number;
  records: MigrationRecord[];
}

export function LibraryMigrationTab({ lang }: { lang: "ar" | "en" }) {
  const [data, setData] = useState<MigrationResponse>({ count: 0, records: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/library-legacy-migrations`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      toast.error(lang === "ar" ? "تعذر تحميل حالات الترحيل" : "Could not load migration cases");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => { void load(); }, [load]);

  async function act(fileId: number, action: "retry" | "close") {
    setBusyId(fileId);
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/library-legacy-migrations/${fileId}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: action === "close" ? JSON.stringify({ note: note.trim() }) : undefined,
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message);
      toast.success(action === "retry"
        ? (lang === "ar" ? "أُعيدت الحالة إلى طابور المحاولة" : "Migration queued for retry")
        : (lang === "ar" ? "أُغلقت الحالة وسُجل الإجراء" : "Case closed and audited"));
      setClosingId(null);
      setNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error && error.message
        ? error.message
        : (lang === "ar" ? "تعذر تنفيذ الإجراء" : "Action failed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Wrench className="h-5 w-5 text-amber-600" />
            {lang === "ar" ? "صيانة ملفات المكتبة القديمة" : "Legacy library maintenance"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "ar"
              ? "حالات توقفت بأمان وتحتاج إصلاح كائن التخزين أو إغلاقًا إداريًا موثقًا."
              : "Safely blocked cases requiring storage repair or an audited manual closure."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
            {data.count} {lang === "ar" ? "متوقفة" : "blocked"}
          </span>
          <Button variant="outline" className="px-3 py-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : data.records.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          <p className="font-bold">{lang === "ar" ? "لا توجد حالات ترحيل متوقفة" : "No blocked migrations"}</p>
        </Card>
      ) : data.records.map((record) => (
        <Card key={record.fileId} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="font-black">{record.fileName || `#${record.fileId}`}</h3>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{record.state}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {record.teacherName || `#${record.teacherId}`}
                {record.teacherEmail ? ` · ${record.teacherEmail}` : ""}
                {" · "}{new Date(record.blockedAt).toLocaleString(lang === "ar" ? "ar" : "en")}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {lang === "ar" ? "المحاولات" : "Attempts"}: {record.attemptCount}
            </span>
          </div>

          {record.lastError && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{record.lastError}</p>
          )}

          <div className="mt-3 space-y-2">
            {[
              [lang === "ar" ? "المصدر" : "Source", record.sourcePath],
              [lang === "ar" ? "الهدف" : "Target", record.targetPath],
            ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, path]) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <span className="shrink-0 text-xs font-bold">{label}</span>
                <code dir="ltr" className="min-w-0 flex-1 truncate text-xs text-start">{path}</code>
                <button
                  className="rounded p-1 hover:bg-muted"
                  onClick={() => { void navigator.clipboard.writeText(path); toast.success(lang === "ar" ? "تم النسخ" : "Copied"); }}
                  aria-label={lang === "ar" ? "نسخ المسار" : "Copy path"}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {closingId === record.fileId ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="mb-2 text-sm font-bold">
                {lang === "ar" ? "سبب الإغلاق اليدوي (سيُحفظ في سجل التدقيق)" : "Manual closure reason (saved to audit log)"}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
                <Button
                  variant="destructive"
                  className="shrink-0 px-4 py-2"
                  disabled={note.trim().length < 3 || busyId === record.fileId}
                  onClick={() => void act(record.fileId, "close")}
                >
                  {lang === "ar" ? "اعتماد الإغلاق" : "Confirm closure"}
                </Button>
                <Button variant="ghost" className="shrink-0 px-4 py-2" onClick={() => { setClosingId(null); setNote(""); }}>
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="px-4 py-2" disabled={busyId === record.fileId} onClick={() => void act(record.fileId, "retry")}>
                {busyId === record.fileId && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {lang === "ar" ? "إعادة المحاولة" : "Retry"}
              </Button>
              <Button variant="outline" className="px-4 py-2" onClick={() => setClosingId(record.fileId)}>
                {lang === "ar" ? "إغلاق يدوي موثق" : "Audited manual closure"}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}