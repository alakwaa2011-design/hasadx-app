import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetQuranReaderState,
  useUpdateQuranReaderPosition,
  useAddQuranBookmark,
  useDeleteQuranBookmark,
  useUpdateQuranAudioPreference,
  useListQuranReciters,
  getListQuranRecitersQueryKey,
  getGetQuranReaderStateQueryKey
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export interface StandaloneQuranReaderState {
  position: {
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
  } | null;
  bookmarks: Array<{
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
  }>;
}

export const STANDALONE_QURAN_READER_KEY = 'hasaad:standalone-quran-reader:v1';
export const STANDALONE_QURAN_SYNC_KEY = 'hasaad:standalone-quran-sync:v1';
const STANDALONE_QURAN_RECITATION_KEY = 'hasaad:standalone-quran-recitation-id';

export function resolveStandaloneReaderPosition(
  syncEnabled: boolean,
  localPosition: StandaloneQuranReaderState['position'],
  accountPosition: StandaloneQuranReaderState['position'],
) {
  return syncEnabled ? (accountPosition ?? localPosition) : localPosition;
}

const EMPTY_STANDALONE_STATE: StandaloneQuranReaderState = {
  position: null,
  bookmarks: [],
};

export function readStandaloneQuranReaderState(): StandaloneQuranReaderState {
  if (typeof window === 'undefined') return EMPTY_STANDALONE_STATE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STANDALONE_QURAN_READER_KEY) ?? 'null') as Partial<StandaloneQuranReaderState> | null;
    const position = parsed?.position;
    const bookmarks = Array.isArray(parsed?.bookmarks) ? parsed.bookmarks : [];
    return {
      position: position
        && Number.isInteger(position.surahNumber)
        && Number.isInteger(position.ayahNumber)
        && Number.isInteger(position.pageNumber)
        ? {
            surahNumber: position.surahNumber,
            ayahNumber: position.ayahNumber,
            pageNumber: position.pageNumber,
          }
        : null,
      bookmarks: bookmarks.filter((bookmark) =>
        Number.isInteger(bookmark?.surahNumber)
        && Number.isInteger(bookmark?.ayahNumber)
        && Number.isInteger(bookmark?.pageNumber)
      ),
    };
  } catch {
    return EMPTY_STANDALONE_STATE;
  }
}

function persistStandaloneQuranReaderState(state: StandaloneQuranReaderState) {
  try {
    window.localStorage.setItem(STANDALONE_QURAN_READER_KEY, JSON.stringify(state));
  } catch {
    // Keep the current in-memory state when storage is unavailable.
  }
}

