import { useState } from "react";
import {
  Pin, Trash2, MessageCircle, Lightbulb, HelpCircle, ThumbsUp, Vote, Pencil, Send, Link2, MoreHorizontal,
  Check, X, Eye, EyeOff, Megaphone, ArrowLeftRight,
} from "lucide-react";
import type { CollaborationView, CollaborationPost, CollaborationAction } from "@workspace/api-client-react";
import { COLORS, mediaUrl, newId, safeLink } from "@/lib/collab";
import { Modal, ImageThumb, inputCls, btnGhost, GREEN, GOLD } from "./parts";

const KINDS = [
  { k: "like", Icon: ThumbsUp, label: "إعجاب" },
  { k: "idea", Icon: Lightbulb, label: "فكرة" },
  { k: "question", Icon: HelpCircle, label: "سؤال" },
  { k: "vote", Icon: Vote, label: "تصويت" },
] as const;

const act = "inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg text-xs font-bold bg-white/70 disabled:opacity-40";

export function PostCard({ b, p, run, onReview, onEdit, canWrite, disabled }: {
  b: CollaborationView; p: CollaborationPost; run: (a: CollaborationAction) => Promise<boolean>;
  onReview: (ids: string[], status: "approved" | "rejected") => Promise<boolean>;
  onEdit: () => void; canWrite: boolean; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [text, setText] = useState("");
  const [cid, setCid] = useState(newId());
  const owner = b.owner;
  const col = COLORS[p.color] ?? COLORS.mint;
  const link = safeLink(p.referenceUrl);
  const spot = b.spotlightId === p.id;
  const canComment = b.settings.allowComments && p.status === "approved" && canWrite && (owner || !b.settings.moderation);
  const budgetOut = b.voteUsed >= b.settings.voteBudget;
  const sendComment = async () => {
    if (!text.trim() || disabled) return;
    if (await run({ type: "comment.create", postId: p.id, text: text.trim().slice(0, 600), clientId: cid })) { setText(""); setCid(newId()); }
  };
  const who = p.teacher ? "المعلم" : p.authorName || "طالب";
  return (
    <article className={`collab-card rounded-xl overflow-hidden border border-black/5 shadow-sm w-full max-w-[420px] ${p.hidden ? "opacity-60" : ""} ${spot ? "ring-2 ring-[#C9A050]" : ""}`} style={{ background: col.bg }} data-testid={`card-post-${p.id}`}>
      <div className="h-1" style={{ background: col.bar }} />
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-[11px] font-bold">
          {p.pinned && <Pin className="w-3 h-3" style={{ color: GOLD }} />}
          <span className="truncate">{who}{p.own && " (أنت)"}</span>
          {p.status === "pending" && <span className="px-1.5 rounded bg-amber-200 text-amber-900">{owner ? "بانتظار موافقتك" : p.own ? "أُرسلت للمعلم" : "بانتظار الموافقة"}</span>}
          {p.status === "rejected" && <span className="px-1.5 rounded bg-rose-200 text-rose-900">مرفوضة، لا تظهر للصف</span>}
          {p.hidden && <span className="px-1.5 rounded bg-black/10">مخفية</span>}
          {spot && <span className="px-1.5 rounded bg-[#C9A050]/30">مسلّطة</span>}
        </div>
        {p.imageUrl && <div className="mb-2"><ImageThumb src={mediaUrl(p.imageUrl)} alt={`صورة مرفقة من ${who}`} className="max-h-64" /></div>}
        {p.text && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{p.text}</p>}
        {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-xs font-bold underline break-all" style={{ color: GREEN }}><Link2 className="w-3 h-3" />{new URL(link).hostname}</a>}
        {p.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{p.tags.map((t) => <span key={t} className="text-[10px] font-bold bg-white/60 rounded-full px-2 py-0.5">{t}</span>)}</div>}

        <div className="flex flex-wrap items-center gap-1 mt-2.5 no-print">
          {b.settings.allowReactions && p.status === "approved" && KINDS.map(({ k, Icon, label }) => {
            const r = p.reactions.find((x) => x.kind === k);
            const dis = disabled || !canWrite || (!owner && (p.hidden || (b.settings.silent && !b.settings.revealed)))
              || (k === "vote" && (p.own || (budgetOut && !r?.mine)));
            return (
              <button key={k} title={label} aria-label={label} disabled={dis} onClick={() => run({ type: "reaction.toggle", postId: p.id, kind: k })} className={`inline-flex items-center justify-center gap-1 rounded-full px-3 text-xs font-bold min-h-[40px] min-w-[40px] disabled:opacity-40 ${r?.mine ? "text-white" : "bg-white/60"}`} style={r?.mine ? { background: GREEN } : undefined}>
                <Icon className="w-3.5 h-3.5" />{r?.count || ""}
              </button>
            );
          })}
          <button className="inline-flex items-center justify-center gap-1 rounded-full px-3 text-xs font-bold bg-white/60 min-h-[40px]" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="التعليقات"><MessageCircle className="w-3.5 h-3.5" />{p.comments.length || ""}</button>
          <span className="flex-1" />
          {p.own && canWrite && !owner && <button className={act} aria-label="تعديل" disabled={disabled} onClick={onEdit}><Pencil className="w-3.5 h-3.5" /> تعديل</button>}
          {p.own && canWrite && !owner && <button className={`${act} text-rose-700`} aria-label="حذف" disabled={disabled} onClick={() => confirm("حذف هذه المشاركة؟") && run({ type: "post.delete", postId: p.id })}><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>

        {owner && (
          <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-black/10 no-print" data-testid={`actions-post-${p.id}`}>
            {p.status === "pending" && <>
              <button className={`${act} !bg-emerald-700 !text-white`} disabled={disabled} onClick={() => onReview([p.id], "approved")}><Check className="w-4 h-4" /> اعتماد</button>
              <button className={`${act} text-rose-800`} disabled={disabled} onClick={() => onReview([p.id], "rejected")}><X className="w-4 h-4" /> رفض</button>
            </>}
            {p.status === "approved" && <>
              <button className={act} disabled={disabled} onClick={() => run({ type: "post.pin", postId: p.id })}><Pin className="w-4 h-4" /> {p.pinned ? "إلغاء التثبيت" : "تثبيت"}</button>
              <button className={act} disabled={disabled || p.hidden} title={p.hidden ? "أظهر المشاركة قبل التسليط" : undefined} onClick={() => run({ type: "board.spotlight", postId: spot ? undefined : p.id })}><Megaphone className="w-4 h-4" /> {spot ? "إلغاء التسليط" : "تسليط"}</button>
            </>}
            <button className={`${act} ${p.status === "approved" ? "" : "col-span-2"}`} onClick={() => { setConfirmDel(false); setMore(true); }} aria-haspopup="dialog" data-testid={`button-post-more-${p.id}`}><MoreHorizontal className="w-4 h-4" /> المزيد</button>
          </div>
        )}
        {open && (
          <div className="mt-2 pt-2 border-t border-black/10 space-y-1.5">
            {p.comments.map((c) => (
              <div key={c.id} className="bg-white/70 rounded-lg px-2.5 py-1.5 text-xs flex gap-2 items-center">
                <div className="flex-1"><b>{c.authorName}</b>: {c.text}</div>
                {(c.own || owner) && <button aria-label="حذف التعليق" disabled={disabled} className="text-rose-700 min-h-[36px] min-w-[36px] flex items-center justify-center" onClick={() => confirm("حذف هذا التعليق؟") && run({ type: "comment.delete", postId: p.id, commentId: c.id })}><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
            {canComment ? (
              <div className="flex gap-1.5">
                <input className={`${inputCls} !py-1.5`} maxLength={600} placeholder="اكتب تعليقاً" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendComment()} />
                <button className="px-3 rounded-lg text-white min-h-[40px] disabled:opacity-50" disabled={disabled} style={{ background: GREEN }} aria-label="إرسال" onClick={sendComment}><Send className="w-4 h-4" /></button>
              </div>
            ) : <p className="text-[11px] text-muted-foreground">{!b.settings.allowComments ? "التعليقات متوقفة" : p.status !== "approved" ? "التعليق متاح بعد اعتماد المشاركة" : !owner && b.settings.moderation ? "التعليقات للمعلم فقط أثناء المراجعة" : "التعليق غير متاح الآن"}</p>}
          </div>
        )}
      </div>
      {more && owner && (
        <Modal title="خيارات المشاركة" onClose={() => setMore(false)}>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.text || "مشاركة بصورة"}</p>
          <div className="grid grid-cols-2 gap-2 [&>button]:min-h-[44px]">
            <button className={btnGhost} disabled={disabled} onClick={async () => { if (await run({ type: "post.hide", postId: p.id })) setMore(false); }}>{p.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} {p.hidden ? "إظهار" : "إخفاء"}</button>
            {p.status !== "approved" && <button className={btnGhost} disabled={disabled} onClick={async () => { if (await run({ type: "post.pin", postId: p.id })) setMore(false); }}><Pin className="w-4 h-4" /> {p.pinned ? "إلغاء التثبيت" : "تثبيت"}</button>}
            {p.own && canWrite && <button className={btnGhost} disabled={disabled} onClick={() => { setMore(false); onEdit(); }}><Pencil className="w-4 h-4" /> تعديل</button>}
          </div>
          <label className="block mt-3"><span className="flex items-center gap-1 text-xs font-bold text-muted-foreground mb-1"><ArrowLeftRight className="w-3.5 h-3.5" /> نقل إلى عمود</span>
            <select className={inputCls} disabled={disabled} value={p.columnId} onChange={async (e) => { if (await run({ type: "post.move", postId: p.id, columnId: e.target.value })) setMore(false); }}>{b.columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          </label>
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <h3 className="text-xs font-extrabold text-rose-900 mb-1">منطقة الحذف</h3>
            <p className="text-[11px] text-rose-900/80 mb-2">الحذف نهائي ولا يُستخدم للرفض. لرفض مشاركة معلّقة استخدم زر رفض.</p>
            {!confirmDel
              ? <button className={`${btnGhost} min-h-[44px] !text-rose-700 w-full`} onClick={() => setConfirmDel(true)}><Trash2 className="w-4 h-4" /> حذف المشاركة نهائياً</button>
              : <div className="flex gap-2"><button className={`${btnGhost} min-h-[44px] flex-1`} onClick={() => setConfirmDel(false)}>تراجع</button>
                <button className="inline-flex items-center justify-center gap-1 rounded-lg min-h-[44px] flex-1 px-3 text-sm font-bold text-white bg-rose-700 disabled:opacity-50" disabled={disabled} data-testid="button-confirm-delete-post" onClick={async () => { if (await run({ type: "post.delete", postId: p.id })) setMore(false); }}>تأكيد الحذف النهائي</button></div>}
          </div>
        </Modal>
      )}
    </article>
  );
}
