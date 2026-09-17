// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const timingResults = new Map<number, {
  data?: TimingResult;
  isError?: boolean;
  isFetching?: boolean;
  isLoading?: boolean;
}>();

type TimingResult = {
  synchronized: boolean;
  audioUrl: string;
  verseStartMs: number;
  verseEndMs: number;
  segments: [];
};

let cachedNextTiming: TimingResult | undefined;
let fetchNextTiming: Promise<TimingResult> = Promise.resolve({
  synchronized: false,
  audioUrl: '',
  verseStartMs: 0,
  verseEndMs: 0,
  segments: [],
});
const prefetchQuery = vi.fn(() => Promise.resolve());
const fetchQuery = vi.fn(() => fetchNextTiming);
const getQueryData = vi.fn(() => cachedNextTiming);

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ lang: 'ar' }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    prefetchQuery,
    fetchQuery,
    getQueryData,
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@workspace/api-client-react', () => ({
  getListQuranRecitersQueryKey: () => ['reciters'],
  getGetQuranAyahTimingsQueryKey: (recitationId: number, surah: number, ayah: number) => [
    'timings',
    recitationId,
    surah,
    ayah,
  ],
  getGetQuranAyahTimingsQueryOptions: (
    recitationId: number,
    surah: number,
    ayah: number,
    options: unknown,
  ) => ({ recitationId, surah, ayah, ...options as object }),
  useListQuranReciters: () => ({
    data: {
      preferredRecitationId: 7,
      reciters: [{ id: 7, name: 'Test reciter', style: 'Murattal' }],
    },
    refetch: vi.fn(),
  }),
  useUpdateQuranAudioPreference: () => ({ mutateAsync: vi.fn() }),
  useGetQuranAyahTimings: (_recitationId: number, _surah: number, ayah: number) => ({
    data: timingResults.get(ayah)?.data,
    isError: timingResults.get(ayah)?.isError ?? false,
    isFetching: timingResults.get(ayah)?.isFetching ?? false,
    isLoading: timingResults.get(ayah)?.isLoading ?? false,
  }),
}));

import { QuranAudioPlayer } from './quran-audio-player';

const connectedFirst: TimingResult = {
  synchronized: true,
  audioUrl: '/surah.mp3',
  verseStartMs: 0,
  verseEndMs: 1_000,
  segments: [],
};

const connectedSecond: TimingResult = {
  synchronized: true,
  audioUrl: '/surah.mp3',
  verseStartMs: 1_000,
  verseEndMs: 2_000,
  segments: [],
};

function PlayerHarness() {
  const [playingAyah, setPlayingAyah] = useState<number | null>(1);
  return (
    <QuranAudioPlayer
      surahs={[{ ayahs: [{}, {}] }] as never}
      surahNumber={1}
      startAyah={1}
      endAyah={2}
      selectedAyah={1}
      playingAyah={playingAyah}
      onPlayingAyahChange={setPlayingAyah}
      isPlaying
      onIsPlayingChange={vi.fn()}
    />
  );
}

async function renderAtBoundary() {
  const view = render(<PlayerHarness />);
  const audio = await waitFor(() => {
    const element = view.container.querySelector('audio');
    expect(element).not.toBeNull();
    return element as HTMLAudioElement;
  });
  Object.defineProperty(audio, 'currentTime', { value: 1, writable: true });
  return { view, audio };
}

describe('QuranAudioPlayer zero-pause transitions', () => {
  const pause = vi.fn();
  const play = vi.fn(() => Promise.resolve());
  const load = vi.fn();
  const OriginalAudio = globalThis.Audio;

  beforeEach(() => {
    timingResults.clear();
    timingResults.set(1, { data: connectedFirst });
    cachedNextTiming = undefined;
    fetchNextTiming = Promise.resolve({
      synchronized: false,
      audioUrl: '',
      verseStartMs: 0,
      verseEndMs: 0,
      segments: [],
    });
    prefetchQuery.mockClear();
    fetchQuery.mockClear();
    getQueryData.mockClear();
    pause.mockClear();
    play.mockClear();
    load.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(load);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Audio = OriginalAudio;
  });

  it('moves through cached connected-surah timings without pausing or replacing audio', async () => {
    cachedNextTiming = connectedSecond;
    timingResults.set(2, { data: connectedSecond });
    const { view, audio } = await renderAtBoundary();
    pause.mockClear();

    fireEvent.timeUpdate(audio);

    await waitFor(() => expect(audio.currentTime).toBe(1));
    expect(view.container.querySelector('audio')).toBe(audio);
    expect(pause).not.toHaveBeenCalled();
    expect(audio.hasAttribute('src')).toBe(true);
  });

  it('keeps connected audio playing when next timing finishes loading at the boundary', async () => {
    let resolveTiming!: (timing: TimingResult) => void;
    fetchNextTiming = new Promise(resolve => { resolveTiming = resolve; });
    const { view, audio } = await renderAtBoundary();
    pause.mockClear();

    fireEvent.timeUpdate(audio);
    expect(fetchQuery).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();

    await act(async () => resolveTiming(connectedSecond));

    await waitFor(() => expect(view.container.querySelector('audio')).toBe(audio));
    expect(pause).not.toHaveBeenCalled();
    expect(audio.hasAttribute('src')).toBe(true);
  });

  it('preloads the next standalone ayah audio file', async () => {
    timingResults.set(1, { isError: true });
    const constructed: Array<{ src: string; preload: string; load: ReturnType<typeof vi.fn> }> = [];
    globalThis.Audio = class {
      src: string;
      preload = '';
      load = vi.fn();
      pause = vi.fn();
      removeAttribute = vi.fn();
      constructor(src: string) {
        this.src = src;
        constructed.push(this);
      }
    } as never;

    render(<PlayerHarness />);

    await waitFor(() => expect(constructed).toHaveLength(1));
    expect(constructed[0].src).toBe('/api/quran/audio/7/1/2');
    expect(constructed[0].preload).toBe('auto');
    expect(constructed[0].load).toHaveBeenCalledTimes(1);
  });
});