export function useQuranReaderState(options: {
  enabled?: boolean;
  storage?: 'server' | 'local' | 'optional';
} = {}) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const isOptional = options.storage === 'optional';
  const [syncEnabled, setSyncEnabledState] = useState(
    () => isOptional && window.localStorage.getItem(STANDALONE_QURAN_SYNC_KEY) === 'true',
  );
  const [localState, setLocalState] = useState<StandaloneQuranReaderState>(
    readStandaloneQuranReaderState,
  );
  
  const {
    data: readerState,
    isLoading: isReaderStateLoading,
    isError: isReaderStateError,
    error: readerStateError,
    refetch: refetchReaderState,
  } = useGetQuranReaderState({
    query: {
      enabled: options.enabled && options.storage !== 'local',
      queryKey: getGetQuranReaderStateQueryKey(),
      staleTime: 60 * 1000,
      retry: false,
    }
  });
  const isLocal = options.storage === 'local'
    || (isOptional && (!syncEnabled || isReaderStateLoading || isReaderStateError || !readerState));

  const updatePositionMutation = useUpdateQuranReaderPosition();
  const addBookmarkMutation = useAddQuranBookmark();
  const deleteBookmarkMutation = useDeleteQuranBookmark();
  const updateAudioPreferenceMutation = useUpdateQuranAudioPreference();
  const reciterCatalog = useListQuranReciters({
    query: {
      enabled: isOptional,
      retry: false,
      staleTime: 60 * 1000,
      queryKey: getListQuranRecitersQueryKey(),
    },
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // state variables for optimistic UI or keeping track of what was saved
  const lastSavedPositionRef = useRef<{ surahNumber: number; ayahNumber: number; pageNumber: number } | null>(null);
  const positionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const revisionRef = useRef<number>(1);

  // Update revision when data arrives
  useEffect(() => {
    if (readerState?.position?.revision) {
      revisionRef.current = readerState.position.revision;
    }
  }, [readerState?.position?.revision]);

  useEffect(() => () => {
    if (positionTimeoutRef.current) {
      clearTimeout(positionTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isLocal) return;
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === STANDALONE_QURAN_READER_KEY) {
        setLocalState(readStandaloneQuranReaderState());
      }
    };
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, [isLocal]);

  useEffect(() => {
    const error = readerStateError as {
      status?: number;
      response?: { status?: number };
    } | null;
    const status = error?.status ?? error?.response?.status;
    if (!isOptional || !syncEnabled || status !== 401) return;
    window.localStorage.setItem(STANDALONE_QURAN_SYNC_KEY, 'false');
    setSyncEnabledState(false);
  }, [isOptional, readerStateError, syncEnabled]);

  const savePosition = useCallback((surahNumber: number, ayahNumber: number, pageNumber: number) => {
    if (isLocal) {
      if (
        isOptional
        && !syncEnabled
        && localState.position === null
        && surahNumber === 1
        && ayahNumber === 1
        && pageNumber === 1
      ) {
        return;
      }
      setLocalState((current) => {
        if (
          current.position?.surahNumber === surahNumber
          && current.position.ayahNumber === ayahNumber
          && current.position.pageNumber === pageNumber
        ) return current;
        const next = {
          ...current,
          position: { surahNumber, ayahNumber, pageNumber },
        };
        persistStandaloneQuranReaderState(next);
        return next;
      });
      return;
    }
    if (
      lastSavedPositionRef.current?.surahNumber === surahNumber &&
      lastSavedPositionRef.current?.ayahNumber === ayahNumber &&
      lastSavedPositionRef.current?.pageNumber === pageNumber
    ) {
      return;
    }
    
    if (positionTimeoutRef.current) {
      clearTimeout(positionTimeoutRef.current);
    }
    
    positionTimeoutRef.current = setTimeout(() => {
      lastSavedPositionRef.current = { surahNumber, ayahNumber, pageNumber };
      updatePositionMutation.mutate({
        data: {
          surahNumber,
          ayahNumber,
          pageNumber,
          expectedRevision: revisionRef.current,
        }
      }, {
        onSuccess: (data) => {
          if (data && typeof data === 'object' && 'revision' in data) {
            revisionRef.current = (data as any).revision;
          }
          // Do not invalidate all queries to avoid full refetch that could revert cross-tab states abruptly?
          // The instructions say: "handle 409 by refetching, do not regress newer cross-tab state."
          queryClient.setQueryData(getGetQuranReaderStateQueryKey(), (old: any) => {
            if (!old) return old;
            return {
              ...old,
              position: data
            };
          });
        },
        onError: (error: any) => {
          const status = error?.status ?? error?.response?.status;
          if (status === 409) {
            lastSavedPositionRef.current = null;
            void refetchReaderState();
          }
        }
      });
    }, 1500); // modest debounce
  }, [
    isLocal,
    isOptional,
    localState.position,
    queryClient,
    refetchReaderState,
    syncEnabled,
    updatePositionMutation,
  ]);
  
  const toggleBookmark = useCallback(async (surahNumber: number, ayahNumber: number, pageNumber: number, isBookmarked: boolean) => {
      if (isLocal) {
        setLocalState((current) => {
          const bookmarks = isBookmarked
            ? current.bookmarks.filter((bookmark) =>
                bookmark.surahNumber !== surahNumber || bookmark.ayahNumber !== ayahNumber
              )
            : [
                ...current.bookmarks.filter((bookmark) =>
                  bookmark.surahNumber !== surahNumber || bookmark.ayahNumber !== ayahNumber
                ),
                { surahNumber, ayahNumber, pageNumber },
              ];
          const next = { ...current, bookmarks };
          persistStandaloneQuranReaderState(next);
          return next;
        });
        toast.success(lang === 'ar'
          ? (isBookmarked ? 'تمت إزالة العلامة المرجعية' : 'تم حفظ العلامة المرجعية')
          : (isBookmarked ? 'Bookmark removed' : 'Bookmark saved'));
        return;
      }
      try {
        if (isBookmarked) {
          await deleteBookmarkMutation.mutateAsync({ surahNumber, ayahNumber });
          toast.success(lang === 'ar' ? 'تمت إزالة العلامة المرجعية' : 'Bookmark removed');
        } else {
          await addBookmarkMutation.mutateAsync({
            surahNumber,
            ayahNumber,
            data: { pageNumber }
          });
          toast.success(lang === 'ar' ? 'تم حفظ العلامة المرجعية' : 'Bookmark saved');
        }
        await queryClient.invalidateQueries({ queryKey: getGetQuranReaderStateQueryKey() });
      } catch (err) {
         toast.error(lang === 'ar' ? 'حدث خطأ أثناء تحديث العلامة المرجعية' : 'An error occurred while updating the bookmark');
      }
  }, [addBookmarkMutation, deleteBookmarkMutation, isLocal, queryClient, lang]);

  const bookmarksMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (isLocal) {
      localState.bookmarks.forEach((bookmark) => {
        map.set(`${bookmark.surahNumber}:${bookmark.ayahNumber}`, true);
      });
    } else if (readerState?.bookmarks) {
      readerState.bookmarks.forEach(b => {
        map.set(`${b.surahNumber}:${b.ayahNumber}`, true);
      });
    }
    return map;
  }, [isLocal, localState.bookmarks, readerState?.bookmarks]);

  const canSync = isOptional && !isReaderStateLoading && !isReaderStateError && Boolean(readerState);

  const setSyncEnabled = useCallback(async (enabled: boolean) => {
    if (!isOptional || isSyncing || (enabled && !canSync)) return false;
    setIsSyncing(true);
    try {
      if (enabled) {
        const local = readStandaloneQuranReaderState();
        const serverBookmarks = readerState?.bookmarks ?? [];
        const mergedBookmarks = new Map<string, { surahNumber: number; ayahNumber: number; pageNumber: number }>();
        for (const bookmark of [...serverBookmarks, ...local.bookmarks]) {
          mergedBookmarks.set(`${bookmark.surahNumber}:${bookmark.ayahNumber}`, {
            surahNumber: bookmark.surahNumber,
            ayahNumber: bookmark.ayahNumber,
            pageNumber: bookmark.pageNumber,
          });
        }
        await Promise.all(Array.from(mergedBookmarks.values()).map((bookmark) =>
          addBookmarkMutation.mutateAsync({
            surahNumber: bookmark.surahNumber,
            ayahNumber: bookmark.ayahNumber,
            data: { pageNumber: bookmark.pageNumber },
          })
        ));
        if (local.position) {
          const position = await updatePositionMutation.mutateAsync({
            data: {
              ...local.position,
              expectedRevision: readerState?.position?.revision ?? 1,
            },
          });
          revisionRef.current = position.revision;
        }
        const localRecitationId = Number(window.localStorage.getItem(STANDALONE_QURAN_RECITATION_KEY));
        if (Number.isInteger(localRecitationId) && localRecitationId > 0) {
          await updateAudioPreferenceMutation.mutateAsync({ data: { recitationId: localRecitationId } });
        } else if (reciterCatalog.data?.preferredRecitationId) {
          window.localStorage.setItem(
            STANDALONE_QURAN_RECITATION_KEY,
            String(reciterCatalog.data.preferredRecitationId),
          );
        }
        persistStandaloneQuranReaderState({
          position: local.position ?? (readerState?.position ? {
            surahNumber: readerState.position.surahNumber,
            ayahNumber: readerState.position.ayahNumber,
            pageNumber: readerState.position.pageNumber,
          } : null),
          bookmarks: Array.from(mergedBookmarks.values()),
        });
        window.localStorage.setItem(STANDALONE_QURAN_SYNC_KEY, 'true');
        setSyncEnabledState(true);
        await queryClient.invalidateQueries({ queryKey: getGetQuranReaderStateQueryKey() });
      } else {
        if (reciterCatalog.data?.preferredRecitationId) {
          window.localStorage.setItem(
            STANDALONE_QURAN_RECITATION_KEY,
            String(reciterCatalog.data.preferredRecitationId),
          );
        }
        const serverPosition = readerState?.position;
        persistStandaloneQuranReaderState({
          position: serverPosition ? {
            surahNumber: serverPosition.surahNumber,
            ayahNumber: serverPosition.ayahNumber,
            pageNumber: serverPosition.pageNumber,
          } : localState.position,
          bookmarks: Array.from(new Map(
            [...localState.bookmarks, ...(readerState?.bookmarks ?? [])].map((bookmark) => [
              `${bookmark.surahNumber}:${bookmark.ayahNumber}`,
              { surahNumber: bookmark.surahNumber, ayahNumber: bookmark.ayahNumber, pageNumber: bookmark.pageNumber },
            ]),
          ).values()),
        });
        setLocalState(readStandaloneQuranReaderState());
        window.localStorage.setItem(STANDALONE_QURAN_SYNC_KEY, 'false');
        setSyncEnabledState(false);
      }
      return true;
    } catch {
      toast.error(lang === 'ar' ? 'تعذر تحديث مزامنة المصحف' : 'Could not update Quran sync');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [
    addBookmarkMutation,
    canSync,
    isOptional,
    isSyncing,
    lang,
    localState.bookmarks,
    localState.position,
    queryClient,
    reciterCatalog.data?.preferredRecitationId,
    readerState,
    updateAudioPreferenceMutation,
    updatePositionMutation,
  ]);

  return {
    readerState,
    localStatePosition: localState.position,
    isReaderStateLoading: isLocal ? false : isReaderStateLoading,
    isReaderStateError: isLocal ? false : isReaderStateError,
    savePosition,
    toggleBookmark,
    bookmarksMap,
    isMutatingBookmark: isLocal ? false : addBookmarkMutation.isPending || deleteBookmarkMutation.isPending,
    canSync,
    syncEnabled,
    syncActive: isOptional && !isLocal,
    isSyncing,
    setSyncEnabled,
  };
}
