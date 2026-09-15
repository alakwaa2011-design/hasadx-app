import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PAGE_COUNT = 604;
const EXPECTED_WIDTH = 904;
const EXPECTED_HEIGHT = 1292;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const assetDirectory = path.resolve(
  scriptDirectory,
  "../public/quran/mushaf-hafs-1441",
);

function fail(message) {
  throw new Error(`[mushaf-assets] ${message}`);
}

function readUint24LE(buffer, offset) {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16)
  );
}

function readWebpDimensions(buffer, fileName) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    fail(`${fileName} is not a valid WebP container`);
  }

  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8 ") {
    if (
      buffer[23] !== 0x9d ||
      buffer[24] !== 0x01 ||
      buffer[25] !== 0x2a
    ) {
      fail(`${fileName} has an invalid VP8 frame header`);
    }
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === "VP8X") {
    return {
      width: readUint24LE(buffer, 24) + 1,
      height: readUint24LE(buffer, 27) + 1,
    };
  }

  if (chunkType === "VP8L") {
    if (buffer[20] !== 0x2f) {
      fail(`${fileName} has an invalid VP8L frame header`);
    }
    return {
      width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8),
      height:
        1 +
        (buffer[22] >> 6) +
        (buffer[23] << 2) +
        ((buffer[24] & 0x0f) << 10),
    };
  }

  fail(`${fileName} uses unsupported WebP chunk type ${chunkType}`);
}

const directoryEntries = await readdir(assetDirectory, { withFileTypes: true });
const imageNames = directoryEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
  .map((entry) => entry.name)
  .sort();

if (imageNames.length !== PAGE_COUNT) {
  fail(`expected ${PAGE_COUNT} WebP pages, found ${imageNames.length}`);
}

const manifestPath = path.join(assetDirectory, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.pageCount !== PAGE_COUNT || manifest.pages?.length !== PAGE_COUNT) {
  fail("manifest must describe exactly 604 pages");
}

for (let page = 1; page <= PAGE_COUNT; page += 1) {
  const fileName = `${String(page).padStart(3, "0")}.webp`;
  const actualName = imageNames[page - 1];
  if (actualName !== fileName) {
    fail(`missing ${fileName}; found ${actualName ?? "no file"} in its place`);
  }

  const manifestPage = manifest.pages[page - 1];
  if (manifestPage?.page !== page || manifestPage.file !== fileName) {
    fail(`manifest entry ${page} does not match ${fileName}`);
  }

  const filePath = path.join(assetDirectory, fileName);
  const fileStats = await stat(filePath);
  if (fileStats.size !== manifestPage.bytes) {
    fail(
      `${fileName} size is ${fileStats.size} bytes, manifest says ${manifestPage.bytes}`,
    );
  }

  const buffer = await readFile(filePath);
  const dimensions = readWebpDimensions(buffer, fileName);
  if (
    dimensions.width !== EXPECTED_WIDTH ||
    dimensions.height !== EXPECTED_HEIGHT
  ) {
    fail(
      `${fileName} is ${dimensions.width}x${dimensions.height}; expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    );
  }
}

console.log(
  `[mushaf-assets] verified ${PAGE_COUNT} complete WebP pages at ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
);