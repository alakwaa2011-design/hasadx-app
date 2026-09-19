import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Storage } from "@google-cloud/storage";
import { ReplitConnectors } from "@replit/connectors-sdk";

const execFileAsync = promisify(execFile);
const DRIVE_FOLDER_ID = "1m5a3znSF2YsI3PzqNkoERxXWtO_-oskb";
const REFERENCE_RECITATION_ID = 1_000_004;
const OUTPUT_DIR = process.env.QURAN_IMPORT_OUTPUT_DIR || "/tmp/abu-bakr-al-dhabi-import";
const REPORT_PATH = `${OUTPUT_DIR}/manifest.json`;
const API_BASE_URL = process.env.QURAN_IMPORT_API_BASE_URL || "http://127.0.0.1:8080/api";
const MIN_AYAH_DURATION_MS = 700;
const REVIEWED_BOUNDARIES = JSON.parse(
  await readFile(new URL("./abu-bakr-al-dhabi-reviewed-boundaries.json", import.meta.url), "utf8"),
);
const REVIEWED_BOUNDARY_PATCHES = {
  38: { 67: 831_100, 68: 832_700, 69: 840_200, 70: 844_600 },
};
const CANONICAL_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98,
  135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75,
  85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19,
  36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4,
  7, 3, 6, 3, 5, 4, 5, 6,
];

const args = new Set(process.argv.slice(2));
const requestedSurahArg = process.argv.find((arg) => arg.startsWith("--surah="));
const requestedSurah = requestedSurahArg ? Number(requestedSurahArg.split("=")[1]) : null;
const startSurahArg = process.argv.find((arg) => arg.startsWith("--start-surah="));
const startSurah = startSurahArg ? Number(startSurahArg.split("=")[1]) : 1;
const dryRun = args.has("--dry-run");
const timingsOnly = args.has("--timings-only");
const publishManifest = args.has("--publish-manifest");
const keepDownloads = args.has("--keep-downloads");

