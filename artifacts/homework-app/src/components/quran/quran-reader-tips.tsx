import { Bookmark, Hand, Layers3, Sparkles, X } from "lucide-react";

export function QuranReaderTips({
  lang,
  onDismiss,
}: {
  lang: "ar" | "en";
  onDismiss: () => void;
}) {
  const tips = lang === "ar"
    ? [
        { icon: Hand, title: "نطق الكلمة", body: "اضغط مطولًا على أي كلمة لسماع نطقها. اللمسة الخفيفة تحددها فقط." },
        { icon: Sparkles, title: "خيارات الآية", body: "اضغط على رقم الآية للتلاوة والتفسير والنسخ وإضافة علامة." },
        { icon: Bookmark, title: "العلامات", body: "افتح قائمة الأدوات للوصول إلى علاماتك والعودة إليها بسرعة." },
        { icon: Layers3, title: "الحفظ التدريجي", body: "ابدأ من زر الحفظ: استماع، قراءة، إخفاء، تسميع ثم تقييم." },
      ]
    : [
        { icon: Hand, title: "Word pronunciation", body: "Press and hold a word to hear it. A light tap only selects it." },
        { icon: Sparkles, title: "Ayah actions", body: "Tap an ayah number for recitation, tafsir, copying, and bookmarks." },
        { icon: Bookmark, title: "Bookmarks", body: "Open the tools menu to view bookmarks and return to them quickly." },
        { icon: Layers3, title: "Guided memorization", body: "Use Memorize for listening, reading, hiding, reciting, and review." },
      ];

  return (
    <aside
      className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] mx-auto max-w-xl overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#fffdf8]/95 shadow-2xl shadow-emerald-950/15 backdrop-blur-xl dark:border-white/10 dark:bg-[#101411]/95"
      aria-label={lang === "ar" ? "تلميحات استخدام المصحف" : "Quran reader tips"}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between border-b border-emerald-900/10 px-4 py-3 dark:border-white/10">
        <div>
          <p className="text-sm font-extrabold text-emerald-950 dark:text-emerald-50">
            {lang === "ar" ? "اكتشف مصحف حصاد" : "Discover Hasaad Quran"}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-800/70 dark:text-emerald-200/70">
            {lang === "ar" ? "أربع حركات تجعل القراءة أسهل" : "Four gestures that make reading easier"}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="grid h-8 w-8 place-items-center rounded-full text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-200 dark:hover:bg-white/10"
          aria-label={lang === "ar" ? "إغلاق التلميحات" : "Close tips"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {tips.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3 rounded-xl bg-emerald-900/[0.045] p-3 dark:bg-white/[0.055]">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm dark:bg-emerald-600">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-emerald-950 dark:text-emerald-50">{title}</p>
              <p className="mt-1 text-[11px] leading-5 text-emerald-900/70 dark:text-emerald-100/70">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onDismiss}
          className="h-9 w-full rounded-xl bg-emerald-700 text-xs font-extrabold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {lang === "ar" ? "فهمت، ابدأ القراءة" : "Got it, start reading"}
        </button>
      </div>
    </aside>
  );
}