/**
 * Decodes ayah files before playback and schedules adjacent PCM buffers on the
 * same AudioContext clock. Swapping an HTMLAudioElement src at "ended" is never
 * sample-accurate, even if the next MP3 was preloaded.
 */
export class GaplessAyahAudio {
  private context: AudioContext | null = null;
  private output: MediaStreamAudioDestinationNode | null = null;
  private originalVolume: number | null = null;
  private buffers = new Map<string, Promise<{ buffer: AudioBuffer; start: number; end: number }>>();
  private source: AudioBufferSourceNode | null = null;
  private following: AudioBufferSourceNode | null = null;
  private key: string | null = null;
  private followingKey: string | null = null;
  private followingDuration = 0;
  private followingTrimStart = 0;
  private pausedFollowingKey: string | null = null;
  private serial = 0;
  private startedAt = 0;
  private offset = 0;
  private duration = 0;
  private trimStart = 0;
  private rate = 1;
  private playing = false;
  private boundary: (() => void) | null = null;

  constructor(private readonly audio: HTMLAudioElement) {}

  // Call while handling the user's play gesture. Browsers may refuse to
  // resume a newly created AudioContext after an asynchronous audio download.
  async unlock() {
    const context = this.ensureContext();
    await context.resume();
    await this.audio.play();
  }

