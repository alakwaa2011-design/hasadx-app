import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronDown, ChevronRight, Copy, Droplets, EyeOff, Info, Menu, Palette, Search, Volume2, X } from "lucide-react";
import "./_group.css";

const surahs = [
  { id: 1, name: "الفَاتِحَة" },
  { id: 2, name: "البَقَرَة" },
  { id: 3, name: "آل عِمْرَان" },
  { id: 4, name: "النِّسَاء" },
];

export function Proposed() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [memoActive, setMemoActive] = useState(false);
  const [pageLayout, setPageLayout] = useState<"continuous" | "single">("continuous");
  const [theme, setTheme] = useState(0);
  const [tajweed, setTajweed] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) { setMoreOpen(false); setChoiceOpen(false); }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMoreOpen(false); setChoiceOpen(false); setSearchOpen(false); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const tool = "grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10";
  return (
    <div className="quran-reader-root relative flex min-h-[100dvh] flex-col bg-[#eeeae2] font-sans dark:bg-[#0a0c0b]" dir="rtl">
      {!quiet && <header ref={header} className="quran-reader-header relative z-40 w-full shrink-0 border-b border-emerald-900/10 bg-[#fbfaf6]/95 shadow-sm backdrop-blur-xl dark:border-white/5 dark:bg-[#0a0c0b]/95">
        <div className="flex w-full items-center justify-between gap-1 px-2 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button type="button" className={tool} aria-label="العودة"><ChevronRight className="h-4 w-4" /></button>
            <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
              <div className="relative flex h-full min-w-0 flex-1 items-center">
                <select defaultValue={1} aria-label="اختيار السورة" className="h-full w-full appearance-none truncate bg-transparent pe-5 ps-2 text-[11px] font-bold text-emerald-950 outline-none dark:text-emerald-100">
                  {surahs.map(surah => <option key={surah.id} value={surah.id}>{surah.id}. {surah.name}</option>)}
                </select><ChevronDown className="pointer-events-none absolute end-1 h-3 w-3 text-emerald-900/40" />
              </div>
              <div className="mx-1 h-4 w-px shrink-0 bg-emerald-900/10" />
              <div className="relative flex h-full shrink-0 items-center">
                <select defaultValue={1} aria-label="اختيار الصفحة" className="h-full w-full appearance-none bg-transparent pe-5 ps-2 text-[11px] font-bold text-emerald-950 outline-none dark:text-emerald-100">
                  {[1, 2, 3].map(page => <option key={page} value={page}>ص {page}</option>)}
                </select><ChevronDown className="pointer-events-none absolute end-1 h-3 w-3 text-emerald-900/40" />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" className={tool} onClick={() => setSearchOpen(true)} aria-label="البحث في القرآن"><Search className="h-[18px] w-[18px]" /></button>
            <button type="button" className={tool} aria-label="التلاوة"><Volume2 className="h-[18px] w-[18px]" /></button>
            <button type="button" onClick={() => memoActive ? setMemoActive(false) : (setChoiceOpen(!choiceOpen), setMoreOpen(false))}
              className={`h-9 shrink-0 rounded-md px-2.5 text-xs font-bold ${memoActive ? "bg-amber-100 text-amber-900" : "bg-emerald-900/5 text-emerald-800 dark:bg-white/5 dark:text-emerald-200"}`}>{memoActive ? "إنهاء حفظني" : "حفظني"}</button>
            <button type="button" onClick={() => { setMoreOpen(!moreOpen); setChoiceOpen(false); }} aria-label="المزيد من أدوات المصحف" aria-expanded={moreOpen}
              className={`${tool} ${moreOpen ? "bg-emerald-900/10" : ""}`}>{moreOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>
        {choiceOpen && <div className="absolute end-2 top-full mt-1 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-emerald-900/10 bg-[#fbfaf6] p-2 shadow-xl dark:bg-[#151b18]">
          <p className="px-2 py-1 text-xs font-bold text-emerald-900/60">كيف تود البدء؟</p>
          <button type="button" onClick={() => { setMemoActive(true); setChoiceOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-start text-sm font-bold text-emerald-900 hover:bg-emerald-900/5">حفظني من الآية الحالية</button>
          <button type="button" onClick={() => setChoiceOpen(false)} className="flex w-full justify-between rounded-lg px-3 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-900/5"><span>خطتي</span><span className="rounded-full bg-amber-100 px-2 text-amber-900">2</span></button>
        </div>}
        {moreOpen && <div className="absolute end-2 top-full mt-1 flex max-h-[calc(100dvh-4.5rem)] w-[min(23rem,calc(100vw-1rem))] flex-col gap-2 overflow-y-auto rounded-xl border border-emerald-900/10 bg-[#fbfaf6] p-3 shadow-xl dark:border-white/10 dark:bg-[#151b18]">
          <p className="px-1 text-[10px] font-extrabold text-emerald-800/60">طريقة العرض</p>
          <div className="flex gap-2">
            <select aria-label="اختيار الجزء" className="h-9 w-32 rounded-lg bg-emerald-900/5 px-2 text-xs font-bold text-emerald-950"><option>الجزء 1</option></select>
            <select aria-label="طريقة عرض الصفحات" value={pageLayout} onChange={event => setPageLayout(event.target.value as "single" | "continuous")} className="h-9 min-w-0 flex-1 rounded-lg bg-emerald-900/5 px-2 text-xs font-bold text-emerald-950"><option value="single">صفحة</option><option value="continuous">متصلة</option></select>
          </div>
          <div className="flex h-9 items-center gap-3 rounded-lg bg-emerald-900/5 px-3 text-xs font-bold text-emerald-900"><button type="button" aria-label="تصغير">−</button><span>100%</span><button type="button" aria-label="تكبير">+</button></div>
          <p className="border-t border-emerald-900/10 px-1 pt-2 text-[10px] font-extrabold text-emerald-800/60">أدوات القراءة</p>
          <div className="flex flex-wrap gap-1">
            <button type="button" className={tool} aria-label="خيارات النسخ"><Copy className="h-4 w-4" /></button>
            <button type="button" className={tool} aria-label="خيارات العلامات"><Bookmark className="h-4 w-4" /></button>
            <button type="button" className={tool} onClick={() => setTheme((theme + 1) % 3)} aria-label="إضاءة صفحة المصحف"><Palette className="h-4 w-4" /></button>
            <button type="button" className={tool} onClick={() => setTajweed(!tajweed)} aria-label="تلوين أحكام التجويد" aria-pressed={tajweed}><Droplets className="h-4 w-4" /></button>
            <button type="button" className={tool} aria-label="معنى ألوان التجويد"><Info className="h-4 w-4" /></button>
            <button type="button" className={tool} onClick={() => setQuiet(true)} aria-label="وضع القراءة الهادئ"><EyeOff className="h-4 w-4" /></button>
          </div>
          <p className="border-t border-emerald-900/10 px-1 pt-2 text-[10px] font-extrabold text-emerald-800/60">إجراءات</p>
          <button type="button" className="flex h-9 items-center gap-2 rounded-lg bg-emerald-900/5 px-3 text-xs font-bold text-emerald-800"><Bookmark className="h-4 w-4" />العلامات</button>
        </div>}
      </header>}
      {quiet && <button type="button" onClick={() => setQuiet(false)} className="absolute end-4 top-4 z-50 rounded-lg bg-emerald-900 px-3 py-2 text-xs text-white">إظهار الأدوات</button>}
      <main className="quran-reader-main flex min-h-[100dvh] w-full justify-center bg-[#eeeae2] pt-14 dark:bg-[#0a0c0b]">
        <div className="quran-page-shell--paged w-full max-w-[430px]"><figure className="quran-reader-figure m-0"><div className="quran-reader-page-crop quran-madani-page">
          <img className="block" src="/__mockup/quran/mushaf-page-001.webp" alt="صفحة المصحف الأولى: سورة الفاتحة وبداية سورة البقرة" />
        </div></figure></div>
      </main>
      {searchOpen && <div role="dialog" aria-modal="true" aria-label="البحث في القرآن" className="fixed inset-0 z-[100] bg-black/45 p-3 pt-[8vh]" onMouseDown={event => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
        <section className="mx-auto max-w-2xl rounded-2xl bg-[#fbfaf6] p-4 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-base font-black">البحث في آيات القرآن</h2><button type="button" onClick={() => setSearchOpen(false)} aria-label="إغلاق"><X className="h-5 w-5" /></button></div><input placeholder="اكتب كلمة مثل: الرحمن" className="mt-4 h-12 w-full rounded-xl border px-4" /></section>
      </div>}
    </div>
  );
}