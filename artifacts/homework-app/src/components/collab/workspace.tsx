import { useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, EyeOff, Eye, Maximize2, Printer, Download, Copy, Settings, Users, Timer, Play, Pause, Lock, Unlock,
  Archive, RotateCcw, Link2, Sparkles, WifiOff, X, Ban, Megaphone, Loader2, MoreHorizontal, ClipboardCheck, Undo2, Square,
} from "lucide-react";
import {
  useCreateCollaborationBoard, createCollaborationBoard, getListCollaborationBoardsQueryKey,
  type CollaborationView, type CollaborationPost, type CollaborationAction, type CollaborationSettings, type CollaborationColumn,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  useBoard, useAct, newId, errMessage, errStatus, mediaUrl, COLORS, useCountdown, fmtTime,
  useOnline, exportCsv, loadSession,
} from "@/lib/collab";
import { Modal, Field, inputCls, btnPrimary, btnGhost, SettingsEditor, Skeleton, StatusPill, ImageThumb, GREEN, GOLD } from "./parts";
import { Composer } from "./composer";
import { PostCard } from "./post-card";
import { ReviewPanel } from "./review-panel";
import { collaborationRequest } from "@/lib/collab-request";

export function BoardWorkspace({ id }: { id: string }) {
  const q = useBoard(id);
  const act = useAct(id);
  const online = useOnline();
  const [err, setErr] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ post?: CollaborationPost } | null>(null);
  const [panel, setPanel] = useState<null | "settings" | "people" | "timer" | "share" | "more" | "review">(null);
  const [display, setDisplay] = useState(false);
  const [search, setSearch] = useState("");
  const [colF, setColF] = useState("all");
  const [tagF, setTagF] = useState("all");
  const [view, setView] = useState("all");
  const [sort, setSort] = useState("new");
  const b = q.data;
  const left = useCountdown(b?.timerEndsAt);
  const reviewOp = useRef<{ key: string; id: string } | null>(null);
  const undoOp = useRef<string | null>(null);
  const [lastReview, setLastReview] = useState<{ reviewId: string; status: "approved" | "rejected"; count: number } | null>(null);
  const [undoUncertain, setUndoUncertain] = useState(false);
  const [undoNote, setUndoNote] = useState<string | null>(null);
  const [uncertainReview, setUncertainReview] = useState<{ ids: string[]; status: "approved" | "rejected" } | null>(null);

  const run = async (data: CollaborationAction) => {
    setErr(null);
    if (!navigator.onLine) {
      setErr("أنت غير متصل. لم تُرسل العملية. أعد المحاولة بعد عودة الاتصال.");
      return false;
    }
    try { await act.mutateAsync({ id, data }); return true; } catch (e) { setErr(errMessage(e)); return false; }
  };

  // The operation ID is reused for an identical retry so an uncertain outcome can never apply twice.
  const review = async (ids: string[], status: "approved" | "rejected") => {
    if (!ids.length) return false;
    const key = `${status}:${[...ids].sort().join(",")}`;
    if (reviewOp.current?.key !== key) reviewOp.current = { key, id: newId() };
    const clientId = reviewOp.current.id;
    const ok = await run({ type: "post.review", postIds: ids, reviewStatus: status, clientId });
    if (ok) {
      reviewOp.current = null; undoOp.current = null;
      setLastReview({ reviewId: clientId, status, count: ids.length });
      setUndoUncertain(false); setUndoNote(null);
      setUncertainReview(null);
    } else setUncertainReview({ ids: [...ids], status });
    return ok;
  };
  const undoReview = async () => {
    if (!lastReview) return;
    undoOp.current ??= newId();
    const ok = await run({ type: "post.review.undo", reviewId: lastReview.reviewId, clientId: undoOp.current });
    if (ok) { undoOp.current = null; setLastReview(null); setUndoUncertain(false); setUndoNote("تم التراجع: عادت المشاركات إلى قائمة الانتظار."); }
    else setUndoUncertain(true);
  };
  const timerOp = useRef<{ key: string; id: string } | null>(null);
  const timerCmd = async (timerCommand: "start" | "pause" | "resume" | "extend" | "stop", timerSeconds?: number) => {
    const key = `${timerCommand}:${timerSeconds ?? ""}`;
    if (timerOp.current?.key !== key) timerOp.current = { key, id: newId() };
    const clientId = timerOp.current.id;
    const ok = await run(timerSeconds === undefined ? { type: "board.timer", timerCommand, clientId } : { type: "board.timer", timerCommand, timerSeconds, clientId });
    if (ok) timerOp.current = null;
    return ok;
  };

  const posts = useMemo(() => {
    if (!b) return [];
    const s = search.trim().toLowerCase();
    const score = (p: CollaborationPost) => p.reactions.reduce((a, r) => a + r.count, 0);
    return b.posts
      .filter((p) => (colF === "all" || p.columnId === colF) && (tagF === "all" || p.tags.includes(tagF)))
      .filter((p) => view === "all" || (view === "mine" && p.own) || (view === "pending" && p.status === "pending") || (view === "hidden" && p.hidden) || (view === "rejected" && p.status === "rejected") || (view === "pinned" && p.pinned))
      .filter((p) => !s || p.text.toLowerCase().includes(s) || p.authorName.toLowerCase().includes(s) || p.tags.some((t) => t.toLowerCase().includes(s)))
      .sort((a, c) => Number(c.pinned) - Number(a.pinned) || (sort === "top" ? score(c) - score(a) : sort === "old" ? +new Date(a.createdAt) - +new Date(c.createdAt) : +new Date(c.createdAt) - +new Date(a.createdAt)));
  }, [b, search, colF, tagF, view, sort]);

  if (q.isLoading) return <div className="p-4 grid gap-3 sm:grid-cols-3"><Skeleton className="h-24 sm:col-span-3" /><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (!b || (q.isError && [401, 403].includes(errStatus(q.error) ?? 0))) {
    const st = errStatus(q.error);
    const guest = !loadSession(id);
    return (
      <div className="max-w-sm mx-auto text-center py-16 px-4">
        <WifiOff className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h2 className="font-extrabold mb-1">{st === 404 ? "اللوحة غير موجودة" : st === 401 || st === 403 ? "لا تملك صلاحية دخول هذه اللوحة" : "تعذر تحميل اللوحة"}</h2>
        <p className="text-sm text-muted-foreground mb-4">{errMessage(q.error)}</p>
        <div className="flex gap-2 justify-center">
          <button className={`${btnPrimary}`} style={{ background: GREEN }} onClick={() => q.refetch()}>إعادة المحاولة</button>
          {guest && <Link href="/collaboration/join" className={btnGhost}>الانضمام برمز</Link>}
        </div>
      </div>
    );
  }

  const owner = b.owner;
  const canWrite = b.status === "open" || owner;
  const mine = b.posts.filter((p) => p.own && !p.teacher).length;
  const atLimit = !owner && mine >= b.settings.maxPosts;
  const pending = b.posts.filter((p) => p.status === "pending");
  const tags = Array.from(new Set(b.posts.flatMap((p) => p.tags)));
  const spot = b.posts.find((p) => p.id === b.spotlightId);
  const hiddenGallery = !owner && b.settings.silent && !b.settings.revealed;
  const paused = b.timerRemainingSeconds != null;
  const clock = paused ? b.timerRemainingSeconds ?? 0 : left;
  const clockShown = clock !== null && (paused || clock > 0);
  const busy = act.isPending;
  const locked = !online || busy;

  if (display) return <Display b={b} spot={spot} left={clock} paused={paused} onExit={() => { setDisplay(false); if (document.fullscreenElement) void document.exitFullscreen(); }} />;

  return (
    <div className="collab-root" dir="rtl">
      <style>{`@media print{.no-print{display:none!important}.collab-root{background:#fff}.collab-card{break-inside:avoid}header,nav,footer{display:none!important}}`}</style>
      {!online && <div role="status" className="bg-amber-100 text-amber-900 text-xs font-bold px-4 py-2 flex items-center gap-2 no-print"><WifiOff className="w-3.5 h-3.5 shrink-0" /> أنت غير متصل. المعروض آخر نسخة محمّلة؛ الإرسال متوقف. أعد المحاولة بعد عودة الاتصال، ولا توجد مزامنة تلقائية للمشاركات.</div>}
      {q.isRefetchError && online && <div className="bg-rose-100 text-rose-900 text-xs font-bold px-4 py-1.5 no-print">تعذر تحديث اللوحة مؤقتاً، نعيد المحاولة تلقائياً.</div>}

      <div className="px-4 pt-4 pb-3 border-b border-border" style={{ background: "linear-gradient(180deg,#f2f7f4,transparent)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 mb-1">
                <StatusPill status={b.status} />
                <span className="text-[11px] font-bold text-muted-foreground">رمز الانضمام</span>
                <span className="font-black tracking-[0.25em] text-sm px-2 rounded" style={{ background: GOLD + "33", color: GREEN }} data-testid="text-pin">{b.pin}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black leading-tight" style={{ color: GREEN }}>{b.title}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl whitespace-pre-wrap">{b.prompt}</p>
            </div>
            {clockShown && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="rounded-xl px-3 py-2 text-white font-black text-2xl tabular-nums" style={{ background: paused ? "#8a5a1c" : GREEN }} data-testid="text-timer"><Timer className="w-4 h-4 inline ms-1" />{fmtTime(clock ?? 0)}{paused && <span className="text-xs font-bold ms-2">متوقف مؤقتاً</span>}</div>
                {owner && <div className="flex gap-1.5 no-print">
                  <button className={`${btnGhost} min-h-[44px]`} disabled={locked} onClick={() => timerCmd(paused ? "resume" : "pause")} data-testid="button-timer-toggle">{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}{paused ? "استئناف" : "إيقاف مؤقت"}</button>
                  <button className={`${btnGhost} min-h-[44px]`} disabled={locked || (!paused && !clock)} onClick={() => timerCmd("extend")} data-testid="button-timer-extend"><Plus className="w-4 h-4" /> دقيقة</button>
                </div>}
              </div>
            )}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto no-print" data-testid="teacher-classroom-actions">
              {owner && <>
                <button className={`${btnPrimary} min-h-[44px]`} style={{ background: GREEN }} onClick={() => setPanel("share")} data-testid="button-share-board"><Link2 className="w-4 h-4" /> دعوة الطلاب</button>
                <button className={`${btnGhost} min-h-[44px]`} onClick={() => setDisplay(true)} data-testid="button-display"><Maximize2 className="w-4 h-4" /> عرض للصف</button>
                {b.status !== "archived" ? <button className={`${btnGhost} min-h-[44px]`} disabled={!online || act.isPending} onClick={() => run({ type: "board.status", status: b.status === "open" ? "closed" : "open" })} data-testid="button-toggle-participation">{b.status === "open" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}{b.status === "open" ? "إغلاق المشاركة" : "فتح اللوحة"}</button>
                  : <button className={`${btnGhost} min-h-[44px]`} disabled={!online || act.isPending} onClick={() => run({ type: "board.status", status: "draft" })}><RotateCcw className="w-4 h-4" /> استعادة من الأرشيف</button>}
                <button className={`${btnGhost} min-h-[44px]`} onClick={() => setPanel("more")} data-testid="button-board-more" aria-haspopup="dialog"><MoreHorizontal className="w-4 h-4" /> المزيد</button>
              </>}
            </div>
          </div>

          {owner && (
            <div role="status" aria-live="polite" className="text-xs text-muted-foreground mt-2 no-print">
              {!online ? "غير متصل — الإرسال متوقف" : act.isPending ? "جارٍ إرسال التغيير..." : err ? "لم يصل تأكيد العملية الأخيرة" : "آخر نسخة محمّلة من اللوحة"}
            </div>
          )}
          {err && <div role="alert" className="mt-3 text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 flex justify-between"><span>{err}</span><button onClick={() => setErr(null)}><X className="w-4 h-4" /></button></div>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {owner && uncertainReview && panel !== "review" && <div role="status" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm no-print">
          <p>لم يكتمل تأكيد قرار المراجعة. تحقق من نتيجته حتى إن اختفت المشاركات من قائمة الانتظار.</p>
          <button className={`${btnGhost} min-h-[44px] mt-2`} disabled={locked} onClick={() => review(uncertainReview.ids, uncertainReview.status)} data-testid="button-confirm-review-result">التحقق من قرار المراجعة</button>
        </div>}
        {owner && (lastReview || undoNote) && (
          <div role="status" className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 flex flex-wrap items-center gap-2 text-sm no-print" data-testid="bar-review-undo">
            {lastReview ? <>
              <span className="flex-1 font-bold text-emerald-900">{undoUncertain ? "لم يصل تأكيد التراجع؛ قد يكون نُفّذ أو لا. تحقق من اللوحة أو أعد المحاولة." : `تم ${lastReview.status === "approved" ? "اعتماد" : "رفض"} ${lastReview.count} مشاركة.`}</span>
              <button className={`${btnGhost} min-h-[44px]`} disabled={locked} onClick={undoReview} data-testid="button-undo-review"><Undo2 className="w-4 h-4" /> {undoUncertain ? "إعادة محاولة التراجع" : "تراجع عن المراجعة"}</button>
            </> : <>
              <span className="flex-1 font-bold text-emerald-900">{undoNote}</span>
              <button className="min-h-[44px] min-w-[44px]" aria-label="إغلاق" onClick={() => setUndoNote(null)}><X className="w-4 h-4" /></button>
            </>}
          </div>
        )}
        {owner && pending.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center gap-3 no-print" data-testid="banner-pending">
            <div className="flex-1 min-w-[200px]"><div className="text-sm font-extrabold text-amber-900">بانتظار موافقتك ({pending.length})</div><p className="text-xs text-amber-900/80">راجع النص والصورة كاملين ثم اعتمد أو ارفض.</p></div>
            <button className={`${btnPrimary} min-h-[44px]`} style={{ background: GREEN }} onClick={() => setPanel("review")} data-testid="button-open-review"><ClipboardCheck className="w-4 h-4" /> مراجعة المشاركات ({pending.length})</button>
          </div>
        )}
        {owner && b.settings.silent && !b.settings.revealed && <p className="mb-3 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">المعرض مخفي عن الطلاب (وضع الصمت). ترى أنت كل المشاركات.</p>}

        <div className="flex flex-wrap gap-2 items-center mb-4 no-print">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
            <input className={`${inputCls} ps-9`} placeholder="ابحث في المشاركات" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
          </div>
          <select className={`${inputCls} !w-auto`} value={colF} onChange={(e) => setColF(e.target.value)}>
            <option value="all">كل الأعمدة</option>{b.columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select className={`${inputCls} !w-auto`} value={tagF} onChange={(e) => setTagF(e.target.value)}>
            <option value="all">كل الوسوم</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={`${inputCls} !w-auto`} value={view} onChange={(e) => setView(e.target.value)}>
            <option value="all">الكل</option><option value="mine">مشاركاتي</option><option value="pinned">المثبتة</option>
            {owner && <><option value="pending">بانتظار الموافقة</option><option value="hidden">المخفية</option><option value="rejected">المرفوضة</option></>}
          </select>
          <select className={`${inputCls} !w-auto`} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">الأحدث</option><option value="old">الأقدم</option><option value="top">الأكثر تفاعلاً</option>
          </select>
          {canWrite ? (
            <button className={btnPrimary} style={{ background: GREEN }} disabled={atLimit} onClick={() => setComposer({})} data-testid="button-new-post">
              <Plus className="w-4 h-4" /> مشاركة جديدة
            </button>
          ) : <span className="text-xs font-bold text-amber-800 bg-amber-100 rounded-lg px-3 py-2">المشاركة مغلقة، يمكنك القراءة فقط</span>}
        </div>
        {atLimit && <p className="text-xs text-muted-foreground mb-3">وصلت للحد الأقصى ({b.settings.maxPosts}) من المشاركات.</p>}
        {!owner && b.settings.moderation && <p className="text-xs text-muted-foreground mb-3">مشاركاتك تُراجع من المعلم قبل ظهورها للجميع، والتعليقات للمعلم فقط.</p>}
        {!owner && b.settings.allowReactions && <p className="text-xs text-muted-foreground mb-3">رصيد التصويت: استخدمت {b.voteUsed} من {b.settings.voteBudget}.</p>}

        {hiddenGallery && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground mb-4" data-testid="text-hidden-gallery"><Megaphone className="w-6 h-6 mx-auto mb-2" />وضع الصمت: مشاركات الصف مخفية الآن، وترى مشاركاتك فقط حتى يكشف المعلم المعرض. هذا لا يعني أن اللوحة فارغة.</div>}

        {b.posts.length === 0 && hiddenGallery ? null : b.posts.length === 0 ? (
          <Empty canWrite={canWrite} onNew={() => setComposer({})} />
        ) : posts.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">لا نتائج مطابقة. غيّر البحث أو المرشحات.</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${b.columns.length > 2 ? 250 : 300}px),1fr))` }}>
            {b.columns.map((c) => {
              const list = posts.filter((p) => p.columnId === c.id);
              return (
                <section key={c.id} className="min-w-0 w-full max-w-[420px]">
                  <h3 className="text-sm font-black mb-2 flex items-center gap-2" style={{ color: GREEN }}>{c.title}<span className="text-[11px] font-bold text-muted-foreground">{list.length}</span></h3>
                  <div className="space-y-3">
                    {list.map((p) => <PostCard key={p.id} b={b} p={p} run={run} onReview={review} disabled={locked} onEdit={() => setComposer({ post: p })} canWrite={canWrite} />)}
                    {list.length === 0 && <div className="text-xs text-muted-foreground border border-dashed border-border rounded-xl p-4 text-center">لا مشاركات في هذا العمود</div>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {composer && <Composer key={`${id}:${b.selfId}:${composer.post?.id ?? "new"}`} id={id} b={b} post={composer.post} onClose={() => setComposer(null)} run={run} />}
      {panel === "settings" && <SettingsPanel b={b} busyAction={locked} onClose={() => setPanel(null)} run={run} />}
      {panel === "people" && <People b={b} onClose={() => setPanel(null)} run={run} />}
      {panel === "timer" && <TimerPanel b={b} paused={paused} clock={clock} busy={locked} onClose={() => setPanel(null)} cmd={timerCmd} />}
      {panel === "review" && owner && <ReviewPanel b={b} pending={pending} busy={locked} error={err} onReview={review} onRetry={uncertainReview ? () => review(uncertainReview.ids, uncertainReview.status) : undefined} onClose={() => setPanel(null)} />}
      {panel === "share" && <ShareBoard b={b} onClose={() => setPanel(null)} />}
      {panel === "more" && <Modal title="المزيد من أدوات اللوحة" onClose={() => setPanel(null)}>
        <div className="grid grid-cols-2 gap-2 [&>button]:min-h-[44px]">
          <button className={btnGhost} onClick={() => setPanel("timer")}><Timer className="w-4 h-4" /> المؤقت</button>
          <button className={btnGhost} onClick={() => setPanel("people")}><Users className="w-4 h-4" /> المشاركون ({b.members.length})</button>
          <button className={btnGhost} onClick={() => setPanel("settings")} data-testid="button-settings"><Settings className="w-4 h-4" /> الإعدادات</button>
          <button className={btnGhost} onClick={() => { exportCsv(b); setPanel(null); }}><Download className="w-4 h-4" /> CSV</button>
          <button className={btnGhost} onClick={() => window.print()}><Printer className="w-4 h-4" /> طباعة / PDF</button>
          <DuplicateButton b={b} disabled={!online} />
          {b.settings.silent && <button className={`${btnGhost} col-span-2`} disabled={!online || act.isPending} onClick={async () => { if (await run({ type: "board.reveal" })) setPanel(null); }}>{b.settings.revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {b.settings.revealed ? "إخفاء المعرض" : "كشف المعرض للطلاب"}</button>}
          {b.spotlightId && <button className={`${btnGhost} col-span-2`} disabled={!online || act.isPending} onClick={async () => { if (await run({ type: "board.spotlight" })) setPanel(null); }}><X className="w-4 h-4" /> إلغاء التسليط</button>}
        </div>
        {b.status !== "archived" && <div className="border-t border-border mt-4 pt-3"><button className={`${btnGhost} w-full min-h-[44px]`} disabled={!online || act.isPending} onClick={async () => { if (await run({ type: "board.status", status: "archived" })) setPanel(null); }}><Archive className="w-4 h-4" /> أرشفة</button></div>}
        {err && <p role="alert" className="text-sm text-rose-700 mt-3">{err}</p>}
      </Modal>}
    </div>
  );
}

function TimerPanel({ b, paused, clock, busy, onClose, cmd }: {
  b: CollaborationView; paused: boolean; clock: number | null; busy: boolean; onClose: () => void;
  cmd: (c: "start" | "pause" | "resume" | "extend" | "stop", seconds?: number) => Promise<boolean>;
}) {
  const [m, setM] = useState(3);
  const active = paused || !!b.timerEndsAt;
  const expired = !paused && clock === 0;
  return (
    <Modal title="مؤقت الجلسة" onClose={onClose}>
      {active && <div className="rounded-xl p-3 mb-3 text-center bg-muted/50"><div className="text-3xl font-black tabular-nums" style={{ color: GREEN }}>{fmtTime(clock ?? 0)}</div><div className="text-xs text-muted-foreground">{expired ? "انتهى الوقت" : paused ? "متوقف مؤقتاً" : "يعمل الآن"}</div>
        <div className="grid grid-cols-3 gap-2 mt-3 [&>button]:min-h-[44px]">
          <button className={btnGhost} disabled={busy || expired} onClick={() => cmd(paused ? "resume" : "pause")}>{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}{paused ? "استئناف" : "إيقاف مؤقت"}</button>
          <button className={btnGhost} disabled={busy || expired} onClick={() => cmd("extend")}><Plus className="w-4 h-4" /> دقيقة</button>
          <button className={btnGhost} disabled={busy} onClick={async () => (await cmd("stop")) && onClose()}><Square className="w-4 h-4" /> إيقاف</button>
        </div>
        {expired && <p className="text-[11px] text-muted-foreground mt-2">لا يمكن تمديد مؤقت انتهى؛ ابدأ مؤقتاً جديداً.</p>}
      </div>}
      <h3 className="text-sm font-extrabold mb-2">{active ? "بدء مؤقت جديد" : "مدة المؤقت"}</h3>
      <div className="flex flex-wrap gap-2 mb-3">{[1, 3, 5, 10, 15].map((x) => <button key={x} className={`${btnGhost} min-h-[44px] ${m === x ? "!border-[#1E4D35]" : ""}`} onClick={() => setM(x)}>{x} د</button>)}</div>
      <Field label="دقائق مخصصة (حتى 60)"><input type="number" min={1} max={60} className={inputCls} value={m} onChange={(e) => setM(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} /></Field>
      <div className="flex justify-end">
        <button className={`${btnPrimary} min-h-[44px]`} style={{ background: GREEN }} disabled={busy} onClick={async () => (await cmd("start", m * 60)) && onClose()}><Play className="w-4 h-4" /> ابدأ</button>
      </div>
    </Modal>
  );
}

function Empty({ canWrite, onNew }: { canWrite: boolean; onNew: () => void }) {
  return (
    <div className="text-center py-16 rounded-2xl border border-dashed border-border">
      <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: GOLD }} />
      <h3 className="font-extrabold mb-1">اللوحة بانتظار أول فكرة</h3>
      <p className="text-sm text-muted-foreground mb-4">كل فكرة صغيرة تصبح جزءاً من حصاد الصف.</p>
      {canWrite && <button className={btnPrimary} style={{ background: GREEN }} onClick={onNew}><Plus className="w-4 h-4" /> أضف فكرة</button>}
    </div>
  );
}

function SettingsPanel({ b, busyAction, onClose, run }: { b: CollaborationView; busyAction: boolean; onClose: () => void; run: (a: CollaborationAction) => Promise<boolean> }) {
  const [title, setTitle] = useState(b.title);
  const [prompt, setPrompt] = useState(b.prompt);
  const [settings, setSettings] = useState<CollaborationSettings>(b.settings);
  const [columns, setColumns] = useState<CollaborationColumn[]>(b.columns);
  const [busy, setBusy] = useState(false);
  const valid = title.trim() && prompt.trim() && columns.every((c) => c.title.trim());
  return (
    <Modal title="إعدادات اللوحة" onClose={onClose} wide>
      <h3 className="text-sm font-extrabold mb-2" style={{ color: GREEN }}>أساسيات اللوحة</h3>
      <Field label="العنوان"><input className={inputCls} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="السؤال أو التوجيه"><textarea className={inputCls} rows={3} maxLength={1000} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></Field>
      <SettingsEditor settings={settings} onSettings={setSettings} columns={columns} onColumns={setColumns} />
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 px-4 py-3 bg-background border-t border-border flex justify-end gap-2" data-testid="settings-actions">
        <button className={`${btnGhost} min-h-[44px] flex-1 sm:flex-none`} onClick={onClose}>إلغاء</button>
        <button className={`${btnPrimary} min-h-[44px] flex-1 sm:flex-none`} style={{ background: GREEN }} disabled={!valid || busy || busyAction} onClick={async () => {
          setBusy(true);
          const ok = await run({ type: "board.update", title: title.trim(), prompt: prompt.trim(), settings, columns: columns.map((c) => ({ ...c, title: c.title.trim() })) });
          setBusy(false);
          if (ok) onClose();
        }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} حفظ الإعدادات</button>
      </div>
    </Modal>
  );
}

function People({ b, onClose, run }: { b: CollaborationView; onClose: () => void; run: (a: CollaborationAction) => Promise<boolean> }) {
  return (
    <Modal title={`المشاركون (${b.members.length})`} onClose={onClose}>
      {b.members.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">لم ينضم أحد بعد. شارك الرمز {b.pin} مع الصف.</p> : (
        <ul className="divide-y divide-border">
          {b.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0" style={{ background: GREEN }}>{m.name.slice(0, 1)}</span>
              <div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{m.name}</div><div className="text-xs text-muted-foreground">{m.postCount} مشاركة{m.blocked && " - محظور"}</div></div>
              <button className={btnGhost} onClick={() => run({ type: "member.block", memberId: m.id })}><Ban className="w-4 h-4" /> {m.blocked ? "إلغاء الحظر" : "حظر"}</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function DuplicateButton({ b, disabled }: { b: CollaborationView; disabled?: boolean }) {
  const create = useCreateCollaborationBoard({
    mutation: {
      networkMode: "always", retry: false,
      mutationFn: ({ data }) => collaborationRequest(signal => createCollaborationBoard(data, { signal })),
    },
  });
  const retryId = useRef(newId());
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [e, setE] = useState<string | null>(null);
  return (
    <>
      <button className={btnGhost} disabled={disabled || create.isPending} title={e ?? undefined} onClick={async () => {
        setE(null);
        try {
          const nb = await create.mutateAsync({ data: { clientId: retryId.current, title: `${b.title} (نسخة)`.slice(0, 120), prompt: b.prompt, settings: { ...b.settings, revealed: b.settings.silent ? false : b.settings.revealed }, columns: b.columns } });
          qc.invalidateQueries({ queryKey: getListCollaborationBoardsQueryKey() });
          nav(`/teacher/collaboration/${nb.id}`);
        } catch (x) { setE(errMessage(x)); alert(errMessage(x)); }
      }}>{create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} نسخ اللوحة</button>
    </>
  );
}

function ShareBoard({ b, onClose }: { b: CollaborationView; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = new URL(`${import.meta.env.BASE_URL}collaboration/join/${b.pin}`, window.location.origin).toString();
  return <Modal title="دعوة الطلاب إلى اللوحة" onClose={onClose}>
    <div className="flex flex-col items-center gap-4 py-3">
      <div className="bg-white p-4 rounded-xl border"><QRCodeSVG value={url} size={190} marginSize={2} /></div>
      <div className="text-3xl font-black tracking-[0.25em]" dir="ltr">{b.pin}</div>
      <p className="text-sm text-muted-foreground text-center">يمسح الطالب الرمز أو يفتح الرابط ويكتب اسمه؛ لا يحتاج إلى حساب.</p>
      {b.status !== "open" && <p className="text-sm text-amber-800">افتح اللوحة من أدوات المعلم للسماح بالانضمام.</p>}
      <input className={inputCls} dir="ltr" readOnly value={url} aria-label="رابط انضمام الطلاب" />
      <button className={btnPrimary} style={{ background: GREEN }} onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setError(""); }
        catch { setError("تعذر النسخ التلقائي؛ يمكنك تحديد الرابط ونسخه."); }
      }}><Copy className="w-4 h-4" />{copied ? "تم نسخ الرابط" : "نسخ رابط الانضمام"}</button>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  </Modal>;
}

function Display({ b, spot, left, paused, onExit }: { b: CollaborationView; spot?: CollaborationPost; left: number | null; paused: boolean; onExit: () => void }) {
  const concealed = b.settings.silent && !b.settings.revealed;
  const visible = concealed ? [] : b.posts.filter((p) => !p.hidden && p.status === "approved");
  if (concealed) spot = undefined;
  const sc = spot ? COLORS[spot.color] ?? COLORS.mint : null;
  return (
    <div className="fixed inset-0 z-[90] overflow-auto text-white" style={{ background: "#12301f" }} dir="rtl">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 sticky top-0" style={{ background: "#12301f" }}>
        <div className="flex-1"><div className="text-2xl sm:text-4xl font-black" style={{ color: GOLD }}>{b.title}</div><div className="text-sm sm:text-lg text-white/80 mt-1">{b.prompt}</div></div>
        {left !== null && (paused || left > 0) && <div className="text-center"><div className="text-4xl sm:text-6xl font-black tabular-nums" data-testid="text-display-timer">{fmtTime(left)}</div>{paused && <div className="text-sm text-white/70">متوقف مؤقتاً</div>}</div>}
        <div className="text-center"><div className="text-[11px] text-white/60">الرمز</div><div className="text-2xl sm:text-4xl font-black tracking-[0.2em]">{b.pin}</div></div>
        <button onClick={onExit} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-bold">خروج</button>
      </div>
      {spot && sc ? (
        <div className="p-6 flex justify-center"><div className="max-w-3xl w-full rounded-3xl p-8 text-[#12301f]" style={{ background: sc.bg }}>
          {spot.imageUrl && <div className="mb-4"><ImageThumb src={mediaUrl(spot.imageUrl)} alt="صورة المشاركة المسلّطة" className="max-h-[50vh]" /></div>}
          <p className="text-2xl sm:text-4xl font-bold leading-relaxed whitespace-pre-wrap">{spot.text}</p>
          {b.settings.showNames && !spot.teacher && <p className="mt-4 text-lg font-bold opacity-70">{spot.authorName}</p>}
        </div></div>
      ) : (
        <div className="p-6 columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {concealed && <p className="text-white/80 text-xl" data-testid="text-display-concealed">المعرض مخفي عن الطلاب في وضع الصمت. لا تُعرض المشاركات على الشاشة حتى يكشف المعلم المعرض.</p>}
          {!concealed && visible.length === 0 && <p className="text-white/70 text-xl">لا توجد مشاركات معتمدة لعرضها بعد.</p>}
          {visible.map((p) => <div key={p.id} className="break-inside-avoid mb-4 rounded-2xl p-4 text-[#12301f]" style={{ background: (COLORS[p.color] ?? COLORS.mint).bg }}>
            {p.imageUrl && <div className="mb-2"><ImageThumb src={mediaUrl(p.imageUrl)} alt="صورة مرفقة بالمشاركة" className="max-h-72" /></div>}
            <p className="text-lg font-semibold whitespace-pre-wrap">{p.text}</p>
            {b.settings.showNames && !p.teacher && <p className="text-xs mt-2 opacity-60 font-bold">{p.authorName}</p>}
          </div>)}
        </div>
      )}
    </div>
  );
}
