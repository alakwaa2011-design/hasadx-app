export interface QuranRecognizedWord {
  word: string;
  confidence: number;
}

export interface QuranChunkAlignment {
  nextExpectedIndex: number;
  madeProgress: boolean;
  mismatchKey: string | null;
}

export interface QuranMismatchConfirmation {
  mismatchKey: string | null;
  count: number;
  shouldAlert: boolean;
}

const QURAN_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function isStudentQuranReaderPath(pathname: string): boolean {
  return pathname.startsWith("/student/quran-wards/")
    || pathname.startsWith("/student/quran-practice/")
    || pathname.startsWith("/student/quran-recitation/");
}

export function normalizeQuranWord(text: string): string {
  return text
    .replace(QURAN_MARKS, "")
    .replace(/\u0640/g, "")
    .replace(/[ٱأإآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u063A\u0641-\u064A]/g, "")
    .trim();
}

export function alignQuranRecitationChunk(
  expectedWords: readonly string[],
  expectedIndex: number,
  recognizedWords: readonly QuranRecognizedWord[],
  confidenceThreshold = 0.62,
): QuranChunkAlignment {
  let nextExpectedIndex = expectedIndex;
  let madeProgress = false;
  let mismatchKey: string | null = null;

  for (const recognized of recognizedWords) {
    const normalized = normalizeQuranWord(recognized.word);
    if (!normalized) continue;

    const confidence = Number.isFinite(recognized.confidence) ? recognized.confidence : 0;
    const currentExpected = expectedWords[nextExpectedIndex];
    if (currentExpected && normalized === currentExpected) {
      if (confidence >= confidenceThreshold) {
        nextExpectedIndex += 1;
        madeProgress = true;
      }
      continue;
    }

    const recentStart = Math.max(0, nextExpectedIndex - 4);
    const isOverlapRepeat = expectedWords
      .slice(recentStart, nextExpectedIndex)
      .includes(normalized);
    if (!isOverlapRepeat && confidence >= confidenceThreshold && currentExpected) {
      mismatchKey ??= `${nextExpectedIndex}:${normalized}`;
    }
  }

  return {
    nextExpectedIndex,
    madeProgress,
    mismatchKey: madeProgress ? null : mismatchKey,
  };
}

export function confirmQuranMismatch(
  previousKey: string | null,
  previousCount: number,
  mismatchKey: string | null,
): QuranMismatchConfirmation {
  if (!mismatchKey) {
    return { mismatchKey: null, count: 0, shouldAlert: false };
  }

  const count = previousKey === mismatchKey ? previousCount + 1 : 1;
  return {
    mismatchKey,
    count: count >= 2 ? 0 : count,
    shouldAlert: count >= 2,
  };
}

export function concatPcm(chunks: readonly Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function downsamplePcm(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate = 16_000,
): Float32Array {
  if (sourceSampleRate <= targetSampleRate) return samples;
  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.max(1, Math.floor(samples.length / ratio));
  const result = new Float32Array(targetLength);

  for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
    const sourceStart = Math.floor(targetIndex * ratio);
    const sourceEnd = Math.min(samples.length, Math.floor((targetIndex + 1) * ratio));
    let sum = 0;
    for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
      sum += samples[sourceIndex];
    }
    result[targetIndex] = sum / Math.max(1, sourceEnd - sourceStart);
  }

  return result;
}

export function encodePcmWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}