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
const timingHookCalls = vi.fn();
let preferredRecitationId = 7;

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ lang: 'ar' }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
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
      preferredRecitationId,
      reciters: [
        { id: 7, name: 'First reciter', style: 'Murattal' },
        { id: 8, name: 'Second reciter', style: 'Murattal' },
        { id: 2_000_032, name: 'محمود علي البنا', style: 'Murattal', available: true },
        { id: 2_000_114, name: 'صادق النظام', style: 'Murattal', available: false },
        { id: 2_000_170, name: 'فارس عباد', style: 'Murattal', available: true },
        { id: 2_001_095, name: 'أبوبكر الظبي', style: 'Murattal', available: true },
      ],
    },
    refetch: vi.fn(),
  }),
  useUpdateQuranAudioPreference: () => ({
    mutateAsync: savePreference,
    isPending: false,
  }),
  useGetQuranAyahTimings: (recitationId: number, surah: number, ayah: number) => {
    timingHookCalls(recitationId, surah, ayah);
    return {
      data: timingResults.get(ayah)?.data,
      isError: timingResults.get(ayah)?.isError ?? false,
      isFetching: timingResults.get(ayah)?.isFetching ?? false,
      isLoading: timingResults.get(ayah)?.isLoading ?? false,
    };
  },
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

function PlayerHarness({
  onAudibleAyahChange,
}: {
  onAudibleAyahChange?: (surahNumber: number, ayah: number | null) => void;
} = {}) {
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
        onAudibleAyahChange={onAudibleAyahChange}
      />
    </QuranAudioHostProvider>
  );
}

function RepeatingPlayerHarness({
  onPlaybackLocationChange,
}: {
  onPlaybackLocationChange?: (surahNumber: number, ayahNumber: number) => void;
} = {}) {
  const [playingAyah, setPlayingAyah] = useState<number | null>(1);
  const [isPlaying, setIsPlaying] = useState(true);
  return (
    <QuranAudioHostProvider>
      <output data-testid="repeating-playing-ayah">{playingAyah ?? 'stopped'}</output>
      <button
        data-testid="external-stop"
        onClick={() => {
          setIsPlaying(false);
          setPlayingAyah(null);
        }}
      >
        Stop
      </button>
      <button
        data-testid="external-play"
        onClick={() => {
          setPlayingAyah(1);
          setIsPlaying(true);
        }}
      >
        Play
      </button>
      {playingAyah !== null && (
        <QuranAudioPlayer
          surahs={[{ ayahs: [{}, {}] }] as never}
          surahNumber={1}
          startAyah={1}
          endAyah={2}
          selectedAyah={1}
          playingAyah={playingAyah}
          onPlayingAyahChange={setPlayingAyah}
          isPlaying={isPlaying}
          onIsPlayingChange={setIsPlaying}
           onPlaybackLocationChange={onPlaybackLocationChange}
          memoSession={{
            isActive: true,
            rangeStart: 1,
            rangeEnd: 2,
            repeatScope: 'ayah',
            repeatCount: 3,
            pauseSeconds: 0,
          }}
          onMemoSessionChange={vi.fn()}
        />
      )}
    </QuranAudioHostProvider>
  );
}

function RepeatSettingsHarness({ invalidRange = false }: { invalidRange?: boolean } = {}) {
  const [memoSession, setMemoSession] = useState({
    isActive: false,
    rangeStart: invalidRange ? 8 : 1,
    rangeEnd: invalidRange ? 10 : 2,
    repeatScope: 'ayah' as 'ayah' | 'range',
    repeatCount: 3 as number | 'continuous',
    pauseSeconds: 0,
  });
  return (
    <QuranAudioHostProvider>
      <output data-testid="repeat-session">{JSON.stringify(memoSession)}</output>
      <QuranAudioPlayer
        surahs={[{ ayahs: [{}, {}, {}, {}] }] as never}
        surahNumber={1}
        startAyah={null}
        endAyah={null}
        selectedAyah={2}
        playingAyah={2}
        onPlayingAyahChange={vi.fn()}
        isPlaying={false}
        onIsPlayingChange={vi.fn()}
        memoSession={memoSession}
        onMemoSessionChange={setMemoSession}
      />
    </QuranAudioHostProvider>
  );
}

