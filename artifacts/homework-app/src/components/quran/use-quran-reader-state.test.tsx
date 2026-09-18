import { renderHook, act } from '@testing-library/react';
import {
  readStandaloneQuranReaderState,
  resolveStandaloneReaderPosition,
  STANDALONE_QURAN_READER_KEY,
  useQuranReaderState,
} from './use-quran-reader-state';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as apiClient from '@workspace/api-client-react';

vi.mock('@workspace/api-client-react', async () => {
  const actual = await vi.importActual('@workspace/api-client-react');
  return {
    ...actual as any,
    useGetQuranReaderState: vi.fn(),
    useUpdateQuranReaderPosition: vi.fn(),
    useAddQuranBookmark: vi.fn(),
    useDeleteQuranBookmark: vi.fn(),
    useUpdateQuranAudioPreference: vi.fn(),
    useListQuranReciters: vi.fn(),
  };
});

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ lang: 'en' }),
}));

describe('useQuranReaderState', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    window.localStorage.removeItem(STANDALONE_QURAN_READER_KEY);
    window.localStorage.removeItem('hasaad:standalone-quran-sync:v1');
    vi.mocked(apiClient.useUpdateQuranAudioPreference).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ preferredRecitationId: 1 }),
    } as any);
    vi.mocked(apiClient.useListQuranReciters).mockReturnValue({
      data: { reciters: [], preferredRecitationId: null },
    } as any);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('provides bookmark toggle functionality', async () => {
    const mockAddBookmark = vi.fn().mockResolvedValue({});
    const mockDeleteBookmark = vi.fn().mockResolvedValue({});
    
    vi.mocked(apiClient.useGetQuranReaderState).mockReturnValue({
      data: { position: null, bookmarks: [] },
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    
    vi.mocked(apiClient.useAddQuranBookmark).mockReturnValue({
      mutateAsync: mockAddBookmark,
      isPending: false,
    } as any);

    vi.mocked(apiClient.useDeleteQuranBookmark).mockReturnValue({
      mutateAsync: mockDeleteBookmark,
      isPending: false,
    } as any);

    const { result } = renderHook(() => useQuranReaderState(), { wrapper });

    await act(async () => {
      await result.current.toggleBookmark(1, 1, 1, false);
    });

    expect(mockAddBookmark).toHaveBeenCalledWith({
      surahNumber: 1,
      ayahNumber: 1,
      data: { pageNumber: 1 }
    });
    
    await act(async () => {
      await result.current.toggleBookmark(1, 1, 1, true);
    });
    
    expect(mockDeleteBookmark).toHaveBeenCalledWith({
      surahNumber: 1,
      ayahNumber: 1
    });
  });

  it('stores standalone position and bookmarks locally without API mutations', async () => {
    const updatePosition = vi.fn();
    const addBookmark = vi.fn();
    const deleteBookmark = vi.fn();
    vi.mocked(apiClient.useGetQuranReaderState).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(apiClient.useUpdateQuranReaderPosition).mockReturnValue({
      mutate: updatePosition,
      mutateAsync: vi.fn(),
    } as any);
    vi.mocked(apiClient.useAddQuranBookmark).mockReturnValue({
      mutateAsync: addBookmark,
      isPending: false,
    } as any);
    vi.mocked(apiClient.useDeleteQuranBookmark).mockReturnValue({
      mutateAsync: deleteBookmark,
      isPending: false,
    } as any);

    const { result } = renderHook(
      () => useQuranReaderState({ enabled: true, storage: 'local' }),
      { wrapper },
    );

    act(() => result.current.savePosition(2, 5, 3));
    await act(async () => result.current.toggleBookmark(2, 5, 3, false));

    expect(readStandaloneQuranReaderState()).toEqual({
      position: { surahNumber: 2, ayahNumber: 5, pageNumber: 3 },
      bookmarks: [{ surahNumber: 2, ayahNumber: 5, pageNumber: 3 }],
    });
    expect(result.current.bookmarksMap.has('2:5')).toBe(true);
    expect(updatePosition).not.toHaveBeenCalled();
    expect(addBookmark).not.toHaveBeenCalled();
    expect(deleteBookmark).not.toHaveBeenCalled();
    expect(apiClient.useGetQuranReaderState).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({ enabled: false }),
    }));
  });

  it('merges local bookmarks into the account when optional sync is enabled', async () => {
    window.localStorage.setItem(STANDALONE_QURAN_READER_KEY, JSON.stringify({
      position: { surahNumber: 2, ayahNumber: 5, pageNumber: 3 },
      bookmarks: [{ surahNumber: 2, ayahNumber: 5, pageNumber: 3 }],
    }));
    const addBookmark = vi.fn().mockResolvedValue({});
    const updatePosition = vi.fn().mockResolvedValue({
      surahNumber: 2, ayahNumber: 5, pageNumber: 3, revision: 4,
    });
    vi.mocked(apiClient.useGetQuranReaderState).mockReturnValue({
      data: {
        position: { surahNumber: 1, ayahNumber: 1, pageNumber: 1, revision: 3 },
        bookmarks: [{ surahNumber: 1, ayahNumber: 1, pageNumber: 1 }],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(apiClient.useUpdateQuranReaderPosition).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: updatePosition,
    } as any);
    vi.mocked(apiClient.useAddQuranBookmark).mockReturnValue({
      mutateAsync: addBookmark,
      isPending: false,
    } as any);
    vi.mocked(apiClient.useDeleteQuranBookmark).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    const { result } = renderHook(
      () => useQuranReaderState({ enabled: true, storage: 'optional' }),
      { wrapper },
    );

    await act(async () => {
      expect(await result.current.setSyncEnabled(true)).toBe(true);
    });

    expect(addBookmark).toHaveBeenCalledTimes(2);
    expect(updatePosition).toHaveBeenCalledWith({
      data: {
        surahNumber: 2,
        ayahNumber: 5,
        pageNumber: 3,
        expectedRevision: 3,
      },
    });
    expect(window.localStorage.getItem('hasaad:standalone-quran-sync:v1')).toBe('true');
    expect(readStandaloneQuranReaderState().bookmarks).toHaveLength(2);
  });

  it('keeps the local position when account data enters the shared cache while sync is off', () => {
    expect(resolveStandaloneReaderPosition(
      false,
      { surahNumber: 2, ayahNumber: 5, pageNumber: 3 },
      { surahNumber: 18, ayahNumber: 10, pageNumber: 294 },
    )).toEqual({ surahNumber: 2, ayahNumber: 5, pageNumber: 3 });
  });

  it('pulls the account reciter onto a first-time device when sync is enabled', async () => {
    vi.mocked(apiClient.useGetQuranReaderState).mockReturnValue({
      data: { position: null, bookmarks: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(apiClient.useListQuranReciters).mockReturnValue({
      data: { reciters: [{ id: 77 }], preferredRecitationId: 77 },
    } as any);
    vi.mocked(apiClient.useUpdateQuranReaderPosition).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    } as any);
    vi.mocked(apiClient.useAddQuranBookmark).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(apiClient.useDeleteQuranBookmark).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    const { result } = renderHook(
      () => useQuranReaderState({ enabled: true, storage: 'optional' }),
      { wrapper },
    );
    await act(async () => {
      expect(await result.current.setSyncEnabled(true)).toBe(true);
    });

    expect(window.localStorage.getItem('hasaad:standalone-quran-recitation-id')).toBe('77');
    expect(apiClient.useUpdateQuranAudioPreference().mutateAsync).not.toHaveBeenCalled();
  });
});
