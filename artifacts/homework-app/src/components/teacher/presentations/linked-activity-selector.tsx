/**
 * Compact selector shown in the editor topbar that lets the teacher
 * link the deck to one of their existing assignments. Mirrors the
 * visual language of `<ClassSelector />` so the topbar stays cohesive.
 *
 * Reads the current link via `useGetPresentationLinkedActivity`,
 * mutates via `useLinkPresentationActivity`. Pass `null` to detach.
 *
 * Phase 2A also exposes a small "open activity" affordance next to
 * the selector when a link exists, plus a "create new activity" CTA
 * inside the dropdown that opens `/teacher/new-activity` in a new
 * tab so the teacher doesn't lose their editing context.
 */
import { useMemo, useState } from "react";
import {
  useListAssignments,
  useLinkPresentationActivity,
  useGetPresentationLinkedActivity,
  getGetPresentationLinkedActivityQueryKey,
  getListAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { Link2, Check, X as XIcon, Loader2, ChevronDown, ExternalLink, Plus } from "lucide-react";

const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

export function LinkedActivitySelector({
  presentationId, isAr, disabled,
}: {
  presentationId: number;
  isAr: boolean;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  /* `query` requires a `queryKey` field per orval's generated type;
     supply the helper-built key explicitly so we never need an `any`
     cast just to pass `enabled`. */
  const linkedQ = useGetPresentationLinkedActivity(presentationId, {
    query: {
      enabled: Number.isFinite(presentationId),
      queryKey: getGetPresentationLinkedActivityQueryKey(presentationId),
    },
  });
  const assignmentsQ = useListAssignments(undefined, {
    query: {
      enabled: open,
      queryKey: getListAssignmentsQueryKey(),
    },
  });
  const linkMutation = useLinkPresentationActivity();

  /* `useGetPresentationLinkedActivity` is generated from the OpenAPI
     contract — `link` is part of the response shape (nullable string),
     so no local cast is needed. */
  const linked = linkedQ.data?.activity ?? null;
  const linkHref = linkedQ.data?.link ?? (linked ? `/teacher/assignment/${linked.id}` : null);

  const filtered = useMemo(() => {
    /* The server already excludes assignments whose
       `from_presentation_slide` column is set (see assignments.ts
       `notFromPresentation`), so we don't filter again here — and
       therefore avoid reading a server-only column on the client. */
    const rows = assignmentsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => (a.title ?? "").toLowerCase().includes(q));
  }, [assignmentsQ.data, search]);

  const apply = (activityId: number | null) => {
    linkMutation.mutate(
      { id: presentationId, data: { activityId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetPresentationLinkedActivityQueryKey(presentationId) });
          toast.success(isAr ? (activityId ? "تم الربط" : "تم فك الربط") : (activityId ? "Linked" : "Unlinked"));
          setOpen(false);
        },
        onError: () => {
          toast.error(isAr ? "تعذّر الربط" : "Failed to link");
        },
      },
    );
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg border text-xs font-bold transition-colors disabled:opacity-50"
        style={{
          background: linked ? `${BRAND_GREEN}10` : "white",
          color: linked ? BRAND_GREEN : "#475569",
          borderColor: linked ? `${BRAND_GREEN}40` : "#e5e7eb",
        }}
        title={isAr ? "النشاط المرتبط" : "Linked activity"}
      >
        <Link2 className="w-3.5 h-3.5" />
        <span className="hidden md:inline max-w-[140px] truncate">
          {linkedQ.isLoading
            ? "…"
            : linked
              ? linked.title
              : (isAr ? "اربط بنشاط" : "Link activity")}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {linked && linkHref && (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-8 h-9 rounded-lg border bg-white hover:bg-emerald-50/60 transition-colors"
          style={{ borderColor: `${BRAND_GREEN}40`, color: BRAND_GREEN }}
          title={isAr ? "افتح النشاط" : "Open activity"}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute z-40 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-border overflow-hidden"
            style={{ [isAr ? "right" : "left"]: 0 } as React.CSSProperties}
          >
            <div className="px-3 py-2 border-b border-border" style={{ background: `${BRAND_GOLD}10` }}>
              <div className="text-xs font-extrabold" style={{ color: BRAND_GREEN }}>
                {isAr ? "اربط العرض بنشاط" : "Link to activity"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {isAr ? "يظهر هذا العرض في صفحة النشاط المختار." : "Shows this deck on the chosen activity page."}
              </div>
            </div>
            {linked && (
              <button
                onClick={() => apply(null)}
                disabled={linkMutation.isPending}
                className="w-full px-3 py-2 text-start text-xs font-bold flex items-center gap-2 hover:bg-red-50 text-red-600 border-b border-border"
              >
                <XIcon className="w-3.5 h-3.5" />
                {isAr ? `فك ربط «${linked.title}»` : `Unlink "${linked.title}"`}
              </button>
            )}
            <div className="p-2 border-b border-border">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? "ابحث…" : "Search…"}
                className="w-full px-2 py-1.5 text-xs border border-border rounded outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {assignmentsQ.isLoading && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
              {!assignmentsQ.isLoading && filtered.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {isAr ? "لا توجد أنشطة." : "No activities."}
                </div>
              )}
              {filtered.map((a) => {
                const isCurrent = linked?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => apply(a.id)}
                    disabled={linkMutation.isPending || isCurrent}
                    className="w-full px-3 py-2 text-start text-xs flex items-center gap-2 hover:bg-emerald-50/40 disabled:opacity-50"
                  >
                    {isCurrent ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                    <span className="truncate flex-1 font-medium">{a.title}</span>
                  </button>
                );
              })}
            </div>
            <a
              href="/teacher/new"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-3 py-2 text-start text-xs font-bold flex items-center gap-2 border-t border-border hover:bg-emerald-50/60"
              style={{ color: BRAND_GREEN, background: `${BRAND_GREEN}06` }}
            >
              <Plus className="w-3.5 h-3.5" />
              {isAr ? "إنشاء نشاط جديد" : "Create new activity"}
              <ExternalLink className="w-3 h-3 opacity-60 ms-auto" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
