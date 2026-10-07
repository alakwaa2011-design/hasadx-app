import { useRef, useState } from "react";
import { Check, ChevronDown, Image as ImageIcon, Loader2, Trash2, WifiOff, X } from "lucide-react";
import {
  useUploadCollaborationImage, uploadCollaborationImage,
  type CollaborationAction, type CollaborationPost, type CollaborationView,
} from "@workspace/api-client-react";
import { authHeaders, COLORS, errMessage, mediaUrl, newId, safeLink, useOnline } from "@/lib/collab";
import { draftKey, useParticipationDraft } from "@/lib/collab-draft";
import { collaborationRequest } from "@/lib/collab-request";
import { btnGhost, btnPrimary, Field, GREEN, inputCls, Modal } from "./parts";
import { useCollabText } from "./collaboration-i18n";

async function thumbnail(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url; });
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.65);
  } finally { URL.revokeObjectURL(url); }
}

export function Composer({ id, b, post, onClose, run }: {
  id: string; b: CollaborationView; post?: CollaborationPost; onClose: () => void;
  run: (a: CollaborationAction) => Promise<boolean>;
}) {
  const t = useCollabText();
  const { draft: d, update, persistent, touched, restored, clear } = useParticipationDraft(
    draftKey(id, b.selfId, post?.id), {
      text: post?.text ?? "", columnId: post?.columnId ?? b.columns[0]?.id ?? "",
      color: post?.color ?? "mint", tags: (post?.tags ?? []).join("، "),
      referenceUrl: post?.referenceUrl ?? "", imageId: post?.imageId ?? null,
      thumbnail: null, clientId: newId(),
    },
  );
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [adv, setAdv] = useState(false);
  const label = post ? t("حفظ") : !b.owner && b.settings.moderation ? t("إرسال للمعلم") : t("إرسال");
  const fileRef = useRef<HTMLInputElement>(null);
  const up = useUploadCollaborationImage({
    mutation: {
      networkMode: "always", retry: false,
      mutationFn: ({ id: boardId, data }) => collaborationRequest(signal =>
        uploadCollaborationImage(boardId, data, { headers: authHeaders(boardId), signal }), 30000),
    },
  });
  const preview = d.thumbnail ?? (d.imageId && d.imageId === post?.imageId && post.imageUrl ? mediaUrl(post.imageUrl) : null);
  const working = busy || up.isPending;
  const close = () => {
    if (sending.current || up.isPending) { setMsg(t("انتظر انتهاء المحاولة قبل إغلاق النافذة.")); return; }
    if (touched && !persistent && !confirm(t("تعذر حفظ المسودة على جهازك. تبقى مؤقتاً في هذه الصفحة فقط وقد تُفقد عند إعادة التحميل. هل تريد إغلاق النافذة؟"))) return;
    onClose();
  };
  const discard = () => {
    if (!confirm(t("حذف المسودة المكتوبة؟ لا يمكن استعادتها بعد الحذف."))) return;
    if (!clear()) { setMsg(t("تعذر حذف المسودة من التخزين. لم نغلق النافذة؛ حاول مجدداً.")); return; }
    onClose();
  };
  const pick = async (file?: File) => {
    if (!file || working) return;
    if (!navigator.onLine) { setMsg(t("أنت غير متصل. لا يمكن رفع صورة الآن؛ أعد المحاولة بعد عودة الاتصال.")); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setMsg(t("الصيغ المسموحة: JPEG وPNG وWebP")); return; }
    if (file.size > 5 * 1024 * 1024) { setMsg(t("حجم الصورة يجب ألا يتجاوز 5 ميغابايت")); return; }
    sending.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const result = await up.mutateAsync({ id, data: { file } });
      update({ imageId: result.imageId, thumbnail: null });
      // A thumbnail failure must never discard the successfully uploaded attachment.
      const thumb = await thumbnail(file).catch(() => null);
      update({ thumbnail: thumb });
    } catch (e) { setMsg(t(errMessage(e))); }
    finally { sending.current = false; setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const submit = async () => {
    if (sending.current || up.isPending) return;
    if (!navigator.onLine) { setMsg(t("أنت غير متصل. لم تُرسل المشاركة. اتصل بالإنترنت ثم اضغط «إعادة المحاولة».")); return; }
    if (d.referenceUrl.trim() && !safeLink(d.referenceUrl.trim())) { setMsg(t("الرابط يجب أن يبدأ بـ https://")); return; }
    if (!d.text.trim() && !d.imageId) { setMsg(t("اكتب نصاً أو أضف صورة")); return; }
    if (!b.columns.some(c => c.id === d.columnId)) { setMsg(t("تغيّرت أقسام اللوحة. اختر قسمًا متاحًا قبل الإرسال.")); return; }
    update({});
    sending.current = true;
    setBusy(true);
    setMsg(null);
    const base = {
      text: d.text.trim(), columnId: d.columnId, color: d.color as CollaborationAction["color"],
      tags: d.tags.split(/[,،]/).map(t => t.trim().slice(0, 30)).filter(Boolean).slice(0, 5),
      referenceUrl: d.referenceUrl.trim() || null, imageId: d.imageId,
    };
    try {
      const ok = await run(post ? { type: "post.edit", postId: post.id, ...base }
        : { type: "post.create", clientId: d.clientId, ...base });
      if (ok) {
        // Only a server-confirmed response ends the draft's lifetime.
        clear();
        onClose();
      } else {
        setMsg(t("لم يصل تأكيد حفظ المشاركة. تحقق من اللوحة ثم أعد المحاولة. لا يتم الإرسال تلقائياً."));
      }
    } finally { sending.current = false; setBusy(false); }
  };
  return (
    <Modal title={post ? t("تعديل المشاركة") : t("مشاركة جديدة")} onClose={close}>
      <div role="status" aria-live="polite" className={`rounded-lg border px-3 py-2 mb-3 text-xs leading-relaxed ${touched && !persistent ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-muted/40 border-border text-muted-foreground"}`} data-testid="text-draft-status">
        {touched ? persistent
          ? `${restored ? t("استُعيدت مسودتك. ") : ""}${t("المسودة محفوظة على هذا الجهاز فقط، ولم تُنشر بعد. يمكنك إغلاق النافذة والعودة إليها.")}`
          : t("تعذر حفظ المسودة على جهازك. النص متاح مؤقتاً في هذه الصفحة فقط؛ قد يُفقد عند إعادة التحميل أو مغادرتها.")
          : t("يمكنك كتابة فكرتك؛ تظهر حالة حفظ المسودة هنا.")}
      </div>
      {!online && <div role="status" className="flex items-start gap-2 rounded-lg bg-amber-100 text-amber-900 p-3 text-sm mb-3" data-testid="text-composer-offline"><WifiOff className="w-4 h-4 shrink-0 mt-0.5" />{t("أنت غير متصل. لن تُرسل المشاركة تلقائياً؛ أعد المحاولة بعد عودة الاتصال.")}</div>}
      <fieldset disabled={working} className="disabled:opacity-70">
        <Field label={t("فكرتك")}><textarea className={inputCls} rows={4} maxLength={2000} value={d.text} onChange={e => update({ text: e.target.value })} autoFocus data-testid="input-post-text" /></Field>
        {(b.settings.allowImages || b.owner) && <div className="mb-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => pick(e.target.files?.[0])} />
          {d.imageId && <div className="relative mb-2">{preview ? <img src={preview} alt={t("معاينة الصورة المرفقة")} className="max-h-40 rounded-lg" /> : <p className="text-sm p-3 bg-muted rounded-lg">{t("صورة مرفقة بالمشاركة")}</p>}<button type="button" aria-label={t("إزالة الصورة")} className="absolute top-1 start-1 bg-white rounded-full p-1 min-h-0" onClick={() => update({ imageId: null, thumbnail: null })}><X className="w-3.5 h-3.5" /></button></div>}
          <button type="button" className={btnGhost} disabled={!online} onClick={() => fileRef.current?.click()}>{up.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} {d.imageId ? t("تغيير الصورة") : t("إضافة صورة")}</button>
        </div>}
        <button type="button" aria-expanded={adv} aria-controls="composer-advanced" onClick={() => setAdv(!adv)} className="inline-flex items-center gap-1 text-sm font-bold min-h-[44px]" style={{ color: GREEN }} data-testid="button-composer-options"><ChevronDown className={`w-4 h-4 transition-transform ${adv ? "rotate-180" : ""}`} /> {t("خيارات إضافية")}</button>
        {!adv && (d.tags || d.referenceUrl) && <p className="text-[11px] text-muted-foreground mb-2">{t("تتضمن المسودة وسوماً أو رابطاً محفوظاً في الخيارات الإضافية.")}</p>}
        <div id="composer-advanced" hidden={!adv} className="mt-1">
        {b.columns.length > 1 && <Field label={t("القسم")}><select className={inputCls} value={d.columnId} onChange={e => update({ columnId: e.target.value })}>{!b.columns.some(c => c.id === d.columnId) && <option value={d.columnId} disabled>{t("اختر قسمًا متاحًا")}</option>}{b.columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>}
        <div className="mb-3"><span className="block text-xs font-bold text-muted-foreground mb-1">{t("لون البطاقة")}</span>
          <div className="flex gap-2">{Object.entries(COLORS).map(([k, v]) => <button key={k} type="button" aria-label={t(v.label)} title={t(v.label)} onClick={() => update({ color: k })} className="w-8 h-8 rounded-full min-h-0" style={{ background: v.bg, border: `3px solid ${d.color === k ? v.bar : "transparent"}` }} />)}</div>
        </div>
        <Field label={t("وسوم (حتى 5، تفصل بينها فاصلة)")}><input className={inputCls} value={d.tags} onChange={e => update({ tags: e.target.value })} /></Field>
        <Field label={t("رابط مرجعي (https فقط)")}><input className={inputCls} dir="ltr" value={d.referenceUrl} onChange={e => update({ referenceUrl: e.target.value })} placeholder="https://" /></Field>
        </div>
      </fieldset>
      {msg && <div role="alert" className="text-sm text-rose-700 mb-3">{msg}</div>}
      <div className="flex gap-2 flex-wrap items-center justify-end">
        {touched && <button className="text-xs text-rose-700 inline-flex items-center gap-1 me-auto py-2" disabled={working} onClick={discard} data-testid="button-discard-draft"><Trash2 className="w-3.5 h-3.5" /> {t("حذف المسودة")}</button>}
        <button className={btnGhost} disabled={working} onClick={close}>{t("إغلاق")}</button>
        <button className={btnPrimary} style={{ background: GREEN }} disabled={working || !online} onClick={submit} data-testid="button-submit-post">{working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {working ? t("جارٍ الإرسال…") : msg ? t("إعادة المحاولة") : label}</button>
      </div>
    </Modal>
  );
}
