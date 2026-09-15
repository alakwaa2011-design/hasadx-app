import sharp from "sharp";

const PAGE_COUNT = 604;
const CONCURRENCY = 12;
const REQUEST_TIMEOUT_MS = 30_000;
const EXPECTED_WIDTH = 904;
const EXPECTED_HEIGHT = 1292;
const MUSHAF_PATH = "quran/mushaf-hafs-1441";
const WEBP_CONTENT_TYPE = /^image\/webp(?:\s*;|$)/i;
const JSON_CONTENT_TYPE = /^(?:application|text)\/(?:[\w.+-]*\+)?json(?:\s*;|$)/i;

function expectedFileName(page) {
  return `${String(page).padStart(3, "0")}.webp`;
}

function resolveBaseUrl() {
  const cliUrl = process.argv.slice(2).find((argument) => argument !== "--");
  const value =
    cliUrl ??
    process.env.MUSHAF_DEPLOYMENT_URL ??
    process.env.PRODUCTION_URL;

  if (!value) {
    throw new Error(
      "Provide the published app URL as an argument or set MUSHAF_DEPLOYMENT_URL.",
    );
  }

  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The published app URL must use HTTP or HTTPS.");
  }
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  return url;
}

async function request(url) {
  return fetch(url, {
    redirect: "follow",
    headers: { accept: "application/json,image/webp" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function validateManifest(baseUrl) {
  const url = new URL(`${MUSHAF_PATH}/manifest.json`, baseUrl);
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`manifest.json returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new Error(
      `manifest.json returned content-type "${contentType || "(missing)"}"`,
    );
  }

  let manifest;
  try {
    manifest = await response.json();
  } catch (error) {
    throw new Error(`manifest.json is not valid JSON: ${error.message}`);
  }

  if (manifest.pageCount !== PAGE_COUNT) {
    throw new Error(
      `manifest.json pageCount is ${manifest.pageCount}; expected ${PAGE_COUNT}`,
    );
  }
  if (!Array.isArray(manifest.pages) || manifest.pages.length !== PAGE_COUNT) {
    throw new Error(
      `manifest.json contains ${manifest.pages?.length ?? 0} page entries; expected ${PAGE_COUNT}`,
    );
  }

  const invalidEntries = [];
  for (let page = 1; page <= PAGE_COUNT; page += 1) {
    const entry = manifest.pages[page - 1];
    const expectedFile = expectedFileName(page);
    if (
      !entry ||
      entry.page !== page ||
      entry.file !== expectedFile ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes <= 0
    ) {
      invalidEntries.push(expectedFile);
    }
  }
  if (invalidEntries.length) {
    throw new Error(
      `manifest.json has invalid or missing entries: ${invalidEntries.join(", ")}`,
    );
  }

  return manifest.pages;
}

async function validatePage(baseUrl, pageEntry) {
  const page = pageEntry.page;
  const file = expectedFileName(page);
  const url = new URL(`${MUSHAF_PATH}/${file}`, baseUrl);

  try {
    const response = await request(url);
    if (response.status !== 200) {
      return `${file}: HTTP ${response.status}`;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!WEBP_CONTENT_TYPE.test(contentType)) {
      return `${file}: content-type "${contentType || "(missing)"}"`;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      return `${file}: empty response body`;
    }
    if (bytes.length !== pageEntry.bytes) {
      return `${file}: received ${bytes.length} bytes; manifest records ${pageEntry.bytes}`;
    }
    try {
      const image = sharp(bytes, { failOn: "error" });
      const metadata = await image.metadata();
      if (metadata.format !== "webp") {
        return `${file}: decoded format is ${metadata.format ?? "unknown"}, not WebP`;
      }
      if (
        metadata.width !== EXPECTED_WIDTH ||
        metadata.height !== EXPECTED_HEIGHT
      ) {
        return `${file}: decoded dimensions are ${metadata.width}x${metadata.height}; expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`;
      }
      await image.raw().toBuffer();
    } catch (error) {
      return `${file}: cannot be decoded as a valid WebP image (${error.message})`;
    }
    return null;
  } catch (error) {
    return `${file}: request failed (${error.message})`;
  }
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const pages = await validateManifest(baseUrl);

  const failures = [];
  for (let start = 1; start <= PAGE_COUNT; start += CONCURRENCY) {
    const results = await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY, PAGE_COUNT - start + 1) },
        (_, offset) => validatePage(baseUrl, pages[start + offset - 1]),
      ),
    );
    failures.push(...results.filter(Boolean));
  }

  if (failures.length) {
    throw new Error(
      `Published Mushaf validation failed for ${failures.length} page(s):\n- ${failures.join("\n- ")}`,
    );
  }

  console.log(
    `Validated published manifest.json and all ${PAGE_COUNT} Mushaf WebP pages at ${baseUrl.origin}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});