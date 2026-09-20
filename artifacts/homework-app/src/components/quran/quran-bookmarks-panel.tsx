import { Bookmark, Trash2, BookOpen, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { formatDistanceToNow } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { useQuranReaderState } from './use-quran-reader-state';
import { parseQuranXml } from '@/lib/quran-parser';
import { useEffect, useState } from 'react';

interface QuranBookmarksPanelProps {
  onNavigate: (location: { surah: number; ayah: number; page?: number }) => void;
  className?: string;
  storage?: 'server' | 'local' | 'optional';
}

export function QuranBookmarksPanel({ onNavigate, className, storage = 'server' }: QuranBookmarksPanelProps) {
  const { lang, dir } = useI18n();
  const {
    bookmarks,
    isReaderStateLoading,
    isReaderStateError,
    toggleBookmark,
    isMutatingBookmark,
  } = useQuranReaderState({ enabled: true, storage });
  const [surahNames, setSurahNames] = useState<Record<number, string>>({});

  useEffect(() => {
    let mounted = true;
    import('@/data/quran/tanzil-uthmani.xml?raw').then(m => {
      if (!mounted) return;
      const parsed = parseQuranXml(m.default);
      const names: Record<number, string> = {};
      parsed.forEach(s => {
        names[s.index] = s.name;
      });
      setSurahNames(names);
    });
    return () => { mounted = false; };
  }, []);

  if (isReaderStateLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (isReaderStateError) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <Bookmark className="h-10 w-10 opacity-20" />
        <p className="text-sm font-bold">
          {lang === 'ar' ? 'تعذر تحميل العلامات المحفوظة' : 'Could not load saved bookmarks'}
        </p>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <Bookmark className="h-10 w-10 opacity-20" />
        <p className="text-sm font-bold">
          {lang === 'ar' ? 'لا توجد علامات محفوظة' : 'No saved bookmarks'}
        </p>
      </div>
    );
  }

  // Sort bookmarks by updatedAt descending
  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const firstUpdatedAt = 'updatedAt' in a ? new Date(a.updatedAt as string).getTime() : 0;
    const secondUpdatedAt = 'updatedAt' in b ? new Date(b.updatedAt as string).getTime() : 0;
    return secondUpdatedAt - firstUpdatedAt;
  });

  return (
    <div className={`space-y-3 ${className || ''}`} dir={dir}>
      {sortedBookmarks.map((bookmark) => {
        const surahName = surahNames[bookmark.surahNumber] || bookmark.surahNumber.toString();
        const timeAgo = 'updatedAt' in bookmark
          ? formatDistanceToNow(new Date(bookmark.updatedAt as string), {
              addSuffix: true,
              locale: lang === 'ar' ? arSA : enUS,
            })
          : null;

        return (
          <div
            key={`${bookmark.surahNumber}-${bookmark.ayahNumber}`}
            className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-emerald-500/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                className="flex flex-1 items-start gap-3 text-start"
                onClick={() => onNavigate({ surah: bookmark.surahNumber, ayah: bookmark.ayahNumber, page: bookmark.pageNumber })}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">
                    {lang === 'ar' ? `سورة ${surahName}` : `Surah ${surahName}`}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">
                    {lang === 'ar' 
                      ? `الآية ${bookmark.ayahNumber} • صفحة ${bookmark.pageNumber}`
                      : `Ayah ${bookmark.ayahNumber} • Page ${bookmark.pageNumber}`}
                  </span>
                  {timeAgo && <span className="mt-1 text-xs text-muted-foreground">{timeAgo}</span>}
                </div>
              </button>
              
              <button
                onClick={() => toggleBookmark(bookmark.surahNumber, bookmark.ayahNumber, bookmark.pageNumber, true)}
                disabled={isMutatingBookmark}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive focus:outline-none disabled:opacity-50"
                aria-label={lang === 'ar' ? 'حذف العلامة' : 'Delete bookmark'}
                title={lang === 'ar' ? 'حذف العلامة' : 'Delete bookmark'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