function parseObjectPath(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/");
  if (parts.length < 3) throw new Error("PRIVATE_OBJECT_DIR is invalid");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

function storageClient() {
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: "http://127.0.0.1:1106/token",
      type: "external_account",
      credential_source: {
        url: "http://127.0.0.1:1106/credential",
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

async function listDriveAudio() {
  const connectors = new ReplitConnectors();
  const q = encodeURIComponent(`'${DRIVE_FOLDER_ID}' in parents and trashed = false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime)");
  const files = [];
  let pageToken = "";
  do {
    const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const response = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${page}`,
    );
    if (!response.ok) throw new Error(`Unable to list Drive folder: ${response.status} ${await response.text()}`);
    const payload = await response.json();
    files.push(...(payload.files || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  const numbered = files
    .filter((file) => file.mimeType === "audio/mpeg" && !file.name.includes("جزء"))
    .map((file) => ({ ...file, surahNumber: Number(file.name.match(/\d{1,3}/)?.[0]) }))
    .filter((file) => Number.isInteger(file.surahNumber) && file.surahNumber >= 1 && file.surahNumber <= 114);
  const bySurah = new Map();
  for (const file of numbered) {
    if (bySurah.has(file.surahNumber)) {
      throw new Error(`Duplicate Drive audio for surah ${file.surahNumber}`);
    }
    bySurah.set(file.surahNumber, file);
  }
  for (let surah = 1; surah <= 114; surah += 1) {
    if (!bySurah.has(surah)) throw new Error(`Missing Drive audio for surah ${surah}`);
  }
  return [...bySurah.values()].sort((a, b) => a.surahNumber - b.surahNumber);
}

async function downloadDriveFile(file, targetPath) {
  const existing = await stat(targetPath).catch(() => null);
  if (existing?.size === Number(file.size)) return;
  await rm(targetPath, { force: true });
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("google-drive", `/drive/v3/files/${file.id}?alt=media`);
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${file.name}: ${response.status} ${await response.text()}`);
  }
  await pipeline(response.body, createWriteStream(targetPath));
  const downloaded = await stat(targetPath);
  if (downloaded.size !== Number(file.size)) {
    throw new Error(`Incomplete download for ${file.name}: ${downloaded.size}/${file.size}`);
  }
}

async function sha256(path) {
  const buffer = await readFile(path);
  return createHash("sha256").update(buffer).digest("hex");
}

async function durationMs(path) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path,
  ]);
  const value = Math.round(Number(stdout.trim()) * 1000);
  if (!Number.isFinite(value) || value < 1) throw new Error(`Invalid audio duration for ${path}`);
  return value;
}

async function detectSilences(path) {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-hide_banner", "-i", path, "-af", "silencedetect=noise=-22dB:d=0.08", "-f", "null", "-",
  ], { maxBuffer: 32 * 1024 * 1024 }).catch((error) => {
    if (typeof error.stderr === "string" && error.stderr.includes("silence_")) return error;
    throw error;
  });
  const events = [];
  for (const line of String(stderr).split("\n")) {
    const start = line.match(/silence_start:\s*([0-9.]+)/);
    if (start) events.push({ type: "start", seconds: Number(start[1]) });
    const end = line.match(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/);
    if (end) events.push({ type: "end", seconds: Number(end[1]), duration: Number(end[2]) });
  }
  const silences = [];
  let pendingStart = null;
  for (const event of events) {
    if (event.type === "start") pendingStart = event.seconds;
    if (event.type === "end") {
      silences.push({
        startMs: Math.round((pendingStart ?? event.seconds - event.duration) * 1000),
        endMs: Math.round(event.seconds * 1000),
        durationMs: Math.round(event.duration * 1000),
      });
      pendingStart = null;
    }
  }
  return silences;
}

async function detectChapterStartMs(path) {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-hide_banner", "-i", path, "-af", "silencedetect=noise=-40dB:d=0.08", "-f", "null", "-",
  ], { maxBuffer: 2 * 1024 * 1024 }).catch((error) => {
    if (typeof error.stderr === "string" && error.stderr.includes("silence_end")) return error;
    throw error;
  });
  const match = String(stderr).match(/silence_start:\s*0(?:\.0+)?[\s\S]*?silence_end:\s*([0-9.]+)/);
  return match ? Math.round(Number(match[1]) * 1000) : 0;
}

async function referenceTimings(surahNumber, ayahCount) {
  const timings = [];
  for (let ayah = 1; ayah <= ayahCount; ayah += 1) {
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(
        `${API_BASE_URL}/quran/audio/${REFERENCE_RECITATION_ID}/${surahNumber}/${ayah}/timings`,
      );
      if (response.status !== 429) break;
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : 65_000;
      console.log(`Reference timing rate limit at ${surahNumber}:${ayah}; waiting ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (!response?.ok) {
      throw new Error(`Reference timing failed for ${surahNumber}:${ayah}: ${response?.status ?? "no response"}`);
    }
    const value = await response.json();
    timings.push({ startMs: value.verseStartMs, endMs: value.verseEndMs });
    if (timingsOnly) await new Promise((resolve) => setTimeout(resolve, 125));
  }
  return timings;
}

function chooseBoundaries({ surahNumber, audioDurationMs, chapterStartMs, silences, reference }) {
  const chapterEndMs = audioDurationMs;
  const boundaryCount = reference.length - 1;
  if (boundaryCount === 0) {
    return { chapterStartMs, chapterEndMs, bismillahEndMs: null, boundaries: [], qa: [] };
  }

  const allCandidates = silences.filter(
    (item) => item.endMs > chapterStartMs + 350 && item.endMs < chapterEndMs - 350,
  );
  const hasSeparateBismillah = surahNumber !== 1 && surahNumber !== 9;
  const bismillah = hasSeparateBismillah
    ? allCandidates.find((item) => item.endMs >= 3_000 && item.endMs <= 12_000 && item.durationMs >= 280)
    : null;
  const verseCandidates = bismillah
    ? allCandidates.filter((item) => item.endMs !== bismillah.endMs)
    : allCandidates;
  const strongCandidates = verseCandidates.filter((item) => item.durationMs >= 180);
  const candidates = strongCandidates.length >= boundaryCount ? strongCandidates : verseCandidates;
  if (candidates.length < boundaryCount) {
    throw new Error(`Only ${candidates.length} silence candidates for ${boundaryCount} boundaries`);
  }
  const referenceStart = reference[0].startMs;
  const referenceEnd = reference.at(-1).endMs;
  const referenceSpan = referenceEnd - referenceStart;
  const bismillahDuration = bismillah ? bismillah.endMs - chapterStartMs : 0;
  const targetSpan = chapterEndMs - chapterStartMs - bismillahDuration;
  const targets = reference.slice(0, -1).map((item) => (
    chapterStartMs
    + bismillahDuration
    + ((item.endMs - referenceStart) / referenceSpan) * targetSpan
  ));

  const rows = targets.map(() => new Float64Array(candidates.length).fill(Number.POSITIVE_INFINITY));
  const previous = targets.map(() => new Int32Array(candidates.length).fill(-1));
  for (let boundary = 0; boundary < targets.length; boundary += 1) {
    const expectedVerseMs = boundary === 0
      ? targets[0] - chapterStartMs
      : targets[boundary] - targets[boundary - 1];
    const minimumVerseMs = Math.max(MIN_AYAH_DURATION_MS, expectedVerseMs * 0.15);
    let bestPreviousCost = Number.POSITIVE_INFINITY;
    let bestPreviousIndex = -1;
    let previousCandidate = 0;
    for (let candidate = 0; candidate < candidates.length; candidate += 1) {
      while (
        boundary > 0
        && previousCandidate < candidate
        && candidates[previousCandidate].endMs
          <= candidates[candidate].endMs - minimumVerseMs
      ) {
        if (rows[boundary - 1][previousCandidate] < bestPreviousCost) {
          bestPreviousCost = rows[boundary - 1][previousCandidate];
          bestPreviousIndex = previousCandidate;
        }
        previousCandidate += 1;
      }
      const remainingCandidates = candidates.length - candidate - 1;
      const remainingBoundaries = targets.length - boundary - 1;
      if (remainingCandidates < remainingBoundaries) continue;
      if (boundary > 0 && bestPreviousIndex < 0) continue;
      if (boundary === 0 && candidates[candidate].endMs - chapterStartMs < MIN_AYAH_DURATION_MS) {
        continue;
      }
      if (
        boundary === targets.length - 1
        && chapterEndMs - candidates[candidate].endMs < MIN_AYAH_DURATION_MS
      ) {
        continue;
      }
      const tolerance = Math.max(1_000, expectedVerseMs * 0.45);
      const distance = Math.abs(candidates[candidate].endMs - targets[boundary]);
      const pauseReward = Math.min(candidates[candidate].durationMs, 900) / 900;
      const localCost = (distance / tolerance) ** 2 - pauseReward * 0.55;
      rows[boundary][candidate] = localCost + (boundary === 0 ? 0 : bestPreviousCost);
      previous[boundary][candidate] = bestPreviousIndex;
    }
  }

  let finalIndex = 0;
  let finalCost = Number.POSITIVE_INFINITY;
  const lastRow = rows.at(-1);
  for (let index = 0; index < lastRow.length; index += 1) {
    if (lastRow[index] < finalCost) {
      finalCost = lastRow[index];
      finalIndex = index;
    }
  }
  if (!Number.isFinite(finalCost)) throw new Error("Unable to align verse boundaries");

  const selected = new Array(boundaryCount);
  for (let boundary = boundaryCount - 1; boundary >= 0; boundary -= 1) {
    selected[boundary] = candidates[finalIndex];
    finalIndex = previous[boundary][finalIndex];
  }
  const qa = selected.map((item, index) => ({
    ayahNumber: index + 1,
    boundaryMs: item.endMs,
    targetMs: Math.round(targets[index]),
    offsetMs: Math.round(item.endMs - targets[index]),
    silenceDurationMs: item.durationMs,
  }));
  return {
    chapterStartMs,
    chapterEndMs,
    bismillahEndMs: bismillah?.endMs ?? null,
    boundaries: selected.map((item) => item.endMs),
    qa,
  };
}

function ayahTimings(alignment, ayahCount) {
  const edges = [alignment.chapterStartMs, ...alignment.boundaries, alignment.chapterEndMs];
  if (edges.length !== ayahCount + 1) throw new Error("Aligned ayah count is invalid");
  return Array.from({ length: ayahCount }, (_, index) => ({
    ayahNumber: index + 1,
    verseStartMs: edges[index],
    verseEndMs: edges[index + 1],
  }));
}

async function uploadAudio(localPath, surahNumber) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const { bucketName, objectName } = parseObjectPath(
    `${privateDir}/uploads/quran-recitation/abu-bakr-al-dhabi/${String(surahNumber).padStart(3, "0")}.mp3`,
  );
  const file = storageClient().bucket(bucketName).file(objectName);
  await file.save(await readFile(localPath), {
    contentType: "audio/mpeg",
    resumable: true,
    validation: "crc32c",
    metadata: { cacheControl: "private, max-age=604800, immutable" },
  });
  return `/objects/uploads/quran-recitation/abu-bakr-al-dhabi/${String(surahNumber).padStart(3, "0")}.mp3`;
}

async function uploadRuntimeManifest(report) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const boundaries = {};
  for (let surah = 1; surah <= 114; surah += 1) {
    if (surah === 95) {
      boundaries[surah] = [288, 10_366, 14_864, 19_565, 29_521, 36_624, 47_393, 53_431, 61_727];
      continue;
    }
    const chapter = report.chapters?.[surah];
    const ayahCount = CANONICAL_AYAH_COUNTS[surah - 1];
    if (!chapter || chapter.status !== "complete" || chapter.timings?.length !== ayahCount) {
      throw new Error(`Runtime manifest is incomplete at surah ${surah}`);
    }
    const edges = [
      chapter.timings[0].verseStartMs,
      ...chapter.timings.map((timing) => timing.verseEndMs),
    ];
    if (edges.some((edge, index) => !Number.isFinite(edge) || (index > 0 && edge <= edges[index - 1]))) {
      throw new Error(`Runtime manifest timings are invalid at surah ${surah}`);
    }
    boundaries[surah] = edges;
  }
  const { bucketName, objectName } = parseObjectPath(
    `${privateDir}/uploads/quran-recitation/abu-bakr-al-dhabi/verse-boundaries.json`,
  );
  const buffer = Buffer.from(`${JSON.stringify(boundaries)}\n`, "utf8");
  await storageClient().bucket(bucketName).file(objectName).save(buffer, {
    contentType: "application/json",
    resumable: false,
    validation: "crc32c",
    metadata: { cacheControl: "private, max-age=604800, immutable" },
  });
  console.log(`Runtime manifest uploaded: 114 chapters, ${buffer.length} bytes`);
}

async function loadReport() {
  return JSON.parse(await readFile(REPORT_PATH, "utf8").catch(() => "{\"chapters\":{}}"));
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = await loadReport();
  report.recitationId = 2_001_095;
  report.name = "أبوبكر الظبي";
  report.sourceFolderId = DRIVE_FOLDER_ID;
  report.chapters ||= {};
  if (publishManifest) {
    await uploadRuntimeManifest(report);
    return;
  }
  const sourceFiles = await listDriveAudio();
  const selected = sourceFiles.filter((file) => {
    if (requestedSurah !== null) return file.surahNumber === requestedSurah;
    return file.surahNumber !== 95 && file.surahNumber >= startSurah;
  });
  if (requestedSurah !== null && selected.length !== 1) throw new Error(`Surah ${requestedSurah} was not found`);

  for (const [index, file] of selected.entries()) {
    const surah = file.surahNumber;
    if (!dryRun && !timingsOnly && report.chapters[surah]?.status === "complete") {
      console.log(`[${index + 1}/${selected.length}] ${surah}: already complete`);
      continue;
    }
    const localPath = `${OUTPUT_DIR}/${String(surah).padStart(3, "0")}.mp3`;
    console.log(`[${index + 1}/${selected.length}] ${surah}: downloading ${file.name}`);
    await downloadDriveFile(file, localPath);
    const [audioDurationMs, chapterStartMs, silences, digest, reference] = await Promise.all([
      durationMs(localPath),
      detectChapterStartMs(localPath),
      detectSilences(localPath),
      sha256(localPath),
      referenceTimings(surah, CANONICAL_AYAH_COUNTS[surah - 1]),
    ]);
    const reviewedEdges = REVIEWED_BOUNDARIES[String(surah)];
    const alignment = Array.isArray(reviewedEdges)
      ? {
          chapterStartMs: reviewedEdges[0],
          chapterEndMs: reviewedEdges.at(-1),
          bismillahEndMs: null,
          boundaries: reviewedEdges.slice(1, -1),
          qa: reviewedEdges.slice(1, -1).map((boundaryMs, index) => ({
            ayahNumber: index + 1,
            boundaryMs,
            targetMs: reference[index].endMs,
            offsetMs: boundaryMs - reference[index].endMs,
            silenceDurationMs: silences.find(
              (silence) => Math.abs(silence.endMs - boundaryMs) <= 50,
            )?.durationMs ?? 0,
            reviewMethod: "semantic-audio-transcription",
          })),
        }
      : chooseBoundaries({
          surahNumber: surah,
          audioDurationMs,
          chapterStartMs,
          silences,
          reference,
        });
    const reviewedPatches = REVIEWED_BOUNDARY_PATCHES[surah];
    if (reviewedPatches) {
      for (const [ayahNumberValue, boundaryMs] of Object.entries(reviewedPatches)) {
        const ayahNumber = Number(ayahNumberValue);
        alignment.boundaries[ayahNumber - 1] = boundaryMs;
        alignment.qa[ayahNumber - 1] = {
          ayahNumber,
          boundaryMs,
          targetMs: reference[ayahNumber - 1].endMs,
          offsetMs: boundaryMs - reference[ayahNumber - 1].endMs,
          silenceDurationMs: 0,
          reviewMethod: "semantic-audio-review",
        };
      }
    }
    const timings = ayahTimings(alignment, CANONICAL_AYAH_COUNTS[surah - 1]);
    const worstOffsetMs = Math.max(0, ...alignment.qa.map((item) => Math.abs(item.offsetMs)));
    const objectPath = dryRun
      ? null
      : timingsOnly
        ? report.chapters[surah]?.objectPath
        : await uploadAudio(localPath, surah);
    if (!dryRun && !objectPath) throw new Error(`Uploaded object path is missing for surah ${surah}`);
    report.chapters[surah] = {
      status: dryRun ? "dry-run" : "complete",
      sourceFileId: file.id,
      sourceName: file.name,
      sourceSize: Number(file.size),
      sha256: digest,
      durationMs: audioDurationMs,
      objectPath,
      bismillahEndMs: alignment.bismillahEndMs,
      worstReferenceOffsetMs: worstOffsetMs,
      timings,
      qa: alignment.qa,
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `[${index + 1}/${selected.length}] ${surah}: ${timings.length} ayahs, `
      + `${audioDurationMs}ms, worst reference offset ${worstOffsetMs}ms`
      + `${dryRun ? " (dry run)" : timingsOnly ? " (timings refreshed)" : " (uploaded)"}`,
    );
    if (!keepDownloads) await rm(localPath, { force: true });
  }
  console.log(`Manifest: ${REPORT_PATH}`);
}

await main();