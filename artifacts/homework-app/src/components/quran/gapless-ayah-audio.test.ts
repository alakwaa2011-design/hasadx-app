// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GaplessAyahAudio } from './gapless-ayah-audio';

describe('decoded ayah scheduling', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('schedules natural boundaries but skips a queued verse immediately on a manual action', async () => {
    vi.useFakeTimers();
    const starts: Array<{ when: number; offset: number; length: number }> = [];
    const nodes: Array<{ onended: (() => void) | null; stop: ReturnType<typeof vi.fn> }> = [];
    const audio = document.createElement('audio');
    audio.play = vi.fn(async () => undefined);
    audio.pause = vi.fn();
    const sampleRate = 1000;
    const samples = new Float32Array(2000).fill(0.4);
    const context = {
      currentTime: 10,
      destination: {},
      resume: vi.fn(async () => undefined),
      createMediaStreamDestination: () => ({ stream: {} }),
      decodeAudioData: vi.fn(async () => ({
        sampleRate,
        duration: 2,
        getChannelData: () => samples,
      })),
      createBufferSource: () => {
        const node = {
        onended: null as (() => void) | null,
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        start: (when: number, offset: number, length: number) => starts.push({ when, offset, length }),
        stop: vi.fn(),
        };
        nodes.push(node);
        return node;
      },
    };
    vi.stubGlobal('AudioContext', class { constructor() { return context; } });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })));

    const engine = new GaplessAyahAudio(audio);
    const boundary = vi.fn();
    await engine.play('/api/quran/audio/2000032/112/4/buffer', 1, boundary);
    await engine.queue('/api/quran/audio/2000032/113/1/buffer');
    expect(starts).toHaveLength(2);
    expect(starts[1].when).toBe(starts[0].when + starts[0].length);
    context.currentTime = starts[1].when;
    nodes[0].onended?.();
    expect(boundary).toHaveBeenCalledTimes(1);
    expect(engine.currentKey).toBe('/api/quran/audio/2000032/113/1/buffer');
    await engine.queue('/api/quran/audio/2000032/113/1/buffer');
    expect(starts[2].when).toBe(starts[1].when + starts[1].length);
    await engine.queue('/api/quran/audio/2000032/113/2/buffer');
    const scheduled = starts.at(-1)!.when;
    context.currentTime = starts[1].when + 0.5;
    await engine.play('/api/quran/audio/2000032/113/2/buffer', 1, boundary);
    expect(nodes[1].stop).toHaveBeenCalled();
    expect(nodes.at(-2)!.stop).toHaveBeenCalled();
    expect(starts.at(-1)!.when).toBe(context.currentTime + 0.04);
    expect(starts.at(-1)!.when).toBeLessThan(scheduled);
    expect(engine.currentKey).toBe('/api/quran/audio/2000032/113/2/buffer');
    engine.stop();
    expect(audio.pause).toHaveBeenCalled();
  });
});