import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  getJuzStart,
  getPageStart,
  getQuranLocation,
  parseQuranXml,
  QuranSurahParsed,
} from '@/lib/quran-parser';
import { MADANI_MUSHAF_METADATA } from '@/data/quran/madani-mushaf-metadata';
import { Loader2, ChevronRight, ChevronLeft, ZoomIn, ZoomOut, EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { QuranPagesView } from './quran-pages-view';
import { QuranSearchDialog } from './quran-search-dialog';

export default function QuranReader() {
  const { lang, dir } = useI18n();
  const params = useParams<{ surahNumber: string }>();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const startAyah = searchParams.get('startAyah') ? parseInt(searchParams.get('startAyah')!, 10) : null;
  const endAyah = searchParams.get('endAyah') ? parseInt(searchParams.get('endAyah')!, 10) : null;
  const mode = searchParams.get('mode');
  const requestedAyah = searchParams.get('ayah') ? parseInt(searchParams.get('ayah')!, 10) : null;
  const view = searchParams.get('view') || 'reader';

  const surahNumber = parseInt(params.surahNumber || '1', 10);
  
  if (view === 'pages') {
    return (
      <QuranPagesView
        initialSurah={surahNumber}
        initialAyah={requestedAyah ?? startAyah ?? 1}
        onNavigate={(loc) => setLocation(`/teacher/quran-reader/${loc.surah}?ayah=${loc.ayah}&view=pages`)}
        isTaskAyah={(sId, aNum) => sId === surahNumber && startAyah !== null && endAyah !== null && aNum >= startAyah && aNum <= endAyah}
        startAyah={startAyah}
        endAyah={endAyah}
        mode={mode}
      />
    );
  }

  return <ReaderView
    surahNumber={surahNumber}
    startAyah={startAyah}
    endAyah={endAyah}
    mode={mode}
    requestedAyah={requestedAyah}
  />;
}

interface ReaderViewProps {
  surahNumber: number;
  startAyah: number | null;
  endAyah: number | null;
  mode: string | null;
  requestedAyah: number | null;
}

function ReaderView({ surahNumber, startAyah, endAyah, mode, requestedAyah }: ReaderViewProps) {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();

  const [surahs, setSurahs] = useState<QuranSurahParsed[] | null>(null);
  const [fontSize, setFontSize] = useState(28);
  const [isQuietMode, setIsQuietMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    import('@/data/quran/tanzil-uthmani.xml?raw').then(m => {
      if (mounted) setSurahs(parseQuranXml(m.default));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (surahNumber && !startAyah) {
      localStorage.setItem('hasaad_last_surah', surahNumber.toString());
    }
  }, [surahNumber, startAyah]);

  useEffect(() => {
    const ayahToReveal = requestedAyah ?? startAyah;
    if (surahs && ayahToReveal) {
      setTimeout(() => {
        const el = document.getElementById(`ayah-${ayahToReveal}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    }
  }, [surahs, requestedAyah, startAyah, surahNumber]);

  if (!surahs) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf8] dark:bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  const surahIndex = surahNumber - 1;
  const surah = surahs[surahIndex];
  
  if (!surah) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-destructive">
        {lang === 'ar' ? 'السورة غير موجودة' : 'Surah not found'}
      </div>
    );
  }

  const activeAyah = Math.min(Math.max(requestedAyah ?? startAyah ?? 1, 1), surah.ayahs.length);
  const activeLocation = getQuranLocation(surahNumber, activeAyah);

  const navigateTo = ({ surah, ayah }: { surah: number; ayah: number }) => {
    setLocation(`/teacher/quran-reader/${surah}?ayah=${ayah}&view=reader`);
  };

  const isTaskAyah = (index: number) => {
    if (startAyah && endAyah) {
      return index >= startAyah && index <= endAyah;
    }
    return false;
  };

  const handleNext = () => {
    if (surahNumber < 114) navigateTo({ surah: surahNumber + 1, ayah: 1 });
  };
  
  const handlePrev = () => {
    if (surahNumber > 1) navigateTo({ surah: surahNumber - 1, ayah: 1 });
  };

  const bismillah = surah.ayahs[0]?.bismillah;

  return (
    <div className={cn("min-h-[100dvh] flex flex-col font-sans transition-colors duration-300", isQuietMode ? "bg-[#fcfaf8] dark:bg-[#111]" : "bg-[#fcfaf8] dark:bg-background")} dir={dir}>
      {/* Quiet Mode Exit Button */}
      {isQuietMode && (
        <button 
          onClick={() => setIsQuietMode(false)}
          className="fixed bottom-6 end-6 z-50 p-3 bg-emerald-700 text-white rounded-full shadow-lg hover:bg-emerald-800 transition-all opacity-30 hover:opacity-100"
          title={lang === 'ar' ? 'إنهاء وضع القراءة' : 'Exit quiet mode'}
        >
          <Eye className="w-6 h-6" />
        </button>
      )}

      {!isQuietMode && (
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 md:px-4">
            <button 
              onClick={() => setLocation('/teacher/quran-center?tab=mushaf')}
              className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
            >
              <ChevronLeft className="w-5 h-5 rtl:hidden" />
              <ChevronRight className="w-5 h-5 ltr:hidden" />
              {lang === 'ar' ? 'العودة إلى المصحف' : 'Back to Mushaf'}
            </button>
            
            <div className="order-3 flex w-full items-center justify-center gap-2 overflow-x-auto md:order-none md:w-auto md:flex-1">
              <select 
                value={surahNumber} 
                onChange={e => navigateTo({ surah: Number(e.target.value), ayah: 1 })}
                aria-label={lang === 'ar' ? 'السورة' : 'Surah'}
                className="min-w-32 bg-muted/40 text-sm md:text-base font-black text-center text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg transition-colors"
              >
                {surahs.map(s => (
                  <option key={s.index} value={s.index}>
                    {s.index}. {lang === 'ar' ? `سورة ${s.name}` : `Surah ${s.name}`}
                  </option>
                ))}
              </select>
              <select
                value={activeAyah}
                onChange={e => navigateTo({ surah: surahNumber, ayah: Number(e.target.value) })}
                aria-label={lang === 'ar' ? 'الآية' : 'Ayah'}
                className="bg-muted/40 text-sm font-bold text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg"
              >
                {surah.ayahs.map(ayah => (
                  <option key={ayah.index} value={ayah.index}>
                    {lang === 'ar' ? `آية ${ayah.index}` : `Ayah ${ayah.index}`}
                  </option>
                ))}
              </select>
              <select
                value={activeLocation.juz}
                onChange={e => navigateTo(getJuzStart(Number(e.target.value)))}
                aria-label={lang === 'ar' ? 'الجزء' : 'Juz'}
                className="bg-muted/40 text-sm font-bold text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg"
              >
                {Array.from({ length: MADANI_MUSHAF_METADATA.juzCount }, (_, index) => index + 1).map(juz => (
                  <option key={juz} value={juz}>
                    {lang === 'ar' ? `الجزء ${juz}` : `Juz ${juz}`}
                  </option>
                ))}
              </select>
              <select
                value={activeLocation.page}
                onChange={e => navigateTo(getPageStart(Number(e.target.value)))}
                aria-label={lang === 'ar' ? 'صفحة المصحف' : 'Mushaf page'}
                className="bg-muted/40 text-sm font-bold text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg"
              >
                {Array.from({ length: MADANI_MUSHAF_METADATA.pageCount }, (_, index) => index + 1).map(page => (
                  <option key={page} value={page}>
                    {lang === 'ar' ? `صفحة ${page}` : `Page ${page}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
              <QuranSearchDialog
                onSelect={({ chapterId, ayah }) =>
                  navigateTo({ surah: chapterId, ayah })
                }
              />
              <button onClick={() => setFontSize(f => Math.max(16, f - 2))} className="p-2 hover:bg-muted rounded-xl transition-colors"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => setFontSize(f => Math.min(60, f + 2))} className="p-2 hover:bg-muted rounded-xl transition-colors"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setIsQuietMode(true)} className="p-2 hover:bg-muted rounded-xl transition-colors hidden md:block"><EyeOff className="w-5 h-5" /></button>
            </div>
          </div>
          
          {startAyah && endAyah && (
            <div className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100 px-4 py-2 text-center text-sm font-bold shadow-inner border-y border-emerald-200/50 dark:border-emerald-800/50">
              {lang === 'ar' 
                ? `مهمة ${mode === 'memorization' ? 'حفظ' : 'مراجعة'}: الآيات ${startAyah} إلى ${endAyah}`
                : `${mode === 'memorization' ? 'Memorization' : 'Review'} Task: Ayahs ${startAyah} to ${endAyah}`}
            </div>
          )}
        </header>
      )}

      <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 pb-32 w-full max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block px-8 py-3 rounded-3xl border-2 border-emerald-800/10 bg-emerald-50/50 dark:border-emerald-500/10 dark:bg-emerald-950/20 shadow-sm">
            <h1 className="text-3xl md:text-5xl font-black text-emerald-900 dark:text-emerald-50" style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}>
              {lang === 'ar' ? `سورة ${surah.name}` : `Surah ${surah.name}`}
            </h1>
          </div>
        </div>

        {bismillah && (
          <div className="text-center mb-10">
            <span className="text-2xl md:text-4xl text-foreground/90 font-bold" style={{ fontFamily: "'KFGQPC Uthman Taha Naskh', 'Amiri', 'Traditional Arabic', serif", lineHeight: 2.2 }}>
              {bismillah}
            </span>
          </div>
        )}

        <div 
          className="text-center md:text-justify rtl"
          style={{ 
            fontSize: `${fontSize}px`, 
            lineHeight: 2.4,
            fontFamily: "'KFGQPC Uthman Taha Naskh', 'Amiri', 'Traditional Arabic', 'Scheherazade New', serif",
            direction: 'rtl'
          }}
        >
          {surah.ayahs.map(ayah => (
            <span 
              key={ayah.index} 
              id={`ayah-${ayah.index}`}
              className={cn(
                "inline transition-colors duration-300 rounded-md",
                isTaskAyah(ayah.index) ? "bg-amber-200/60 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100" : "text-foreground"
              )}
            >
              <span className="mx-1">{ayah.text}</span>
              <span className="inline-flex items-center justify-center relative w-[1.8em] h-[1.8em] rounded-full border border-current mx-[0.2em] text-emerald-700/50 dark:text-emerald-400/50 select-none font-sans align-middle">
                <span className="absolute inset-[2px] border border-dashed border-current rounded-full opacity-40"></span>
                <span className="absolute inset-0 flex items-center justify-center text-[0.45em] font-bold text-foreground/70">{ayah.index}</span>
              </span>
            </span>
          ))}
        </div>

        {!isQuietMode && (
          <div className="mt-20 flex flex-col sm:flex-row items-center justify-between border-t border-border/40 pt-8 gap-4">
            <button 
              onClick={handlePrev}
              disabled={surahNumber === 1}
              className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-card border border-border rounded-xl font-bold shadow-sm hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5 rtl:hidden" />
              <ChevronRight className="w-5 h-5 ltr:hidden" />
              {lang === 'ar' ? 'السورة السابقة' : 'Previous Surah'}
            </button>
            <button 
              onClick={handleNext}
              disabled={surahNumber === 114}
              className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-card border border-border rounded-xl font-bold shadow-sm hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {lang === 'ar' ? 'السورة التالية' : 'Next Surah'}
              <ChevronRight className="w-5 h-5 rtl:hidden" />
              <ChevronLeft className="w-5 h-5 ltr:hidden" />
            </button>
          </div>
        )}
      </main>

      {!isQuietMode && (
        <footer className="bg-muted/30 border-t border-border p-6 text-center text-xs text-muted-foreground shrink-0">
          <p className="font-bold mb-1">{lang === 'ar' ? 'مصدر النص: مشروع تنزيل' : 'Source Attribution - Tanzil Project'}</p>
          <p className="mb-2">
            {lang === 'ar' ? 'هذا النص القرآني منسوخ حرفياً وغير معدل من' : 'This Quranic text is copied literally and unmodified from'} <a href="https://tanzil.net" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">tanzil.net</a>
          </p>
          <p className="opacity-70">
            {lang === 'ar' ? 'رخصة المشاع الإبداعي — النَّسب 3.0' : 'License: Creative Commons Attribution 3.0'}
          </p>
        </footer>
      )}
    </div>
  );
}
