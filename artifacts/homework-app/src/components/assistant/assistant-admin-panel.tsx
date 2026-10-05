import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Power, RefreshCw } from "lucide-react";
import {
  getListAdminAssistantOperationsQueryKey,
  useListAdminAssistantOperations,
  useUpdateAssistantAvailability,
} from "@workspace/api-client-react";

export function AssistantAdminPanel({ lang }: { lang: string }) {
  const ar = lang === "ar";
  const tr = (a: string, e: string) => (ar ? a : e);
  const qc = useQueryClient();
  const q = useListAdminAssistantOperations();
  const update = useUpdateAssistantAvailability();
  const [teacherIds, setTeacherIds] = useState("");
  useEffect(() => { if (q.data) setTeacherIds((q.data.teacherIds ?? []).join(", ")); }, [q.data]);
  const enabled = q.data?.enabled ?? true;
  const ops = q.data?.operations ?? [];

  function toggle() {
    update.mutate({ data: { enabled: !enabled } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAdminAssistantOperationsQueryKey() }),
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="panel-assistant-admin">
      <div className="flex items-center gap-2">
        <h3 className="font-extrabold text-base">{tr("إنشاء المحتوى بمساعد حصاد", "Hasaad Assistant content creation")}</h3>
        <span className={`ms-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${enabled ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{enabled ? tr("مفعّل", "Enabled") : tr("متوقف", "Paused")}</span>
        <button type="button" onClick={() => q.refetch()} className="p-1.5 rounded-lg hover:bg-muted" aria-label={tr("تحديث", "Refresh")}><RefreshCw className={`w-4 h-4 ${q.isFetching ? "animate-spin" : ""}`} /></button>
        <button type="button" onClick={toggle} disabled={update.isPending || q.isLoading || q.isError} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${enabled ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`} data-testid="button-assistant-kill-switch">
          {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
          {enabled ? tr("إيقاف الإنشاء", "Pause creation") : tr("تشغيل الإنشاء", "Resume creation")}
        </button>
      </div>
      {q.data && <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={q.data.pilotOnly ?? true} disabled={update.isPending} onChange={e => update.mutate({ data: { enabled, pilotOnly: e.target.checked } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListAdminAssistantOperationsQueryKey() }) })} />{tr("إطلاق تجريبي: الإدارة والحسابات المحددة فقط", "Pilot: admins and selected accounts only")}</label>
        <p className="text-[11px] text-muted-foreground">{tr("أرقام حسابات المعلمين المسموح لها، مفصولة بفواصل. إلغاء التجربة يتيح الإنشاء للجميع؛ الإيقاف لا يمنع متابعة الطلبات المقبولة.", "Allowed teacher account IDs, comma-separated. Turning pilot off opens creation to everyone. Pausing does not stop accepted jobs.")}</p>
        <div className="flex gap-2"><input aria-label={tr("حسابات التجربة", "Pilot account IDs")} dir="ltr" value={teacherIds} onChange={e => setTeacherIds(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 bg-background" /><button type="button" disabled={update.isPending || teacherIds.trim() !== "" && !/^\d+(\s*,\s*\d+)*$/.test(teacherIds.trim())} className="rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-40" onClick={() => update.mutate({ data: { enabled, teacherIds: teacherIds.split(",").map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0) } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListAdminAssistantOperationsQueryKey() }) })}>{tr("حفظ الحسابات", "Save accounts")}</button></div>
      </div>}
      {update.isError && <p className="text-xs text-destructive">{tr("تعذّر تحديث الحالة", "Could not update availability")}</p>}
      {q.isLoading && <div className="h-16 rounded-xl bg-muted animate-pulse" />}
      {q.isError && <p className="text-xs text-destructive">{tr("تعذّر تحميل العمليات", "Could not load operations")}</p>}
      {!q.isLoading && !q.isError && ops.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{tr("لا توجد عمليات بعد", "No operations yet")}</p>}
      <div className="max-h-72 overflow-y-auto divide-y divide-border">
        {ops.map((o) => (
          <div key={o.id} className="flex items-center gap-3 py-2 text-xs" data-testid={`row-admin-operation-${o.id}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{tr("الحساب", "Account")} {o.teacherId ?? "—"} · {o.id.slice(0, 8)}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(o.updatedAt).toLocaleString(ar ? "ar" : "en")}{o.errorCode ? ` · ${o.errorCode}` : ""}</div>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{ar ? { draft: "مسودة", quoted: "بانتظار التأكيد", queued: "في الانتظار", running: "جارٍ الإنشاء", saving: "جارٍ الحفظ", completed: "مكتمل", failed: "لم يكتمل", cancelled: "ملغى" }[o.status] : o.status}</span>
            <span className="w-14 text-end tabular-nums">{o.credits} {tr("ن", "cr")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
