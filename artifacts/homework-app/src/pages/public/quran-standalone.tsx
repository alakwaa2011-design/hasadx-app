import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useParams } from "wouter";
import { QuranPagesView } from "@/pages/teacher/quran-pages-view";
import { useI18n } from "@/lib/i18n";
import {
  readStandaloneQuranReaderState,
  resolveStandaloneReaderPosition,
  STANDALONE_QURAN_SYNC_KEY,
} from "@/components/quran/use-quran-reader-state";
import {
  getGetQuranReaderStateQueryKey,
  useGetQuranReaderState,
} from "@workspace/api-client-react";
import chapters from "@/data/quran/qcomplex/chapters.json";
import verses from "@/data/quran/qcomplex/verses.json";

const isTaskAyah = () => false;
const parseBoundedInteger = (value: string | null | undefined, min: number, max: number) =>
  value && /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max
    ? Number(value)
    : null;

export function PublicQuranStandalone() {
  const { lang } = useI18n();
  const params = useParams<{ surahNumber?: string }>();
  const [, setLocation] = useLocation();
  const savedState = useMemo(readStandaloneQuranReaderState, []);
  const [syncRequested, setSyncRequested] = useState(
    () => window.localStorage.getItem(STANDALONE_QURAN_SYNC_KEY) === "true",
  );
  const {
    data: syncedState,
    isLoading: isSyncedStateLoading,
    isError: isSyncedStateError,
    error: syncedStateError,
  } = useGetQuranReaderState({
    query: {
      enabled: syncRequested,
      retry: false,
      queryKey: getGetQuranReaderStateQueryKey(),
      staleTime: 60 * 1000,
    },
  });
  useEffect(() => {
    const error = syncedStateError as {
      status?: number;
      response?: { status?: number };
    } | null;
    const status = error?.status ?? error?.response?.status;
    if (!syncRequested || !isSyncedStateError || status !== 401) return;
    window.localStorage.setItem(STANDALONE_QURAN_SYNC_KEY, "false");
    setSyncRequested(false);
  }, [isSyncedStateError, syncRequested, syncedStateError]);
  const initialPosition = resolveStandaloneReaderPosition(
    syncRequested,
    savedState.position,
    syncedState?.position ?? null,
  );
  const searchParams = new URLSearchParams(window.location.search);
  
  const initialSurah = parseBoundedInteger(params.surahNumber, 1, 114)
    ?? (params.surahNumber ? 1 : (initialPosition?.surahNumber ?? 1));
  
  const ayahParam = searchParams.get("ayah");
  const validInitialAyah = parseBoundedInteger(
    ayahParam,
    1,
    chapters[initialSurah - 1]?.verse_count ?? 1,
  ) ?? (params.surahNumber ? 1 : (initialPosition?.ayahNumber ?? 1));

  const pageParam = searchParams.get("page");
  const requestedPage = parseBoundedInteger(pageParam, 1, 604)
    ?? (params.surahNumber ? undefined : (initialPosition?.pageNumber ?? undefined));
  const canonicalVersePage = verses.find(
    (verse) => verse.chapter_id === initialSurah && verse.number === validInitialAyah,
  )?.page_id;
  const validInitialPage = requestedPage === canonicalVersePage ? requestedPage : undefined;

  const handleNavigate = useCallback((nav: { surah: number; ayah: number; page?: number }) => {
    const newParams = new URLSearchParams();
    newParams.set("ayah", nav.ayah.toString());
    if (nav.page) {
      newParams.set("page", nav.page.toString());
    }
    newParams.set("view", "pages");
    
    // Use replace: true so scrolling through pages doesn't spam the browser history
    setLocation(`/quran/${nav.surah}?${newParams.toString()}`, { replace: true });
  }, [setLocation]);

  const title = lang === "ar" ? "المصحف الشريف" : "The Noble Quran";
  const description = lang === "ar" 
    ? "المصحف الشريف للقراءة والاستماع. تجربة قراءة مريحة بدون تشتيت." 
    : "The Noble Quran for reading and listening. A comfortable, distraction-free reading experience.";

  if (syncRequested && isSyncedStateLoading) {
    return (
      <main
        className="grid min-h-[100dvh] place-items-center bg-stone-50 text-sm font-bold text-stone-600 dark:bg-[#0a0c0b] dark:text-stone-300"
        aria-busy="true"
      >
        {lang === "ar" ? "جارٍ استعادة موضع المصحف…" : "Restoring your Quran position…"}
      </main>
    );
  }

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Helmet>
      
      <QuranPagesView
        key={`${syncRequested ? "synced" : "local"}-${params.surahNumber ? "explicit-location" : `saved-${initialPosition?.surahNumber ?? 1}-${initialPosition?.ayahNumber ?? 1}-${initialPosition?.pageNumber ?? 1}`}`}
        initialSurah={initialSurah}
        initialAyah={validInitialAyah}
        initialPage={validInitialPage}
        onNavigate={handleNavigate}
        isTaskAyah={isTaskAyah}
        startAyah={null}
        endAyah={null}
        mode={null}
        readerBasePath="/quran"
        backHref="/"
        backLabel={{ ar: "الرئيسية", en: "Home" }}
        isIndependentPractice={false}
        embedded={false}
        standalone
        onStandaloneSyncChange={setSyncRequested}
        liveRecitationAvailable={false}
      />
    </>
  );
}

export default PublicQuranStandalone;
