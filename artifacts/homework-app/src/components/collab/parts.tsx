import { useEffect, type ReactNode } from "react";
import { X, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { CollaborationColumn, CollaborationSettings } from "@workspace/api-client-react";
import { newId } from "@/lib/collab";

export const GREEN = "#225739";
export const GOLD = "#C9A050";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0c2117]/50" onClick={onClose} />
      <div className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92dvh] overflow-y-auto bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background border-b border-border">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/30";
export const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50 transition-colors";
export const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold border border-border bg-card hover:bg-muted disabled:opacity-50 transition-colors";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-bold text-muted-foreground mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex items-center justify-between gap-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-start">
      <span className="font-semibold">{label}</span>
      <span className="relative w-9 h-5 rounded-full shrink-0 transition-colors" style={{ background: on ? GREEN : "#cfd6cf" }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ insetInlineStart: on ? 18 : 2 }} />
      </span>
    </button>
  );
}

export function SettingsEditor({ settings, onSettings, columns, onColumns }: {
  settings: CollaborationSettings; onSettings: (s: CollaborationSettings) => void;
  columns: CollaborationColumn[]; onColumns: (c: CollaborationColumn[]) => void;
}) {
  const s = settings;
  const up = (p: Partial<CollaborationSettings>) => onSettings({ ...s, ...p });
  const move = (i: number, d: number) => {
    const n = [...columns];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onColumns(n);
  };
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        <Toggle label="مراجعة المشاركات قبل ظهورها" on={s.moderation} set={(v) => up({ moderation: v })} />
        <Toggle label="السماح بالتعليقات" on={s.allowComments} set={(v) => up({ allowComments: v })} />
        <Toggle label="السماح بالصور" on={s.allowImages} set={(v) => up({ allowImages: v })} />
        <Toggle label="السماح بالتفاعلات" on={s.allowReactions} set={(v) => up({ allowReactions: v })} />
        <Toggle label="إظهار أسماء الطلاب" on={s.showNames} set={(v) => up({ showNames: v })} />
        <Toggle label="وضع الصمت (المعرض المخفي)" on={s.silent} set={(v) => up({ silent: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="أقصى مشاركات لكل طالب (1-10)">
          <input type="number" min={1} max={10} className={inputCls} value={s.maxPosts} onChange={(e) => up({ maxPosts: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} />
        </Field>
        <Field label="رصيد التصويت لكل طالب (1-10)">
          <input type="number" min={1} max={10} className={inputCls} value={s.voteBudget} onChange={(e) => up({ voteBudget: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} />
        </Field>
      </div>
      <div className="text-xs font-bold text-muted-foreground mb-1">الأعمدة (حتى 8)</div>
      <div className="space-y-1.5">
        {columns.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <input className={inputCls} maxLength={60} value={c.title} placeholder="عنوان العمود" onChange={(e) => onColumns(columns.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)))} />
            <button type="button" aria-label="أعلى" className="p-2 rounded-lg hover:bg-muted" onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></button>
            <button type="button" aria-label="أسفل" className="p-2 rounded-lg hover:bg-muted" onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></button>
            <button type="button" aria-label="حذف العمود" disabled={columns.length <= 1} className="p-2 rounded-lg hover:bg-muted text-destructive disabled:opacity-30" onClick={() => onColumns(columns.filter((x) => x.id !== c.id))}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" disabled={columns.length >= 8} className={`${btnGhost} mt-2`} onClick={() => onColumns([...columns, { id: newId().slice(0, 8), title: "" }])}>
        <Plus className="w-4 h-4" /> إضافة عمود
      </button>
      <p className="text-[11px] text-muted-foreground mt-2">حذف عمود يجب أن يتم بعد نقل مشاركاته؛ الخادم يرفض الحذف إن كان العمود مستخدماً.</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl bg-muted ${className}`} />;
}

export function StatusPill({ status }: { status: string }) {
  const m: Record<string, [string, string]> = {
    open: ["مفتوحة", "#2f684d"], closed: ["مغلقة", "#8a5a1c"], draft: ["مسودة", "#667"], archived: ["مؤرشفة", "#777"],
  };
  const [t, c] = m[status] ?? [status, "#667"];
  return <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: c + "1f", color: c }}>{t}</span>;
}

export const TEMPLATES: { id: string; name: string; hint: string; prompt: string; columns: string[]; settings: Partial<CollaborationSettings> }[] = [
  { id: "ideas", name: "عصف ذهني", hint: "كل فكرة تُحسب", prompt: "ما الأفكار التي تخطر ببالك حول موضوع درس اليوم؟ اكتب فكرتك بجملة واحدة.", columns: ["أفكار", "أسئلة"], settings: { maxPosts: 5 } },
  { id: "kwl", name: "أعرف - أريد أن أعرف - تعلمت", hint: "قبل الدرس وبعده", prompt: "ماذا تعرف عن الموضوع؟ ماذا تريد أن تعرف؟ وماذا تعلمت بعد الدرس؟", columns: ["أعرف", "أريد أن أعرف", "تعلمت"], settings: { maxPosts: 3 } },
  { id: "exit", name: "تذكرة الخروج", hint: "تقييم ختامي صامت", prompt: "اكتب أهم شيء تعلمته اليوم، وسؤالاً بقي لديك.", columns: ["تعلمت", "بقي عندي سؤال"], settings: { silent: true, revealed: false, moderation: true, maxPosts: 2 } },
  { id: "vote", name: "اختيار بالتصويت", hint: "الصف يقرر معاً", prompt: "اقترح خياراً لنشاط الأسبوع القادم، ثم صوّت للخيارات الأفضل.", columns: ["مقترحات"], settings: { voteBudget: 3, maxPosts: 2 } },
  { id: "reflect", name: "تأمل وتقييم ذاتي", hint: "مراجعة التعلم", prompt: "ما الذي أتقنته؟ وما الذي أحتاج لتحسينه؟", columns: ["أتقنت", "أحتاج تدريباً", "خطوتي التالية"], settings: { showNames: false, maxPosts: 3 } },
  { id: "free", name: "لوحة فارغة", hint: "ابدأ من الصفر", prompt: "شاركنا بما لديك.", columns: ["المشاركات"], settings: {} },
];
