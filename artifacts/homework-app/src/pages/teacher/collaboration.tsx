import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Users, MessageSquare, Clock, Copy, Loader2, LayoutDashboard, RefreshCw } from "lucide-react";
import { Layout } from "@/components/layout";
import {
  useListCollaborationBoards, useCreateCollaborationBoard, getListCollaborationBoardsQueryKey,
  type CollaborationSettings, type CollaborationColumn,
} from "@workspace/api-client-react";
import { DEFAULT_SETTINGS, newId, errMessage } from "@/lib/collab";
import { Modal, Field, inputCls, btnPrimary, btnGhost, SettingsEditor, Skeleton, StatusPill, TEMPLATES, GREEN, GOLD } from "@/components/collab/parts";
import { BoardWorkspace } from "@/components/collab/workspace";

export function TeacherCollaborationList() {
  const q = useListCollaborationBoards();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const list = (q.data ?? []).filter((b) => filter === "all" || b.status === filter);
  return (
    <Layout>
      <div className="container mx-auto px-4 py-5 max-w-5xl" dir="rtl">
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <div className="flex-1 min-w-[220px]">
            <div className="text-xs font-extrabold mb-1" style={{ color: GOLD }}>مساحة الصف التعاونية</div>
            <h1 className="text-2xl font-black" style={{ color: GREEN }}>لوحات الصف التعاونية</h1>
            <p className="text-sm text-muted-foreground">كل فكرة من طالب تصبح مساهمة نافعة للصف كله.</p>
          </div>
          <button className={btnPrimary} style={{ background: GREEN }} onClick={() => setOpen(true)} data-testid="button-create-board"><Plus className="w-4 h-4" /> لوحة جديدة</button>
        </div>
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {[["all", "الكل"], ["open", "مفتوحة"], ["draft", "مسودات"], ["closed", "مغلقة"], ["archived", "مؤرشفة"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-bold border min-h-0 ${filter === k ? "text-white" : "bg-card"}`} style={filter === k ? { background: GREEN } : undefined}>{l}</button>
          ))}
        </div>
        {q.isLoading ? <div className="grid sm:grid-cols-2 gap-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
          : q.isError ? <div className="text-center py-12"><p className="mb-3 text-sm">{errMessage(q.error)}</p><button className={btnGhost} onClick={() => q.refetch()}><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button></div>
          : (q.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <LayoutDashboard className="w-9 h-9 mx-auto mb-3" style={{ color: GOLD }} />
              <h3 className="font-extrabold mb-1">ابدأ بأول لوحة لصفك</h3>
              <p className="text-sm text-muted-foreground mb-4">اختر قالباً تعليمياً جاهزاً أو ابدأ من لوحة فارغة.</p>
              <button className={btnPrimary} style={{ background: GREEN }} onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> إنشاء لوحة</button>
            </div>
          ) : list.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10">لا لوحات في هذه الحالة.</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {list.map((b) => (
                <Link key={b.id} href={`/teacher/collaboration/${b.id}`} className="block rounded-xl border border-border bg-card p-4 hover:border-[#1E4D35]/40 transition-colors" data-testid={`card-board-${b.id}`}>
                  <div className="flex items-center justify-between mb-1.5"><StatusPill status={b.status} /><span className="font-black tracking-[0.2em] text-xs" style={{ color: GREEN }}>{b.pin}</span></div>
                  <h3 className="font-extrabold text-base leading-snug">{b.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{b.prompt}</p>
                  <div className="flex gap-3 mt-3 text-xs text-muted-foreground font-bold">
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{b.memberCount}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{b.postCount}</span>
                    {b.pendingCount > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="w-3.5 h-3.5" />{b.pendingCount} بانتظار</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
      </div>
      {open && <CreateDialog onClose={() => setOpen(false)} />}
    </Layout>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const create = useCreateCollaborationBoard();
  const [tpl, setTpl] = useState(TEMPLATES[0].id);
  const t0 = TEMPLATES[0];
  const [title, setTitle] = useState(t0.name);
  const [prompt, setPrompt] = useState(t0.prompt);
  const [settings, setSettings] = useState<CollaborationSettings>({ ...DEFAULT_SETTINGS, ...t0.settings });
  const [columns, setColumns] = useState<CollaborationColumn[]>(t0.columns.map((c) => ({ id: newId().slice(0, 8), title: c })));
  const [clientId] = useState(newId());
  const [err, setErr] = useState<string | null>(null);
  const choose = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setTpl(id); setTitle(t.name); setPrompt(t.prompt);
    setSettings({ ...DEFAULT_SETTINGS, ...t.settings });
    setColumns(t.columns.map((c) => ({ id: newId().slice(0, 8), title: c })));
  };
  const submit = async () => {
    setErr(null);
    try {
      const b = await create.mutateAsync({ data: { clientId, title: title.trim(), prompt: prompt.trim(), settings, columns: columns.map((c) => ({ ...c, title: c.title.trim() })) } });
      qc.invalidateQueries({ queryKey: getListCollaborationBoardsQueryKey() });
      nav(`/teacher/collaboration/${b.id}`);
    } catch (e) { setErr(errMessage(e)); }
  };
  const valid = title.trim() && prompt.trim() && columns.length > 0 && columns.every((c) => c.title.trim());
  return (
    <Modal title="لوحة تعاون جديدة" onClose={onClose} wide>
      <div className="text-xs font-bold text-muted-foreground mb-1.5">قالب تعليمي</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" onClick={() => choose(t.id)} className={`text-start rounded-lg border p-2.5 min-h-0 ${tpl === t.id ? "border-[#1E4D35] bg-[#f2f7f4]" : "border-border bg-card"}`}>
            <div className="text-sm font-extrabold leading-tight">{t.name}</div><div className="text-[11px] text-muted-foreground">{t.hint}</div>
          </button>
        ))}
      </div>
      <Field label="العنوان"><input className={inputCls} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-board-title" /></Field>
      <Field label="السؤال أو التوجيه للطلاب"><textarea className={inputCls} rows={3} maxLength={1000} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></Field>
      <SettingsEditor settings={settings} onSettings={setSettings} columns={columns} onColumns={setColumns} />
      {err && <div role="alert" className="text-sm text-rose-700 mt-3">{err}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnGhost} onClick={onClose}>إلغاء</button>
        <button className={btnPrimary} style={{ background: GREEN }} disabled={!valid || create.isPending} onClick={submit} data-testid="button-submit-board">{create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="hidden" />} إنشاء اللوحة</button>
      </div>
    </Modal>
  );
}

export default function TeacherCollaborationPage({ params }: { params?: { id?: string } }) {
  const id = params?.id;
  if (!id) return <TeacherCollaborationList />;
  return (
    <Layout>
      <div className="container mx-auto max-w-7xl px-0">
        <div className="px-4 pt-3"><Link href="/teacher/collaboration" className="text-xs font-bold text-muted-foreground hover:text-foreground">العودة إلى اللوحات</Link></div>
        <BoardWorkspace id={id} />
      </div>
    </Layout>
  );
}
