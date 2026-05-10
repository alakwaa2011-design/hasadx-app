import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  useBuildPresentationFromDraft,
  useCancelPresentationBuild,
  useGetPresentationDraft,
  getGetPresentationDraftQueryKey,
  type BuildPresentationResponse,
  type PresentationDraft,
} from "@workspace/api-client-react";

const BRAND_GREEN = "#225739";

interface Props {
  draftId: number;
  totalSlides: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /* Optional theme/pattern/cover overrides forwarded to the build
     endpoint. When omitted the server falls back to "harvest" / solid
     / 📚 — keeps the UI flexible for a future theme picker. */
  theme?: string;
  pattern?: string;
  coverEmoji?: string;
  onSuccess?: (presentationId: number) => void;
  /* When true (default), the modal navigates straight to
     /teacher/presentations/:id?draftId=N as soon as the build
     completes successfully. Set to false for callers that want to
     keep the modal open for inspection. */
  autoRedirect?: boolean;
}

interface SseProgress {
  current: number;
  total: number;
  warnings?: string[];
  skipped?: number[];
}

interface BuiltSlidePreview {
  index: number;
  title: string;
  kind?: string;
}

/* Pull a sensible title out of an arbitrary slide payload — the real
   shape is the union from `slidesSchema`, but for the preview strip
   we only need a stable readable label. */
function previewFromSlide(payload: unknown, index: number): BuiltSlidePreview {
  const s = (payload ?? {}) as Record<string, unknown>;
  const titleField = typeof s.title === "string" ? s.title : "";
  let textElTitle = "";
  const els = Array.isArray(s.elements) ? (s.elements as Array<Record<string, unknown>>) : [];
  for (const el of els) {
    if (el?.kind === "text" && typeof el.text === "string" && el.text.trim()) {
      textElTitle = String(el.text).slice(0, 60);
      break;
    }
  }
  return {
    index,
    title: titleField || textElTitle || `Slide ${index + 1}`,
    kind: typeof s.kind === "string" ? s.kind : undefined,
  };
}

/* Phase 1B — build-progress modal.
   Drives a real progress bar by SSE-streaming the build progress
   from the server (`/presentations/ai/build/:id/stream`) with a
   polling query as fallback if the EventSource fails. The build
   mutation itself blocks until the build finishes; the parallel
   stream is what makes the bar move. Includes a cancel button that
   calls the cancel endpoint — the server flips an in-memory flag,
   the build loop exits early, and the partial deck is preserved so
   the teacher can pick up in the editor. */
