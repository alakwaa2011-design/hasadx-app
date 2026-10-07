import { useMemo, useState } from "react";
import { Check, X, Link2 } from "lucide-react";
import type { CollaborationView, CollaborationPost } from "@workspace/api-client-react";
import { mediaUrl, safeLink } from "@/lib/collab";
import { Modal, ImageThumb, btnGhost, GREEN } from "./parts";
import { useCollabText } from "./collaboration-i18n";

export function ReviewPanel({ b, pending, busy, error, onReview, onRetry, onClose }: {
  b: CollaborationView; pending: CollaborationPost[]; busy: boolean; error: string | null;
  onReview: (ids: string[], status: "approved" | "rejected") => Promise<boolean>; onClose: () => void;
  onRetry?: () => Promise<boolean>;
}) {
  const t = useCollabText();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const ids = useMemo(() => pending.map((p) => p.id), [pending]);
  const chosen = ids.filter((i) => sel.has(i));
  const all = ids.length > 0 && chosen.length === ids.length;
  const col = (id: string) => b.columns.find((c) => c.id === id)?.title ?? "";
  const go = async (list: string[], status: "approved" | "rejected") => {
    if (await onReview(list, status)) setSel(new Set());
  };
  return (
    <Modal title={`${t("مراجعة المشاركات")} (${pending.length})`} onClose={onClose} wide>
      {onRetry && <div role="status" className="mb-3 rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm">
        <p>{t("لم يكتمل تأكيد قرار المراجعة. تحقق من نتيجته حتى إن اختفت المشاركات من قائمة الانتظار.")}</p>
        <button className={`${btnGhost} min-h-[44px] mt-2`} disabled={busy} onClick={onRetry} data-testid="button-confirm-review-result">{t("التحقق من قرار المراجعة")}</button>
      </div>}
      {error && <p role="alert" className="text-sm text-rose-700 mb-2">{error}</p>}
      {pending.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10" data-testid="text-review-empty">{t("لا مشاركات بانتظار المراجعة.")}</p> : <>
        <div className="sticky top-12 z-[5] bg-background pb-2 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm font-bold min-h-[44px]">
            <input type="checkbox" className="w-5 h-5" checked={all} onChange={() => setSel(all ? new Set() : new Set(ids))} data-testid="checkbox-select-all" /> {t("تحديد الكل")}
          </label>
          <span className="text-xs text-muted-foreground flex-1">{t("المحدد: ")}{chosen.length}</span>
          <button className={`${btnGhost} min-h-[44px] !text-white !border-transparent`} style={{ background: GREEN }} disabled={busy || !chosen.length} onClick={() => go(chosen, "approved")} data-testid="button-approve-selected"><Check className="w-4 h-4" /> {t("اعتماد المحدد")}</button>
          <button className={`${btnGhost} min-h-[44px] !text-rose-800`} disabled={busy || !chosen.length} onClick={() => go(chosen, "rejected")} data-testid="button-reject-selected"><X className="w-4 h-4" /> {t("رفض المحدد")}</button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">{t("الرفض يخفي المشاركة عن الصف ولا يحذفها، ويمكن التراجع عن المراجعة بعد نجاحها.")}</p>
        <ul className="space-y-3">
          {pending.map((p) => {
            const link = safeLink(p.referenceUrl);
            return (
              <li key={p.id} className="rounded-xl border border-border bg-card p-3" data-testid={`review-item-${p.id}`}>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" className="w-5 h-5" aria-label={`${t("تحديد مشاركة ")}${p.authorName || t("طالب")}`} checked={sel.has(p.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                  <span className="font-bold text-sm">{p.authorName || t("طالب")}</span>
                  <span className="text-[11px] text-muted-foreground">{col(p.columnId)}</span>
                </div>
                {p.imageUrl && <div className="mb-2 max-w-sm"><ImageThumb src={mediaUrl(p.imageUrl)} alt={`${t("صورة مرفقة من ")}${p.authorName || t("طالب")}`} className="max-h-72" /></div>}
                {p.text && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{p.text}</p>}
                {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs font-bold underline break-all" style={{ color: GREEN }}><Link2 className="w-3 h-3" />{new URL(link).hostname}</a>}
                {p.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{p.tags.map((t) => <span key={t} className="text-[10px] font-bold bg-muted rounded-full px-2 py-0.5">{t}</span>)}</div>}
                <div className="flex gap-2 mt-3">
                  <button className={`${btnGhost} min-h-[44px] flex-1 !text-white !border-transparent`} style={{ background: GREEN }} disabled={busy} onClick={() => go([p.id], "approved")}><Check className="w-4 h-4" /> {t("اعتماد")}</button>
                  <button className={`${btnGhost} min-h-[44px] flex-1 !text-rose-800`} disabled={busy} onClick={() => go([p.id], "rejected")}><X className="w-4 h-4" /> {t("رفض")}</button>
                </div>
              </li>
            );
          })}
        </ul>
      </>}
    </Modal>
  );
}
