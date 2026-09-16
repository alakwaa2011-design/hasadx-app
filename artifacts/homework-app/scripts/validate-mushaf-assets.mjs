import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { createHash } from "node:crypto";

const PAGE_COUNT = 604;
const EXPECTED_WIDTH = 904;
const EXPECTED_HEIGHT = 1292;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const assetDirectory = fileURLToPath(
  new URL("../public/quran/mushaf-hafs-1441/", import.meta.url),
);
const manifestPath = path.join(assetDirectory, "manifest.json");
const fontDirectory = fileURLToPath(
  new URL("../public/quran/qcf-v2/", import.meta.url),
);
const fontManifestPath = path.join(fontDirectory, "manifest.json");

function fail(message) {
  throw new Error(`Mushaf asset validation failed: ${message}`);
}

function expectedFileName(page) {
  return `${String(page).padStart(3, "0")}.webp`;
}

async function validatePage(pageEntry, page) {
  const file = expectedFileName(page);

  if (
    pageEntry === null ||
    typeof pageEntry !== "object" ||
    pageEntry.page !== page ||
    pageEntry.file !== file ||
    !Number.isSafeInteger(pageEntry.bytes) ||
    pageEntry.bytes <= 0 ||
    !SHA256_PATTERN.test(pageEntry.sourceSha256)
  ) {
    fail(`manifest entry for page ${page} is invalid`);
  }

  const filePath = path.join(assetDirectory, file);
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    fail(`${file} is not a regular file`);
  }
  if (fileStats.size !== pageEntry.bytes) {
    fail(
      `${file} has ${fileStats.size} bytes, but manifest.json records ${pageEntry.bytes}`,
    );
  }

  try {
    const image = sharp(filePath, { failOn: "error" });
    const metadata = await image.metadata();
    if (metadata.format !== "webp") {
      fail(`${file} is ${metadata.format ?? "an unknown format"}, not WebP`);
    }
    if (
      metadata.width !== EXPECTED_WIDTH ||
      metadata.height !== EXPECTED_HEIGHT
    ) {
      fail(
        `${file} is ${metadata.width}x${metadata.height}; expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
      );
    }

    // Metadata alone can succeed for a truncated image. Force a full decode.
    await image.raw().toBuffer();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Mushaf asset validation failed:")
    ) {
      throw error;
    }
    fail(`${file} cannot be decoded as a valid WebP image: ${error.message}`);
  }
}

async function validateFont(fontEntry, page) {
  const file = `p${page}.woff2`;
  if (
    fontEntry === null ||
    typeof fontEntry !== "object" ||
    fontEntry.page !== page ||
    fontEntry.file !== file ||
    !Number.isSafeInteger(fontEntry.bytes) ||
    fontEntry.bytes < 10_000 ||
    fontEntry.bytes > 500_000 ||
    !SHA256_PATTERN.test(fontEntry.sha256)
  ) {
    fail(`QCF V2 manifest entry for page ${page} is invalid`);
  }

  const bytes = await readFile(path.join(fontDirectory, file));
  if (bytes.length !== fontEntry.bytes) {
    fail(`${file} has ${bytes.length} bytes, but the QCF V2 manifest records ${fontEntry.bytes}`);
  }
  if (bytes.subarray(0, 4).toString("ascii") !== "wOF2") {
    fail(`${file} does not have a valid WOFF2 signature`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== fontEntry.sha256) {
    fail(`${file} does not match its trusted SHA-256 digest`);
  }
}

async function validateFonts() {
  const manifest = JSON.parse(await readFile(fontManifestPath, "utf8"));
  if (
    manifest.format !== "QCF V2 WOFF2" ||
    manifest.pageCount !== PAGE_COUNT ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== PAGE_COUNT
  ) {
    fail(`QCF V2 manifest must describe exactly ${PAGE_COUNT} page fonts`);
  }

  const entries = await readdir(fontDirectory, { withFileTypes: true });
  const fontFiles = entries
    .filter((entry) => entry.isFile() && /^p\d+\.woff2$/.test(entry.name))
    .map((entry) => entry.name);
  const expectedFiles = Array.from({ length: PAGE_COUNT }, (_, index) => `p${index + 1}.woff2`);
  if (
    fontFiles.length !== PAGE_COUNT ||
    expectedFiles.some((file) => !fontFiles.includes(file))
  ) {
    fail(`expected exactly ${PAGE_COUNT} sequential QCF V2 WOFF2 files`);
  }

  const concurrency = 16;
  for (let index = 0; index < PAGE_COUNT; index += concurrency) {
    await Promise.all(
      manifest.files
        .slice(index, index + concurrency)
        .map((entry, offset) => validateFont(entry, index + offset + 1)),
    );
  }

  const totalBytes = manifest.files.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes !== manifest.totalBytes) {
    fail(`QCF V2 total size is ${totalBytes}, but the manifest records ${manifest.totalBytes}`);
  }
  console.log(`Validated ${PAGE_COUNT} local QCF V2 WOFF2 fonts (${totalBytes} bytes) against SHA-256 manifest.`);
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.pageCount !== PAGE_COUNT) {
    fail(
      `manifest.json pageCount is ${manifest.pageCount}; expected ${PAGE_COUNT}`,
    );
  }
  if (!Array.isArray(manifest.pages) || manifest.pages.length !== PAGE_COUNT) {
    fail(
      `manifest.json contains ${manifest.pages?.length ?? 0} page entries; expected ${PAGE_COUNT}`,
    );
  }

  const directoryEntries = await readdir(assetDirectory, {
    withFileTypes: true,
  });
  const webpFiles = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
    .map((entry) => entry.name)
    .sort();
  const expectedFiles = Array.from(
    { length: PAGE_COUNT },
    (_, index) => expectedFileName(index + 1),
  );

  if (
    webpFiles.length !== PAGE_COUNT ||
    webpFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    const missing = expectedFiles.filter((file) => !webpFiles.includes(file));
    const unexpected = webpFiles.filter((file) => !expectedFiles.includes(file));
    fail(
      `expected exactly ${PAGE_COUNT} sequential WebP files` +
        `${missing.length ? `; missing: ${missing.join(", ")}` : ""}` +
        `${unexpected.length ? `; unexpected: ${unexpected.join(", ")}` : ""}`,
    );
  }

  const concurrency = 8;
  for (let index = 0; index < PAGE_COUNT; index += concurrency) {
    await Promise.all(
      manifest.pages
        .slice(index, index + concurrency)
        .map((entry, offset) => validatePage(entry, index + offset + 1)),
    );
  }

  console.log(
    `Validated ${PAGE_COUNT} Mushaf WebP pages (${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}) against manifest.json.`,
  );
  await validateFonts();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});