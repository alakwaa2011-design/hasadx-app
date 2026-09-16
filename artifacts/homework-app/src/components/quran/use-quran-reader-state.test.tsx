import { renderHook, act } from '@testing-library/react';
import { useQuranReaderState } from './use-quran-reader-state';
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
});
