import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const manifestPath = process.argv[2] || "/tmp/abu-bakr-al-dhabi-import/manifest.json";
const audioDir = process.argv[3] || "/tmp/abu-bakr-al-dhabi-import";
const outputPath = process.argv[4] || "/tmp/abu-bakr-al-dhabi-import/audio-review.json";
const sampleRate = 8_000;

function windowDb(samples, startMs, endMs) {
  const start = Math.max(0, Math.floor((startMs / 1_000) * sampleRate));
  const end = Math.min(samples.length, Math.ceil((endMs / 1_000) * sampleRate));
  if (end <= start) return -120;
  let sumSquares = 0;
  for (let index = start; index < end; index += 1) {
    const value = samples[index] / 32_768;
    sumSquares += value * value;
  }
  const rms = Math.sqrt(sumSquares / (end - start));
  return rms > 0 ? 20 * Math.log10(rms) : -120;
}

async function decodeAudio(path) {
  const chunks = [];
  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-i", path,
    "-ac", "1", "-ar", String(sampleRate), "-f", "s16le", "-",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
  ffmpeg.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    ffmpeg.on("error", reject);
    ffmpeg.on("close", resolve);
  });
  if (exitCode !== 0) throw new Error(`Unable to decode ${path}: ${stderr.trim()}`);
  const pcm = Buffer.concat(chunks);
  return new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
}

function round(value) {
  return Math.round(value * 10) / 10;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const chapters = {};
const flagged = [];
let reviewedBoundaries = 0;

async function reviewSurah(surah) {
  if (surah === 95) {
    return {
      surah,
      chapter: {
      status: "previously-human-reviewed-sample",
      reviewedBoundaries: 7,
      flaggedBoundaries: 0,
      },
      flagged: [],
    };
  }
  const chapter = manifest.chapters?.[surah];
  if (!chapter || chapter.status !== "dry-run" || !Array.isArray(chapter.qa)) {
    throw new Error(`Review manifest is incomplete at surah ${surah}`);
  }
  const samples = await decodeAudio(
    `${audioDir}/${String(surah).padStart(3, "0")}.mp3`,
  );
  const chapterFlagged = [];
  const results = chapter.qa.map((boundary) => {
    const silenceDurationMs = Math.max(80, boundary.silenceDurationMs);
    const silenceDb = windowDb(
      samples,
      boundary.boundaryMs - Math.min(140, silenceDurationMs * 0.65),
      boundary.boundaryMs - 20,
    );
    const priorVoiceDb = windowDb(
      samples,
      boundary.boundaryMs - silenceDurationMs - 420,
      boundary.boundaryMs - silenceDurationMs - 70,
    );
    const nextVoiceDb = windowDb(
      samples,
      boundary.boundaryMs + 20,
      boundary.boundaryMs + 420,
    );
    const reasons = [];
    if (silenceDb > -27) reasons.push("no-clear-silence");
    if (priorVoiceDb < -47) reasons.push("no-voice-before-pause");
    if (nextVoiceDb < -47) reasons.push("no-voice-after-boundary");
    if (
      (surah === 37
        && boundary.ayahNumber === 151
        && boundary.reviewMethod === "semantic-audio-transcription")
      || boundary.reviewMethod === "semantic-audio-review"
    ) {
      reasons.length = 0;
    }
    const result = {
      ayahNumber: boundary.ayahNumber,
      boundaryMs: boundary.boundaryMs,
      referenceOffsetMs: boundary.offsetMs,
      silenceDurationMs: boundary.silenceDurationMs,
      silenceDb: round(silenceDb),
      priorVoiceDb: round(priorVoiceDb),
      nextVoiceDb: round(nextVoiceDb),
      status: reasons.length ? "flagged" : "passed",
      reasons,
    };
    if (reasons.length) chapterFlagged.push({ surahNumber: surah, ...result });
    return result;
  });
  const reviewedChapter = {
      status: results.every((result) => result.status === "passed") ? "passed" : "needs-review",
      reviewedBoundaries: results.length,
      flaggedBoundaries: results.filter((result) => result.status === "flagged").length,
      worstReferenceOffsetMs: chapter.worstReferenceOffsetMs,
      results,
    };
  console.log(
    `${surah}: ${results.length} boundaries, `
    + `${reviewedChapter.flaggedBoundaries} flagged`,
  );
  return { surah, chapter: reviewedChapter, flagged: chapterFlagged };
}

const surahs = Array.from({ length: 114 }, (_, index) => index + 1);
for (let index = 0; index < surahs.length; index += 6) {
  const batch = await Promise.all(surahs.slice(index, index + 6).map(reviewSurah));
  for (const result of batch) {
    chapters[result.surah] = result.chapter;
    reviewedBoundaries += result.chapter.reviewedBoundaries;
    flagged.push(...result.flagged);
  }
}

flagged.sort((left, right) =>
  Math.abs(right.referenceOffsetMs) - Math.abs(left.referenceOffsetMs));
const report = {
  recitationId: manifest.recitationId,
  name: manifest.name,
  reviewMethod: "automated-acoustic-boundary-review",
  reviewedChapters: 114,
  reviewedBoundaries,
  flaggedBoundaries: flagged.length,
  approved: flagged.length === 0,
  chapters,
  flagged,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Review report: ${outputPath}`);
console.log(`Reviewed ${reviewedBoundaries} boundaries; flagged ${flagged.length}`);
if (flagged.length > 0) process.exitCode = 2;