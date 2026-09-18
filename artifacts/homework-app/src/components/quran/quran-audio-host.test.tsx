// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let currentLocation = '/teacher/dashboard';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ lang: 'ar' }),
}));

vi.mock('wouter', () => ({
  useLocation: () => [currentLocation, vi.fn()],
}));

import {
  QuranAudioHostProvider,
  useQuranAudioHost,
  type QuranAudioSession,
} from './quran-audio-host';

function ActiveSession({ sourceMode }: { sourceMode: QuranAudioSession['sourceMode'] }) {
  const { playback, setControllerAttached, setPlayback, setSession } = useQuranAudioHost();

  useEffect(() => {
    setControllerAttached(false);
    setSession({
      recitationId: 7,
      surahNumber: 1,
      ayahNumber: 7,
      surahLength: 7,
      endAyah: null,
      unrestricted: true,
      sourceMode,
      speed: 1,
    });
    setPlayback({
      active: true,
      isPlaying: true,
      surahNumber: 1,
      ayahNumber: 7,
    });
  }, [setControllerAttached, setPlayback, setSession, sourceMode]);

  return (
    <output data-testid="host-playback">
      {playback.active
        ? `${playback.surahNumber}:${playback.ayahNumber}:${playback.isPlaying ? 'playing' : 'paused'}`
        : 'stopped'}
    </output>
  );
}

function renderActiveSession(sourceMode: QuranAudioSession['sourceMode']) {
  return render(activeSessionTree(sourceMode));
}

function activeSessionTree(sourceMode: QuranAudioSession['sourceMode']) {
  return (
    <QuranAudioHostProvider>
      <ActiveSession sourceMode={sourceMode} />
    </QuranAudioHostProvider>
  );
}

describe('QuranAudioHostProvider cross-route playback', () => {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  const originalFetch = globalThis.fetch;
  const originalMediaSessionDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaSession');

  beforeEach(() => {
    currentLocation = '/teacher/dashboard';
    play.mockClear();
    pause.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    if (originalMediaSessionDescriptor) {
      Object.defineProperty(navigator, 'mediaSession', originalMediaSessionDescriptor);
    } else {
      delete (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
    }
  });

  it('continues from the last ayah into the next surah with the same audio element', async () => {
    const view = renderActiveSession('ayah');
    const audio = view.container.querySelector('audio') as HTMLAudioElement;

    await waitFor(() => {
      expect(view.getByTestId('host-playback').textContent).toBe('1:7:playing');
    });
    expect(view.container.querySelectorAll('audio')).toHaveLength(1);
    expect(view.getByLabelText('Pause Quran')).not.toBeNull();

    fireEvent.ended(audio);

    await waitFor(() => {
      expect(view.getByTestId('host-playback').textContent).toBe('2:1:playing');
    });
    expect(view.container.querySelector('audio')).toBe(audio);
    expect(audio.getAttribute('src')).toBe('/api/quran/audio/7/2/1');
    expect(play).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).toContain('السورة 2 · الآية 1');
  });

  it('loads the next chapter recording after a chapter-scoped recitation ends', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ audioUrl: '/chapter-2.mp3' }),
    }));
    globalThis.fetch = fetchMock as never;
    const view = renderActiveSession('chapter');
    const audio = view.container.querySelector('audio') as HTMLAudioElement;

    await waitFor(() => {
      expect(view.getByTestId('host-playback').textContent).toBe('1:7:playing');
    });
    fireEvent.ended(audio);

    await waitFor(() => {
      expect(view.getByTestId('host-playback').textContent).toBe('2:1:playing');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/quran/audio/7/2/1/timings', {
      credentials: 'include',
    });
    expect(view.container.querySelector('audio')).toBe(audio);
    expect(audio.getAttribute('src')).toBe('/chapter-2.mp3');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('shows external controls off the Quran route and stops the shared session cleanly', async () => {
    const view = renderActiveSession('ayah');
    const audio = view.container.querySelector('audio') as HTMLAudioElement;

    await waitFor(() => {
      expect(view.getByLabelText('Stop Quran')).not.toBeNull();
    });
    Object.defineProperty(audio, 'currentTime', { value: 12, writable: true });

    fireEvent.click(view.getByLabelText('Stop Quran'));

    await waitFor(() => {
      expect(view.getByTestId('host-playback').textContent).toBe('stopped');
    });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(0);
    expect(view.queryByLabelText('Stop Quran')).toBeNull();
    expect(view.container.querySelectorAll('audio')).toHaveLength(1);
  });

  it('preserves one audio element and its position through route and visibility changes', async () => {
    const view = renderActiveSession('ayah');
    const audio = view.container.querySelector('audio') as HTMLAudioElement;

    await waitFor(() => {
      expect(view.getByLabelText('Stop Quran')).not.toBeNull();
    });
    audio.setAttribute('src', '/active-recitation.mp3');
    Object.defineProperty(audio, 'currentTime', { value: 12, writable: true });
    play.mockClear();
    pause.mockClear();

    currentLocation = '/teacher/quran-reader/1';
    view.rerender(activeSessionTree('ayah'));
    await waitFor(() => expect(view.queryByLabelText('Stop Quran')).toBeNull());
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    currentLocation = '/teacher/dashboard';
    view.rerender(activeSessionTree('ayah'));
    await waitFor(() => expect(view.getByLabelText('Stop Quran')).not.toBeNull());

    expect(view.container.querySelectorAll('audio')).toHaveLength(1);
    expect(view.container.querySelector('audio')).toBe(audio);
    expect(audio.getAttribute('src')).toBe('/active-recitation.mp3');
    expect(audio.currentTime).toBe(12);
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });

  it('registers Arabic lock-screen metadata and playback controls', async () => {
    const handlers = new Map<string, (() => void) | null>();
    const mediaSession = {
      metadata: null as MediaMetadata | null,
      playbackState: 'none' as MediaSessionPlaybackState,
      setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
        handlers.set(action, handler);
      }),
    };
    class FakeMediaMetadata {
      title = '';
      artist = '';
      album = '';
      constructor(init: MediaMetadataInit) {
        Object.assign(this, init);
      }
    }
    vi.stubGlobal('MediaMetadata', FakeMediaMetadata);
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: mediaSession,
    });

    const view = renderActiveSession('ayah');
    const audio = view.container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: 120, configurable: true });
    Object.defineProperty(audio, 'currentTime', { value: 30, writable: true });

    await waitFor(() => {
      expect(mediaSession.playbackState).toBe('playing');
      expect(mediaSession.metadata?.title).toBe('الآية 7 · السورة 1');
    });
    expect(mediaSession.metadata?.artist).toBe('قارئ القرآن');
    expect(mediaSession.metadata?.album).toBe('إسلاميات حصاد');

    handlers.get('previoustrack')?.();
    expect(audio.currentTime).toBe(0);
    handlers.get('nexttrack')?.();
    expect(audio.currentTime).toBe(120);
    handlers.get('pause')?.();
    handlers.get('play')?.();

    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(view.container.querySelectorAll('audio')).toHaveLength(1);
  });
});