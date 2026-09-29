import { useEffect, useState } from "react";
import { getTutorialLinks, saveTutorialLinks, type TutorialLink } from "@workspace/api-client-react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getTutorialYoutubeVideoId, TutorialVideoButton } from "@/components/tutorial-video";

export function TutorialLinksTab({ lang }: { lang: "ar" | "en" }) {
  const isAr = lang === "ar";
  const [links, setLinks] = useState<TutorialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let live = true;
    getTutorialLinks()
      .then(result => { if (live) setLinks(result.links); })
      .catch(() => toast.error(isAr ? "تعذر تحميل روابط الشرح" : "Could not load tutorial links"))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [isAr]);

  function change(next: TutorialLink[]) {
    setLinks(next);
    setDirty(true);
  }

  async function save() {
    if (links.some(link => !link.title.trim() || !getTutorialYoutubeVideoId({ youtubeUrl: link.url }))) {
      toast.error(isAr ? "أدخل عنوانًا ورابط فيديو YouTube صالحًا لكل شرح" : "Enter a title and a valid YouTube link for each tutorial");
      return;
    }
    setSaving(true);
    try {
      const result = await saveTutorialLinks({ links: links.map(link => ({ ...link, title: link.title.trim(), url: link.url.trim() })) });
      setLinks(result.links);
      setDirty(false);
      toast.success(isAr ? "تم حفظ روابط الشرح" : "Tutorial links saved");
    } catch {
      toast.error(isAr ? "تعذر حفظ روابط الشرح" : "Could not save tutorial links");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-5" aria-label={isAr ? "إدارة شروحات الفيديو" : "Manage video tutorials"}>
      <div>
        <h2 className="text-lg font-extrabold">{isAr ? "شروحات المعلمين" : "Teacher tutorials"}</h2>
        <p className="text-sm text-muted-foreground">
          {isAr ? "أضف روابط فيديو YouTube. يظهر الرابط الأول بجانب عنوان إنشاء الواجب، وتظهر بقية الروابط في صفحة الإنشاء." : "Add YouTube video links. The first appears beside Create homework; the others appear on that page."}
        </p>
      </div>
      {loading ? <p className="text-sm">{isAr ? "جاري التحميل…" : "Loading…"}</p> : (
        <>
          {links.map((link, index) => (
            <div key={link.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm">{index === 0 ? (isAr ? "الشرح الرئيسي لإنشاء الواجب" : "Main homework tutorial") : (isAr ? `شرح إضافي ${index}` : `Additional tutorial ${index}`)}</strong>
                <button type="button" aria-label={isAr ? `حذف ${link.title || "الشرح"}` : `Delete ${link.title || "tutorial"}`} onClick={() => change(links.filter(item => item.id !== link.id))} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
              <label className="block text-sm font-bold">{isAr ? "العنوان" : "Title"}
                <input value={link.title} maxLength={120} onChange={event => change(links.map(item => item.id === link.id ? { ...item, title: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-bold">{isAr ? "رابط YouTube" : "YouTube URL"}
                <input type="url" dir="ltr" value={link.url} maxLength={500} placeholder="https://www.youtube.com/watch?v=..." onChange={event => change(links.map(item => item.id === link.id ? { ...item, url: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-normal" />
              </label>
              {getTutorialYoutubeVideoId({ youtubeUrl: link.url }) && <TutorialVideoButton title={link.title || (isAr ? "معاينة الشرح" : "Tutorial preview")} youtubeUrl={link.url} language={lang} label={isAr ? "معاينة" : "Preview"} />}
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={links.length >= 30 || saving} onClick={() => change([...links, { id: crypto.randomUUID(), title: "", url: "" }])} className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50"><Plus className="h-4 w-4" />{isAr ? "إضافة شرح" : "Add tutorial"}</button>
            <button type="button" disabled={!dirty || saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />{saving ? (isAr ? "جارٍ الحفظ…" : "Saving…") : (isAr ? "حفظ التغييرات" : "Save changes")}</button>
          </div>
          {dirty && <p className="text-xs text-amber-700">{isAr ? "التغييرات لم تُحفظ بعد." : "Changes are not saved yet."}</p>}
        </>
      )}
    </section>
  );
}