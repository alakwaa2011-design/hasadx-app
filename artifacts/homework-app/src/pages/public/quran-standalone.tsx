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
  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = {
      manifest: manifest?.getAttribute("href"),
      appleTitle: appleTitle?.getAttribute("content"),
      appleIcon: appleIcon?.getAttribute("href"),
      favicon: favicon?.getAttribute("href"),
      themeColor: themeColor?.getAttribute("content"),
    };

    manifest?.setAttribute("href", "/quran-manifest.json");
    appleTitle?.setAttribute("content", "مصحف حصاد");
    appleIcon?.setAttribute("href", "/icons/quran-hasaad-180.png");
    favicon?.setAttribute("href", "/icons/quran-hasaad-192.png");
    themeColor?.setAttribute("content", "#123D2E");

    return () => {
      if (previous.manifest) manifest?.setAttribute("href", previous.manifest);
      if (previous.appleTitle) appleTitle?.setAttribute("content", previous.appleTitle);
      if (previous.appleIcon) appleIcon?.setAttribute("href", previous.appleIcon);
      if (previous.favicon) favicon?.setAttribute("href", previous.favicon);
      if (previous.themeColor) themeColor?.setAttribute("content", previous.themeColor);
    };
  }, []);
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

  const title = lang === "ar" ? "مصحف حصاد" : "Hasaad Quran";
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
        <meta property="og:site_name" content="مصحف حصاد" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content="https://hasaadx.com/quran" />
        <meta property="og:image" content="https://hasaadx.com/quran-share.png" />
        <meta property="og:image:alt" content="أيقونة مصحف حصاد" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://hasaadx.com/quran-share.png" />
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
