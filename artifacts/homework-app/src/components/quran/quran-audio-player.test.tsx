// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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
const savePreference = vi.fn(() => Promise.resolve());

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
      reciters: [
        { id: 7, name: 'First reciter', style: 'Murattal' },
        { id: 8, name: 'Second reciter', style: 'Murattal' },
      ],
    },
    refetch: vi.fn(),
  }),
  useUpdateQuranAudioPreference: () => ({
    mutateAsync: savePreference,
    isPending: false,
  }),
  useGetQuranAyahTimings: (_recitationId: number, _surah: number, ayah: number) => ({
    data: timingResults.get(ayah)?.data,
    isError: timingResults.get(ayah)?.isError ?? false,
    isFetching: timingResults.get(ayah)?.isFetching ?? false,
    isLoading: timingResults.get(ayah)?.isLoading ?? false,
  }),
}));

import { QuranAudioPlayer } from './quran-audio-player';
import { QuranAudioHostProvider } from './quran-audio-host';

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
    <QuranAudioHostProvider>
      <output data-testid="playing-ayah">{playingAyah ?? 'stopped'}</output>
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
    </QuranAudioHostProvider>
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
    savePreference.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(load);
  });

  afterEach(() => {
    cleanup();
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

  it('places previous on the right and next on the left in Arabic', async () => {
    const { getByTestId } = render(<PlayerHarness />);

    const previous = getByTestId('button-prev-ayah') as HTMLButtonElement;
    const next = getByTestId('button-next-ayah') as HTMLButtonElement;
    const controls = previous.parentElement;
    expect(controls).not.toBeNull();
    expect(controls?.getAttribute('dir')).toBe('rtl');
    expect(controls?.firstElementChild).toBe(previous);
    expect(controls?.lastElementChild).toBe(next);
    expect(previous.querySelector('svg')?.classList.contains('scale-x-[-1]')).toBe(true);
    expect(next.querySelector('svg')?.classList.contains('scale-x-[-1]')).toBe(true);

    expect(previous.disabled).toBe(true);
    fireEvent.click(next);
    await waitFor(() => expect(previous.disabled).toBe(false));
    fireEvent.click(previous);
    await waitFor(() => expect(previous.disabled).toBe(true));
  });

  it('ignores an old boundary response after the user advances the ayah', async () => {
    let resolveTiming!: (timing: TimingResult) => void;
    fetchNextTiming = new Promise(resolve => { resolveTiming = resolve; });
    const { view, audio } = await renderAtBoundary();

    fireEvent.timeUpdate(audio);
    expect(fetchQuery).toHaveBeenCalledTimes(1);

    timingResults.set(2, { data: connectedSecond });
    fireEvent.click(view.getByTestId('button-next-ayah'));
    await waitFor(() => expect(view.getByTestId('playing-ayah').textContent).toBe('2'));
    await waitFor(() => expect(pause).toHaveBeenCalled());
    pause.mockClear();

    await act(async () => resolveTiming(connectedSecond));

    expect(view.getByTestId('playing-ayah').textContent).toBe('2');
    expect(pause).not.toHaveBeenCalled();
  });

  it('does not let an old timing response stop a newly selected reciter', async () => {
    let resolveTiming!: (timing: TimingResult) => void;
    fetchNextTiming = new Promise(resolve => { resolveTiming = resolve; });
    const { view, audio } = await renderAtBoundary();

    fireEvent.timeUpdate(audio);
    expect(fetchQuery).toHaveBeenCalledTimes(1);

    fireEvent.click(view.getByTestId('button-audio-options'));
    fireEvent.click(view.getByTestId('button-reciter-8'));
    await waitFor(() => expect(savePreference).toHaveBeenCalledWith({ data: { recitationId: 8 } }));
    await waitFor(() => expect(pause).toHaveBeenCalled());
    pause.mockClear();

    await act(async () => resolveTiming(connectedSecond));

    expect(view.getByTestId('playing-ayah').textContent).toBe('1');
    expect(pause).not.toHaveBeenCalled();
  });
});