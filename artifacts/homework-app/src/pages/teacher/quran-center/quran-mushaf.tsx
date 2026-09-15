import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { FileText, ArrowRight, BookType } from "lucide-react";

export function QuranMushafView() {
  const { lang } = useI18n();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl md:text-3xl font-black text-emerald-900 dark:text-emerald-50">
          {lang === "ar" ? "تصفح المصحف الشريف" : "Browse the Holy Quran"}
        </h2>
        <p className="text-muted-foreground text-sm md:text-base font-medium mt-2 max-w-2xl">
          {lang === "ar"
            ? "اختر بين القارئ الإلكتروني المرن، أو صفحات مصحف المدينة المصوّرة كما رسمها ونشرها مجمع الملك فهد."
            : "Choose the flexible electronic reader or the original rendered pages published by the King Fahd Complex."}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {/* Reader Card */}
        <div className="bg-white dark:bg-card rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/50 p-6 shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden">
          <div className="absolute top-0 end-0 p-8 opacity-[0.03] dark:opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <FileText className="w-40 h-40" />
          </div>
          
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shrink-0">
            <FileText className="w-7 h-7" />
          </div>
          
          <h3 className="text-xl md:text-2xl font-black text-foreground mb-3">
            {lang === "ar" ? "القارئ الإلكتروني" : "Electronic Reader"}
          </h3>
          <p className="text-muted-foreground text-sm md:text-base font-medium mb-8 flex-1">
            {lang === "ar"
              ? "نص متدفق يمكن تكبيره بحرية. مناسب جداً للبحث السريع وإنجاز مهام الحفظ والمراجعة التي تتطلب التحديد بين آيتين."
              : "Flowing text that can be freely scaled. Perfect for quick searches and completing memorization tasks spanning specific verses."}
          </p>

          <Link href="/teacher/quran-reader/1?view=reader" className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold shadow hover:bg-emerald-700 active:scale-95 transition-all">
            {lang === "ar" ? "فتح القارئ" : "Open Reader"}
            <ArrowRight className="w-5 h-5 rtl:rotate-180" />
          </Link>
        </div>

        {/* Pages Card */}
        <div className="bg-white dark:bg-card rounded-3xl border-2 border-amber-100 dark:border-amber-900/40 p-6 shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden">
          <div className="absolute top-0 end-0 p-8 opacity-[0.03] dark:opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <BookType className="w-40 h-40" />
          </div>
          
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-500 rounded-2xl flex items-center justify-center mb-6 shrink-0">
            <BookType className="w-7 h-7" />
          </div>
          
          <h3 className="text-xl md:text-2xl font-black text-foreground mb-3">
            {lang === "ar" ? "مصحف الصفحات" : "Pages Mushaf"}
          </h3>
          <p className="text-muted-foreground text-sm md:text-base font-medium mb-8 flex-1">
            {lang === "ar"
              ? "الصفحات الأصلية الكاملة لطبعة مصحف المدينة برواية حفص: الخط، والأسطر، والإطار، ورؤوس الصفحات، والترقيم كما في ملفات المجمع الرسمية."
              : "The complete original Hafs Madinah Mushaf pages: type, line breaks, frame, running headers, and page numbers exactly as rendered in the Complex's official master files."}
          </p>

          <Link href="/teacher/quran-reader/1?view=pages" className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-amber-500 text-amber-950 rounded-xl font-bold shadow hover:bg-amber-400 active:scale-95 transition-all">
            {lang === "ar" ? "فتح المصحف" : "Open Mushaf"}
            <ArrowRight className="w-5 h-5 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
}
