import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetQuranReaderState,
  useUpdateQuranReaderPosition,
  useAddQuranBookmark,
  useDeleteQuranBookmark,
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
  storage?: 'server' | 'local';
} = {}) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const isLocal = options.storage === 'local';
  const [localState, setLocalState] = useState<StandaloneQuranReaderState>(
    readStandaloneQuranReaderState,
  );
  
  const {
    data: readerState,
    isLoading: isReaderStateLoading,
    isError: isReaderStateError,
    refetch: refetchReaderState,
  } = useGetQuranReaderState({
    query: {
      enabled: options.enabled && !isLocal,
      queryKey: getGetQuranReaderStateQueryKey(),
      staleTime: 60 * 1000,
    }
  });

  const updatePositionMutation = useUpdateQuranReaderPosition();
  const addBookmarkMutation = useAddQuranBookmark();
  const deleteBookmarkMutation = useDeleteQuranBookmark();

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

  const savePosition = useCallback((surahNumber: number, ayahNumber: number, pageNumber: number) => {
    if (isLocal) {
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
  }, [isLocal, updatePositionMutation, queryClient, refetchReaderState]);
  
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

  return {
    readerState,
    isReaderStateLoading: isLocal ? false : isReaderStateLoading,
    isReaderStateError: isLocal ? false : isReaderStateError,
    savePosition,
    toggleBookmark,
    bookmarksMap,
    isMutatingBookmark: isLocal ? false : addBookmarkMutation.isPending || deleteBookmarkMutation.isPending,
  };
}