  private ensureContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createMediaStreamDestination();
    }
    if (this.audio.srcObject !== this.output!.stream) {
      this.originalVolume = this.audio.volume;
      // The Web Audio destination drives the speakers. Keep the media element
      // alive for Media Session controls, but never play the same PCM twice.
      this.audio.volume = 0;
      this.audio.removeAttribute('src');
      this.audio.srcObject = this.output!.stream;
    }
    return this.context;
  }

  preload(key: string) {
    if (this.buffers.has(key)) return this.buffers.get(key)!;
    const promise = (async () => {
      const response = await fetch(key, { credentials: 'include' });
      if (!response.ok) throw new Error(`Ayah audio unavailable (${response.status})`);
      const bytes = await response.arrayBuffer();
      const context = this.ensureContext();
      const buffer = await context.decodeAudioData(bytes);
      // Verse MP3s contain substantial low-level hiss before/after the voice.
      // Test a whole 10ms window so a stray encoded sample cannot preserve
      // hundreds of milliseconds of near-silence at each boundary.
      const channel = buffer.getChannelData(0);
      const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.01));
      const limit = Math.min(channel.length / 2, buffer.sampleRate * 1.5);
      const rms = (from: number) => {
        let power = 0;
        const end = Math.min(from + windowSize, channel.length);
        for (let i = from; i < end; i++) power += channel[i] * channel[i];
        return Math.sqrt(power / (end - from));
      };
      let peak = 0;
      for (let i = 0; i < channel.length; i += windowSize) peak = Math.max(peak, rms(i));
      const threshold = Math.max(0.004, peak * 0.015);
      let first = 0;
      while (first < limit && rms(first) < threshold) first += windowSize;
      let last = channel.length - windowSize;
      while (last > channel.length - limit && rms(last) < threshold) last -= windowSize;
      const start = Math.max(0, first / buffer.sampleRate - 0.01);
      const end = Math.min(buffer.duration, (last + windowSize) / buffer.sampleRate + 0.01);
      return { buffer, start, end: end > start ? end : buffer.duration };
    })();
    this.buffers.set(key, promise);
    promise.catch(() => { if (this.buffers.get(key) === promise) this.buffers.delete(key); });
    while (this.buffers.size > 5) this.buffers.delete(this.buffers.keys().next().value!);
    return promise;
  }

  private clearNodes() {
    try { this.source?.stop(); } catch { /* already finished */ }
    try { this.following?.stop(); } catch { /* already finished */ }
    this.source = null;
    this.following = null;
    this.followingKey = null;
    this.followingDuration = 0;
  }

  private makeSource(buffer: AudioBuffer, when: number, offset: number, length: number) {
    const node = this.context!.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = this.rate;
    node.connect(this.output!);
    // A MediaStream destination alone can be demand-driven by its element:
    // Chromium suspends its audible pull during media-element transitions.
    // The hardware destination keeps the PCM graph running on its own clock.
    node.connect(this.context!.destination);
    node.start(when, offset, length);
    return node;
  }

  async play(key: string, rate: number, onBoundary: () => void) {
    if (this.playing && this.key === key) {
      this.boundary = onBoundary;
      if (this.audio.paused) {
        try { await this.audio.play(); } catch (error) {
          if ((error as Error).name !== 'AbortError') throw error;
        }
      }
      if (rate !== this.rate) {
        this.pause();
        this.rate = rate;
        await this.resume();
      }
      return;
    }
    // Matching a queued *future* key is not a natural boundary. A manual
    // next/previous action must cancel the current source and start now.
    const serial = ++this.serial;
    this.clearNodes();
    this.playing = false;
    this.rate = rate;
    this.boundary = onBoundary;
    this.key = key;
    const track = await this.preload(key);
    if (serial !== this.serial) return;
    const context = this.ensureContext();
    await context.resume();
    if (serial !== this.serial) return;
    await this.audio.play();
    if (serial !== this.serial) return;
    this.offset = 0;
    this.trimStart = track.start;
    this.duration = track.end - track.start;
    this.startedAt = context.currentTime + 0.04;
    this.source = this.makeSource(track.buffer, this.startedAt, track.start, this.duration);
    this.playing = true;
    this.armBoundary(serial, this.startedAt + this.duration / rate);
  }

  async queue(key: string) {
    if (!this.playing || !this.source || !this.context) return;
    const serial = this.serial;
    const track = await this.preload(key);
    if (serial !== this.serial || !this.playing || !this.source || !this.context) return;
    const end = this.startedAt + (this.duration - this.offset) / this.rate;
    // An already missed deadline cannot be repaired by pretending to schedule
    // in the past. Let the boundary handler explicitly start the next verse.
    if (end <= this.context.currentTime) return;
    if (this.followingKey === key && this.following) return;
    this.following?.stop();
    this.followingKey = key;
    this.followingTrimStart = track.start;
    this.followingDuration = track.end - track.start;
    this.following = this.makeSource(track.buffer, end, track.start, track.end - track.start);
  }

  private armBoundary(serial: number, end: number) {
    const ending = this.source;
    if (!ending) return;
    // The browser's audio clock, not a wall-clock timer, decides when the
    // played verse has actually ended. This keeps UI/Media Session in sync
    // even when a tab's timers run ahead of or behind the audio renderer.
    ending.onended = () => {
      if (serial !== this.serial || !this.playing || this.source !== ending) return;
      if (this.following && this.followingKey) {
        this.source = this.following;
        this.key = this.followingKey;
        this.following = null;
        this.followingKey = null;
        this.startedAt = end;
        this.offset = 0;
        this.trimStart = this.followingTrimStart;
        this.duration = this.followingDuration;
        this.armBoundary(serial, end + this.duration / this.rate);
      } else {
        this.source = null;
        this.playing = false;
      }
      this.boundary?.();
    };
  }

  pause() {
    if (!this.playing || !this.context) return;
    this.offset = Math.min(this.duration, this.offset + Math.max(0, this.context.currentTime - this.startedAt) * this.rate);
    this.pausedFollowingKey = this.followingKey;
    this.clearNodes();
    this.playing = false;
    ++this.serial;
    this.audio.pause();
  }

  async resume() {
    if (!this.key || this.playing) return;
    const serial = ++this.serial;
    const track = await this.preload(this.key);
    if (serial !== this.serial) return;
    const context = this.ensureContext();
    await context.resume();
    if (serial !== this.serial) return;
    await this.audio.play();
    if (serial !== this.serial) return;
    this.startedAt = context.currentTime + 0.04;
    this.trimStart = track.start;
    this.duration = track.end - track.start;
    this.source = this.makeSource(track.buffer, this.startedAt, this.trimStart + this.offset, this.duration - this.offset);
    this.playing = true;
    this.armBoundary(serial, this.startedAt + (this.duration - this.offset) / this.rate);
    if (this.pausedFollowingKey) {
      const next = this.pausedFollowingKey;
      this.pausedFollowingKey = null;
      void this.queue(next);
    }
  }

  stop() {
    ++this.serial;
    this.clearNodes();
    this.playing = false;
    this.key = null;
    this.offset = 0;
    this.pausedFollowingKey = null;
    this.audio.pause();
    this.audio.srcObject = null;
    if (this.originalVolume !== null) {
      this.audio.volume = this.originalVolume;
      this.originalVolume = null;
    }
  }

  get active() { return this.key !== null; }
  get isPlaying() { return this.playing; }
  get currentKey() { return this.key; }
}