export function BuildProgress({
  draftId,
  totalSlides,
  open,
  onOpenChange,
  theme,
  pattern,
  coverEmoji,
  onSuccess,
  autoRedirect = true,
}: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [, navigate] = useLocation();

  const [result, setResult] = useState<BuildPresentationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [sseProgress, setSseProgress] = useState<SseProgress | null>(null);
  const [sseFailed, setSseFailed] = useState(false);
  const [builtSlides, setBuiltSlides] = useState<BuiltSlidePreview[]>([]);
  const startedRef = useRef(false);
  const redirectedRef = useRef(false);

  const build = useBuildPresentationFromDraft({
    mutation: {
      onSuccess: (data: BuildPresentationResponse) => {
        setResult(data);
        if (data.presentationId > 0) {
          onSuccess?.(data.presentationId);
          /* Auto-redirect on a successful, non-cancelled build per
             spec. On cancel, the deck still exists (partial), but
             we leave the modal open so the teacher can decide
             whether to open the editor or close. */
          if (autoRedirect && !data.cancelled && !redirectedRef.current) {
            redirectedRef.current = true;
            onOpenChange(false);
            navigate(`/teacher/presentations/${data.presentationId}?draftId=${draftId}`);
          }
        }
      },
      onError: (err: unknown) => {
        const e = err as { data?: { message?: string } };
        setError(
          e?.data?.message ?? (isAr ? "تعذّر بناء العرض. حاول مرة أخرى." : "Build failed. Please retry."),
        );
      },
    },
  });

  const cancel = useCancelPresentationBuild();

  /* Polling fallback — only enabled when SSE failed or the browser
     blocked the EventSource. Keeps the bar moving so the teacher
     never sees a frozen "0/N" spinner. */
  const { data: draftPolled } = useGetPresentationDraft(draftId, {
    query: {
      queryKey: getGetPresentationDraftQueryKey(draftId),
      enabled: open && build.isPending && sseFailed && !result && !error,
      refetchInterval: 800,
      refetchIntervalInBackground: false,
      staleTime: 0,
    },
  });

  /* Kick off the build once when the dialog opens, reset on close. */
  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      build.mutate({
        draftId,
        data: {
          ...(theme ? { theme } : {}),
          ...(pattern ? { pattern } : {}),
          ...(coverEmoji ? { coverEmoji } : {}),
        },
      });
    }
    if (!open) {
      startedRef.current = false;
      redirectedRef.current = false;
      setResult(null);
      setError(null);
      setCancelRequested(false);
      setSseProgress(null);
      setSseFailed(false);
      setBuiltSlides([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftId]);

  /* Open the SSE stream alongside the mutation so the modal sees
     per-slide events the moment they hit the DB. Falls back to
     polling if EventSource errors before the first event. */
  useEffect(() => {
    if (!open || !build.isPending) return;
    const apiBase = (import.meta.env?.VITE_API_URL ?? "") as string;
    const url = `${apiBase}/api/presentations/ai/build/${draftId}/stream`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(url, { withCredentials: true });
    } catch {
      setSseFailed(true);
      return;
    }
    let gotAnyEvent = false;
    es.addEventListener("progress", (ev) => {
      gotAnyEvent = true;
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        if (data?.buildProgress) setSseProgress(data.buildProgress as SseProgress);
      } catch { /* ignore malformed event */ }
    });
    es.addEventListener("slide", (ev) => {
      gotAnyEvent = true;
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          index: number; slide: unknown;
        };
        const preview = previewFromSlide(data.slide, data.index);
        setBuiltSlides((prev) => {
          if (prev.some((p) => p.index === preview.index)) return prev;
          return [...prev, preview].sort((a, b) => a.index - b.index);
        });
      } catch { /* ignore malformed event */ }
    });
    es.addEventListener("done", () => {
      gotAnyEvent = true;
      es?.close();
    });
    es.onerror = () => {
      if (!gotAnyEvent) setSseFailed(true);
      es?.close();
    };
    return () => { es?.close(); };
  }, [open, build.isPending, draftId]);

  const progress = useMemo(() => {
    /* Prefer live SSE values; fall back to polling-driven draft. */
    const bp = sseProgress
      ?? (draftPolled as PresentationDraft | undefined)?.buildProgress
      ?? null;
    const current = bp?.current ?? 0;
    const total = bp?.total ?? totalSlides;
    const warnings = bp?.warnings ?? [];
    const skipped = bp?.skipped ?? [];
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    return { current, total, warnings, skipped, pct };
  }, [sseProgress, draftPolled, totalSlides]);

  const done = !!result;
  const failed = !!error;

  const handleCancel = () => {
    if (cancelRequested || done || failed) return;
    setCancelRequested(true);
    cancel.mutate({ draftId });
  };

  const liveWarnings = done ? result.warnings : progress.warnings;
  const liveSkipped = done ? (result.skipped ?? []) : progress.skipped;
  const partialOnCancel = done && result.cancelled && result.presentationId > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        /* Block accidental close while a build is in flight — force
           use of the Cancel button to flip the server flag. */
        if (!o && build.isPending && !done && !failed) return;
        onOpenChange(o);
      }}
    >
      <DialogContent dir={isAr ? "rtl" : "ltr"} className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: BRAND_GREEN }}>
            <Sparkles className="h-5 w-5" />
            {done
              ? (result.cancelled
                  ? (isAr ? "أُلغي البناء" : "Build cancelled")
                  : (isAr ? "تم بناء العرض" : "Deck built"))
              : failed
                ? (isAr ? "تعذّر البناء" : "Build failed")
                : cancelRequested
                  ? (isAr ? "جارٍ الإلغاء…" : "Cancelling…")
                  : (isAr ? "جارٍ بناء الشرائح…" : "Building slides…")}
          </DialogTitle>
          <DialogDescription>
            {done
              ? (result.cancelled
                  ? (isAr
                      ? `حُفظت ${result.presentationId > 0 ? "الشرائح المبنية حتى الآن" : "حالة المخطط"} — يمكنك إكمالها في المحرر.`
                      : "Slides built so far were saved — pick up in the editor.")
                  : (isAr
                      ? `أصبح العرض جاهزاً في المحرر${liveWarnings.length ? ` (${liveWarnings.length} ملاحظة)` : ""}.`
                      : `Your deck is ready in the editor${liveWarnings.length ? ` (${liveWarnings.length} notes)` : ""}.`))
              : failed
                ? (isAr ? "حدث خطأ أثناء البناء." : "Something went wrong while building.")
                : (isAr
                    ? `نُحضّر ${progress.total || totalSlides} شريحة من المخطط الذي اعتمدته.`
                    : `Materializing ${progress.total || totalSlides} slides from your approved outline.`)}
          </DialogDescription>
        </DialogHeader>

        {!done && !failed && (
          <div className="space-y-3 py-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(4, progress.pct)}%`, background: BRAND_GREEN }}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isAr
                  ? `الشريحة ${progress.current} من ${progress.total || totalSlides}`
                  : `Slide ${progress.current} of ${progress.total || totalSlides}`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={cancelRequested}
                onClick={handleCancel}
                className="h-7 px-2 text-rose-700 hover:bg-rose-50"
              >
                <X className="me-1 h-3.5 w-3.5" />
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
            </div>
            {/* Live slide-preview strip — populated by `slide` SSE
                events. Each card appears the instant the server
                persists it to the deck so the teacher watches their
                deck materialize in real time. */}
            {builtSlides.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">
                  {isAr
                    ? `الشرائح الجاهزة (${builtSlides.length})`
                    : `Built slides (${builtSlides.length})`}
                </div>
                <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
                  {builtSlides.map((s) => (
                    <div
                      key={s.index}
                      className="rounded border bg-white p-2 text-xs shadow-sm"
                      style={{ borderColor: `${BRAND_GREEN}33` }}
                      title={s.title}
                    >
                      <div className="mb-0.5 font-mono text-[10px] text-slate-400">
                        #{s.index + 1}
                      </div>
                      <div className="line-clamp-2 leading-snug text-slate-700">
                        {s.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {liveWarnings.length > 0 && (
              <div className="max-h-24 space-y-0.5 overflow-y-auto rounded border bg-slate-50 p-2 text-xs text-slate-600">
                {liveWarnings.slice(-5).map((w, i) => (
                  <div key={i} className="leading-snug">• {w}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="space-y-3 py-2">
            <div className={`flex items-center gap-2 text-sm ${result.cancelled ? "text-slate-700" : "text-emerald-700"}`}>
              <CheckCircle2 className="h-5 w-5" />
              {result.cancelled
                ? (isAr
                    ? `تم الإلغاء — العرض مع ${progress.current || 0} شريحة جاهز للتعديل.`
                    : `Cancelled — your partial deck (${progress.current || 0} slides) is ready to edit.`)
                : (isAr ? "اكتمل البناء بنجاح." : "Build complete.")}
            </div>
            {liveSkipped.length > 0 && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {isAr
                    ? `تخطّينا ${liveSkipped.length} شريحة (تحقق منها يدوياً)`
                    : `Skipped ${liveSkipped.length} slide(s) — please author manually`}
                </div>
                <div className="opacity-80">
                  {isAr ? "الشرائح:" : "Slides:"} {liveSkipped.join(", ")}
                </div>
              </div>
            )}
            {liveWarnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {isAr ? "ملاحظات:" : "Notes:"}
                </div>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto pr-2">
                  {liveWarnings.slice(0, 8).map((w, i) => (
                    <li key={i} className="leading-snug">• {w}</li>
                  ))}
                  {liveWarnings.length > 8 && (
                    <li className="italic opacity-70">
                      {isAr ? `…و${liveWarnings.length - 8} أخرى` : `…and ${liveWarnings.length - 8} more`}
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {isAr ? "إغلاق" : "Close"}
              </Button>
              {(result.presentationId > 0) && (
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/teacher/presentations/${result.presentationId}?draftId=${draftId}`);
                  }}
                  style={{ background: BRAND_GREEN }}
                >
                  {partialOnCancel
                    ? (isAr ? "أكمل في المحرر" : "Continue in editor")
                    : (isAr ? "افتح المحرر" : "Open editor")}
                </Button>
              )}
            </div>
          </div>
        )}

        {failed && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {error}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {isAr ? "إغلاق" : "Close"}
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  startedRef.current = true;
                  build.mutate({
                    draftId,
                    data: {
                      ...(theme ? { theme } : {}),
                      ...(pattern ? { pattern } : {}),
                      ...(coverEmoji ? { coverEmoji } : {}),
                    },
                  });
                }}
                style={{ background: BRAND_GREEN }}
              >
                {isAr ? "أعد المحاولة" : "Retry"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BuildProgress;
