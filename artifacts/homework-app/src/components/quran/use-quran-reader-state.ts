import { useEffect, useRef, useCallback, useMemo } from 'react';
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

export function useQuranReaderState(options: { enabled?: boolean } = {}) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  
  const {
    data: readerState,
    isLoading: isReaderStateLoading,
    isError: isReaderStateError,
    refetch: refetchReaderState,
  } = useGetQuranReaderState({
    query: {
      enabled: options.enabled,
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

  const savePosition = useCallback((surahNumber: number, ayahNumber: number, pageNumber: number) => {
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
  }, [updatePositionMutation, queryClient, refetchReaderState]);
  
  const toggleBookmark = useCallback(async (surahNumber: number, ayahNumber: number, pageNumber: number, isBookmarked: boolean) => {
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
  }, [addBookmarkMutation, deleteBookmarkMutation, queryClient, lang]);

  const bookmarksMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (readerState?.bookmarks) {
      readerState.bookmarks.forEach(b => {
        map.set(`${b.surahNumber}:${b.ayahNumber}`, true);
      });
    }
    return map;
  }, [readerState?.bookmarks]);

  return {
    readerState,
    isReaderStateLoading,
    isReaderStateError,
    savePosition,
    toggleBookmark,
    bookmarksMap,
    isMutatingBookmark: addBookmarkMutation.isPending || deleteBookmarkMutation.isPending,
  };
}
