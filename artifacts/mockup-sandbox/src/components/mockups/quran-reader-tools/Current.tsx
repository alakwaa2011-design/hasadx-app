import { useState } from "react";
import {
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Copy,
  Droplets,
  EyeOff,
  Info,
  ListPlus,
  Menu,
  Palette,
  Rows3,
  Search,
  Volume2,
  X,
} from "lucide-react";
import "./_group.css";

const surahs = [
  { id: 1, name: "الفَاتِحَة" },
  { id: 2, name: "البَقَرَة" },
  { id: 3, name: "آل عِمْرَان" },
  { id: 4, name: "النِّسَاء" },
];

export function Current() {
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [memoActive, setMemoActive] = useState(false);
  const [pageLayout, setPageLayout] = useState<"continuous" | "single">("continuous");

  const mobileSurahSelect = (
    <div className="relative flex h-full min-w-0 flex-1 items-center">
      <select
        defaultValue={1}
        className="h-full w-full appearance-none truncate rounded-md bg-transparent pe-5 ps-2 text-[11px] font-bold text-emerald-950 outline-none cursor-pointer dark:text-emerald-100"
        aria-label="اختيار السورة"
        data-testid="select-mobile-surah"
      >
        {surahs.map((surah) => (
          <option key={surah.id} value={surah.id}>
            {surah.id}. {surah.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-1 h-3 w-3 text-emerald-900/40" />
    </div>
  );

  const mobilePageSelect = (
    <div className="relative flex h-full min-w-0 shrink-0 items-center">
      <select
        defaultValue={1}
        className="h-full w-full appearance-none truncate rounded-md bg-transparent pe-5 ps-2 text-[11px] font-bold text-emerald-950 outline-none cursor-pointer dark:text-emerald-100"
        aria-label="اختيار الصفحة"
        data-testid="select-mobile-page"
      >
        <option value={1}>ص 1</option>
        <option value={2}>ص 2</option>
        <option value={3}>ص 3</option>
      </select>
      <ChevronDown className="pointer-events-none absolute end-1 h-3 w-3 text-emerald-900/40" />
    </div>
  );

  const searchDialogWrapped = (
    <div className="flex shrink-0 items-center" onPointerDown={() => setMobileToolsOpen(false)}>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-900/10 bg-white/55 p-0 text-emerald-900 transition-colors hover:bg-emerald-50 dark:bg-white/5 dark:text-emerald-100 dark:hover:bg-emerald-950/50 md:h-auto md:w-auto md:gap-2 md:border-0 md:bg-transparent md:p-2 md:text-muted-foreground md:hover:bg-muted md:hover:text-foreground md:dark:bg-transparent md:px-3"
        aria-label="البحث في القرآن"
      >
        <Search className="h-4.5 w-4.5 md:h-5 md:w-5" />
        <span className="hidden text-sm font-bold xl:inline">بحث</span>
      </button>
    </div>
  );

  return (
    <div
      className="quran-reader-root relative flex min-h-screen flex-col bg-[#eeeae2] font-sans transition-colors duration-300 dark:bg-[#0a0c0b]"
      dir="rtl"
    >
      <header className="quran-reader-header sticky top-0 z-40 w-full shrink-0 border-b border-emerald-900/10 bg-[#fbfaf6]/95 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-[#0a0c0b]/95">
        <div className="flex w-full flex-col px-2 py-2 lg:hidden">
          <div className="flex w-full items-center justify-between gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:hidden"
                aria-label="العودة"
              >
                <ChevronRight className="h-4 w-4 ltr:hidden" />
              </button>
              <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                {mobileSurahSelect}
                <div className="mx-1 h-4 w-px shrink-0 bg-emerald-900/10 dark:bg-white/10" />
                {mobilePageSelect}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:hidden"
                aria-label="التلاوة"
              >
                <Volume2 className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setPageLayout((current) => current === "continuous" ? "single" : "continuous")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:hidden"
                aria-label={pageLayout === "continuous" ? "عرض صفحة واحدة" : "عرض صفحات متصلة"}
              >
                {pageLayout === "continuous" ? <Rows3 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
              </button>
              {searchDialogWrapped}
              <button
                type="button"
                onClick={() => setMemoActive((active) => !active)}
                className={`inline-flex h-9 shrink-0 items-center justify-center rounded-md px-2.5 text-xs font-bold transition-colors lg:hidden ${
                  memoActive
                    ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70"
                    : "bg-emerald-900/5 text-emerald-800 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
                }`}
              >
                {memoActive ? "إنهاء حفظني" : "حفظني"}
              </button>
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-md bg-emerald-900/5 px-2.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
                aria-label="خطة الحفظ والمراجعة الشخصية"
              >
                <ListPlus className="h-4 w-4" />
                <span>خطتي</span>
                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-900">2</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileToolsOpen((open) => !open)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors ${
                  mobileToolsOpen
                    ? "bg-emerald-900/10 text-emerald-950 dark:bg-white/10 dark:text-emerald-100"
                    : "text-emerald-800 hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
                }`}
                aria-expanded={mobileToolsOpen}
                aria-label="المزيد من أدوات المصحف"
              >
                {mobileToolsOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mobileToolsOpen && (
            <div className="mt-2 flex flex-col gap-2 rounded-xl border border-emerald-900/10 bg-white/50 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#0a0c0b]/50">
              <p className="px-1 text-[10px] font-extrabold text-emerald-800/60 dark:text-emerald-200/60">طريقة العرض</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex h-9 w-32 shrink-0 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                  <div className="relative flex h-full flex-1 items-center">
                    <select defaultValue="juz" className="h-full w-full appearance-none rounded-md bg-transparent pe-7 ps-3 text-xs font-bold text-emerald-950 outline-none dark:text-emerald-100" aria-label="اختيار الجزء">
                      <option value="juz">الجزء 1</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-emerald-900/40" />
                  </div>
                </div>
                <div className="flex h-9 min-w-[120px] flex-1 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                  <div className="relative flex h-full flex-1 items-center">
                    <select defaultValue="continuous" className="h-full w-full appearance-none rounded-md bg-transparent pe-7 ps-3 text-xs font-bold text-emerald-950 outline-none dark:text-emerald-100" aria-label="طريقة عرض الصفحات">
                      <option value="single">صفحة</option>
                      <option value="continuous">متصلة</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-emerald-900/40" />
                  </div>
                </div>
              </div>
              <p className="border-t border-emerald-900/10 px-1 pt-2 text-[10px] font-extrabold text-emerald-800/60 dark:border-white/10 dark:text-emerald-200/60">أدوات القراءة</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10" aria-label="خيارات النسخ"><Copy className="h-4 w-4" /></button>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10" aria-label="خيارات العلامات"><Bookmark className="h-4 w-4" /></button>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10" aria-label="إضاءة صفحة المصحف"><Palette className="h-4 w-4" /></button>
                  <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10" aria-label="تلوين أحكام التجويد"><Droplets className="h-4 w-4" /></button>
                  <button type="button" className="grid h-9 w-6 shrink-0 place-items-center rounded-md text-emerald-800/70 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300/70 dark:hover:bg-white/10" aria-label="معنى ألوان التجويد"><Info className="h-3.5 w-3.5" /></button>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10" aria-label="وضع القراءة الهادئ"><EyeOff className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-900/5 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10">
                    <Bookmark className="h-4 w-4" /><span>العلامات</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="quran-reader-main flex min-h-screen w-full justify-center bg-[#eeeae2] pt-14 dark:bg-[#0a0c0b]">
        <div className="quran-page-shell--paged w-full max-w-[430px]">
          <figure className="quran-reader-figure m-0">
            <div className="quran-reader-page-crop quran-madani-page">
              <img
                className="block"
                src="/__mockup/quran/mushaf-page-001.webp"
                alt="صفحة المصحف الأولى: سورة الفاتحة وبداية سورة البقرة"
              />
            </div>
          </figure>
        </div>
      </main>

      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 p-3 pt-[8vh] backdrop-blur-sm" dir="rtl" role="dialog" aria-modal="true" aria-label="البحث في القرآن" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSearchOpen(false);
        }}>
          <section className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl dark:bg-card">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div>
                <h2 className="text-base font-black text-foreground">البحث في آيات القرآن</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">يمكنك الكتابة بالتشكيل أو بدونه</p>
              </div>
              <button type="button" onClick={() => setSearchOpen(false)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="إغلاق">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <input placeholder="اكتب كلمة مثل: الرحمن" className="h-12 w-full rounded-2xl border-2 border-border bg-muted/30 pe-4 ps-12 text-base font-bold text-foreground outline-none" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}