async function renderAtBoundary(
  onAudibleAyahChange?: (surahNumber: number, ayah: number | null) => void,
) {
  const view = render(<PlayerHarness onAudibleAyahChange={onAudibleAyahChange} />);
  const audio = await waitFor(() => {
    const element = view.container.querySelector('audio');
    expect(element).not.toBeNull();
    return element as HTMLAudioElement;
  });
  await waitFor(() => expect(audio.src).toContain('/surah.mp3'));
  Object.defineProperty(audio, 'readyState', {
    configurable: true,
    value: HTMLMediaElement.HAVE_METADATA,
  });
  fireEvent.loadedMetadata(audio);
  Object.defineProperty(audio, 'currentTime', { value: 1, writable: true });
  return { view, audio };
}

describe('QuranAudioPlayer zero-pause transitions', () => {
  const pause = vi.fn();
  const play = vi.fn(() => Promise.resolve());
  const load = vi.fn();
  const OriginalAudio = globalThis.Audio;

  beforeEach(() => {
    preferredRecitationId = 7;
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
    timingHookCalls.mockClear();
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
    play.mockClear();

    fireEvent.timeUpdate(audio);

    await waitFor(() => expect(audio.currentTime).toBe(1));
    expect(view.container.querySelector('audio')).toBe(audio);
    expect(pause).not.toHaveBeenCalled();
    expect(audio.hasAttribute('src')).toBe(true);
  });

  it('falls back to ayah-scoped audio for Mahmoud Ali Al-Banna', async () => {
    preferredRecitationId = 2_000_032;
    timingResults.set(1, { isError: true });

    const view = render(<PlayerHarness />);
    const audio = await waitFor(() => {
      const element = view.container.querySelector('audio');
      expect(element).not.toBeNull();
      return element as HTMLAudioElement;
    });

    await waitFor(() => {
      expect(audio.src).toContain('/api/quran/audio/2000032/1/1');
    });
  });

  it('falls back to ayah-scoped audio for Fares Abbad', async () => {
    preferredRecitationId = 2_000_170;
    timingResults.set(1, { isError: true });

    const view = render(<PlayerHarness />);
    const audio = await waitFor(() => {
      const element = view.container.querySelector('audio');
      expect(element).not.toBeNull();
      return element as HTMLAudioElement;
    });

    await waitFor(() => {
      expect(audio.src).toContain('/api/quran/audio/2000170/1/1');
    });
  });

  it('restarts the current ayah timing instead of the beginning of the surah', async () => {
    let resolveTiming!: (timing: TimingResult) => void;
    fetchNextTiming = new Promise(resolve => { resolveTiming = resolve; });
    timingResults.set(1, {
      data: {
        ...connectedFirst,
        verseStartMs: 250,
        verseEndMs: 1_250,
      },
    });
    const { view, audio } = await renderAtBoundary();

    audio.currentTime = 1.25;
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

  it('does not play a stale chapter position while the selected ayah timing is loading', async () => {
    timingResults.set(2, { isLoading: true, isFetching: true });
    const { view } = await renderAtBoundary();

    play.mockClear();
    pause.mockClear();
    fireEvent.click(view.getByTestId('button-next-ayah'));

    await waitFor(() => expect(view.getByTestId('playing-ayah').textContent).toBe('2'));
    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();

    timingResults.set(2, { data: connectedSecond });
    view.rerender(<PlayerHarness />);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  });

  it('does not play the old chapter position after an async boundary advances the ayah', async () => {
    let resolveTiming!: (timing: TimingResult) => void;
    fetchNextTiming = new Promise(resolve => { resolveTiming = resolve; });
    const { view, audio } = await renderAtBoundary();

    pause.mockClear();
    play.mockClear();

    fireEvent.timeUpdate(audio);
    expect(fetchQuery).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();

    await act(async () => resolveTiming(connectedSecond));

    await waitFor(() => expect(view.container.querySelector('audio')).toBe(audio));
    await waitFor(() => expect(view.getByTestId('playing-ayah').textContent).toBe('2'));
    expect(pause).toHaveBeenCalled();
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

  it('plays a session-only sample without trying to save it as the preferred reciter', async () => {
    const { view } = await renderAtBoundary();

    fireEvent.click(view.getByTestId('button-audio-options'));
    const sampleButton = view.getByTestId('button-reciter-2000114') as HTMLButtonElement;
    expect(sampleButton.disabled).toBe(false);

    fireEvent.click(sampleButton);

    await waitFor(() => expect(sampleButton.className).toContain('bg-emerald-50'));
    await waitFor(() => expect(timingHookCalls).toHaveBeenCalledWith(2_000_114, 1, 1));
    expect(savePreference).not.toHaveBeenCalled();
  });

  it('seeks to the selected ayah and saves Abu Bakr Al-Dhabi as the preferred reciter', async () => {
    const onAudibleAyahChange = vi.fn();
    const { view, audio } = await renderAtBoundary(onAudibleAyahChange);
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 0 });
    play.mockClear();
    timingResults.set(1, {
      data: {
        synchronized: true,
        audioUrl: '/abu-bakr-al-dhabi/001.mp3',
        verseStartMs: 12_345,
        verseEndMs: 18_000,
        segments: [],
      },
    });

    fireEvent.click(view.getByTestId('button-audio-options'));
    const sampleButton = view.getByTestId('button-reciter-2001095') as HTMLButtonElement;
    expect(sampleButton.disabled).toBe(false);

    fireEvent.click(sampleButton);

    await waitFor(() => expect(sampleButton.className).toContain('bg-emerald-50'));
    await waitFor(() => expect(timingHookCalls).toHaveBeenCalledWith(2_001_095, 1, 1));
    await waitFor(() => expect(audio.src).toContain('/abu-bakr-al-dhabi/001.mp3'));
    play.mockClear();
    expect(play).not.toHaveBeenCalled();
    Object.defineProperty(audio, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    });
    fireEvent.loadedMetadata(audio);
    expect(audio.currentTime).toBe(12.345);
    expect(onAudibleAyahChange).not.toHaveBeenCalled();
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    fireEvent.timeUpdate(audio);
    expect(onAudibleAyahChange).toHaveBeenCalledWith(1, 1);
    await waitFor(() => expect(savePreference).toHaveBeenCalledWith({
      data: { recitationId: 2_001_095 },
    }));
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

  it('replays a synchronized ayah three times before advancing', async () => {
    const view = render(<RepeatingPlayerHarness />);
    let audio = await waitFor(() => {
      const element = view.container.querySelector('audio');
      expect(element).not.toBeNull();
      return element as HTMLAudioElement;
    });

    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 1, writable: true });
    fireEvent.timeUpdate(audio);
    await waitFor(() => expect(view.container.textContent).toContain('2/3'));
    fireEvent.click(view.getByTestId('external-stop'));
    await waitFor(() => expect(view.getByTestId('repeating-playing-ayah').textContent).toBe('stopped'));
    fireEvent.click(view.getByTestId('external-play'));
    await waitFor(() => expect(view.getByTestId('repeating-playing-ayah').textContent).toBe('1'));
    audio = await waitFor(() => view.container.querySelector('audio') as HTMLAudioElement);

    for (let playCount = 1; playCount <= 3; playCount += 1) {
      Object.defineProperty(audio, 'currentTime', { configurable: true, value: 1, writable: true });
      fireEvent.timeUpdate(audio);
      await waitFor(() => expect(view.getByTestId('repeating-playing-ayah').textContent)
        .toBe(playCount < 3 ? '1' : '2'));
    }
  });

  it('resets the repeat counter after stopping and replaying the same ayah', async () => {
    const view = render(<RepeatingPlayerHarness />);
    let audio = await waitFor(() => {
      const element = view.container.querySelector('audio');
      expect(element).not.toBeNull();
      return element as HTMLAudioElement;
    });

    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 1, writable: true });
    fireEvent.timeUpdate(audio);
    await waitFor(() => expect(view.container.textContent).toContain('2/3'));
    fireEvent.click(view.getByTestId('external-stop'));
    await waitFor(() => expect(view.getByTestId('repeating-playing-ayah').textContent).toBe('stopped'));
    fireEvent.click(view.getByTestId('external-play'));
    await waitFor(() => expect(view.getByTestId('repeating-playing-ayah').textContent).toBe('1'));
    audio = await waitFor(() => view.container.querySelector('audio') as HTMLAudioElement);

    for (let playCount = 1; playCount <= 3; playCount += 1) {
      Object.defineProperty(audio, 'currentTime', { configurable: true, value: 1, writable: true });
      fireEvent.timeUpdate(audio);
      await waitFor(() => expect(view.getByTestId('repeating-playing-ayah').textContent)
        .toBe(playCount < 3 ? '1' : '2'));
    }
  });

  it('switches repeat modes and directly selects the ayah and segment counts', async () => {
    const view = render(<RepeatSettingsHarness />);
    fireEvent.click(view.getByTestId('button-audio-repeat'));
    expect(view.getByTestId('panel-repeat')).toBeTruthy();

    const ayahCount = view.getByTestId('button-repeat-count-5');
    fireEvent.click(ayahCount);
    expect(ayahCount.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(view.getByTestId('button-repeat-mode-range'));
    await waitFor(() => {
      const state = JSON.parse(view.getByTestId('repeat-session').textContent ?? '{}');
      expect(state.isActive).toBe(true);
      expect(state.repeatScope).toBe('range');
      expect(state.rangeStart).toBe(2);
      expect(state.rangeEnd).toBe(2);
    });
    const segmentCount = view.getByTestId('button-repeat-count-10');
    fireEvent.click(segmentCount);
    expect(segmentCount.getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(view.getByTestId('repeat-session').textContent ?? '{}').repeatCount).toBe(10);

    fireEvent.click(view.getByTestId('button-repeat-mode-ayah'));
    await waitFor(() => {
      const state = JSON.parse(view.getByTestId('repeat-session').textContent ?? '{}');
      expect(state.isActive).toBe(false);
      expect(state.repeatScope).toBe('ayah');
    });
    expect(view.queryByTestId('select-segment-start')).toBeNull();
    expect(view.getByTestId('button-repeat-count-5').getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps segment selectors ordered and initializes an invalid range at the current ayah', async () => {
    const view = render(<RepeatSettingsHarness invalidRange />);
    fireEvent.click(view.getByTestId('button-audio-repeat'));
    fireEvent.click(view.getByTestId('button-repeat-mode-range'));

    const start = await waitFor(() => view.getByTestId('select-segment-start') as HTMLSelectElement);
    const end = view.getByTestId('select-segment-end') as HTMLSelectElement;
    const initialized = JSON.parse(view.getByTestId('repeat-session').textContent ?? '{}');
    expect(initialized.rangeStart).toBe(2);
    expect(initialized.rangeEnd).toBe(2);
    fireEvent.change(start, { target: { value: '3' } });
    await waitFor(() => {
      const state = JSON.parse(view.getByTestId('repeat-session').textContent ?? '{}');
      expect(state.rangeStart).toBe(3);
      expect(state.rangeEnd).toBe(3);
    });
    fireEvent.change(end, { target: { value: '4' } });
    await waitFor(() => {
      const state = JSON.parse(view.getByTestId('repeat-session').textContent ?? '{}');
      expect(state.rangeStart).toBe(3);
      expect(state.rangeEnd).toBe(4);
    });
    expect(Array.from(end.options).map(option => Number(option.value)).every(value => value >= 3)).toBe(true);
  });
});
