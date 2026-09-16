const PAGE_COUNT = 604;
const CONCURRENCY = 12;
const REQUEST_TIMEOUT_MS = 30_000;
const QCF_V2_PATH = "quran/qcf-v2";
const WOFF2_CONTENT_TYPE = /^font\/woff2(?:\s*;|$)/i;
const JSON_CONTENT_TYPE = /^(?:application|text)\/(?:[\w.+-]*\+)?json(?:\s*;|$)/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MIN_LONG_CACHE_SECONDS = 31_536_000;

function expectedFileName(page) {
  return `p${page}.woff2`;
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
    headers: { accept: "application/json,font/woff2" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function validateLongCache(file, cacheControl) {
  const directives = new Map(
    cacheControl
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .map((directive) => {
        const separator = directive.indexOf("=");
        return separator === -1
          ? [directive, true]
          : [directive.slice(0, separator), directive.slice(separator + 1)];
      }),
  );
  const maxAge = Number(directives.get("max-age"));
  if (
    !directives.has("public") ||
    !directives.has("immutable") ||
    !Number.isSafeInteger(maxAge) ||
    maxAge < MIN_LONG_CACHE_SECONDS
  ) {
    return `${file}: cache-control "${cacheControl || "(missing)"}"; expected public, max-age>=${MIN_LONG_CACHE_SECONDS}, immutable`;
  }
  return null;
}

async function validateManifest(baseUrl) {
  const url = new URL(`${QCF_V2_PATH}/manifest.json`, baseUrl);
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`QCF V2 manifest.json returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new Error(
      `QCF V2 manifest.json returned content-type "${contentType || "(missing)"}"`,
    );
  }

  let manifest;
  try {
    manifest = await response.json();
  } catch (error) {
    throw new Error(`QCF V2 manifest.json is not valid JSON: ${error.message}`);
  }

  if (manifest.format !== "QCF V2 WOFF2") {
    throw new Error(`QCF V2 manifest.json has unexpected format "${manifest.format}"`);
  }
  if (manifest.pageCount !== PAGE_COUNT) {
    throw new Error(
      `QCF V2 manifest.json pageCount is ${manifest.pageCount}; expected ${PAGE_COUNT}`,
    );
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== PAGE_COUNT) {
    throw new Error(
      `QCF V2 manifest.json contains ${manifest.files?.length ?? 0} file entries; expected ${PAGE_COUNT}`,
    );
  }

  let totalBytes = 0;
  const invalidEntries = [];
  for (let page = 1; page <= PAGE_COUNT; page += 1) {
    const entry = manifest.files[page - 1];
    const expectedFile = expectedFileName(page);
    if (
      !entry ||
      entry.page !== page ||
      entry.file !== expectedFile ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      !SHA256_PATTERN.test(entry.sha256)
    ) {
      invalidEntries.push(expectedFile);
      continue;
    }
    totalBytes += entry.bytes;
  }
  if (invalidEntries.length) {
    throw new Error(
      `QCF V2 manifest.json has invalid or missing entries: ${invalidEntries.join(", ")}`,
    );
  }
  if (manifest.totalBytes !== totalBytes) {
    throw new Error(
      `QCF V2 manifest.json totalBytes is ${manifest.totalBytes}; entries total ${totalBytes}`,
    );
  }

  return manifest.files;
}

async function validateFont(baseUrl, fontEntry) {
  const file = expectedFileName(fontEntry.page);
  const url = new URL(`${QCF_V2_PATH}/${file}`, baseUrl);

  try {
    const response = await request(url);
    if (response.status !== 200) {
      return `${file}: HTTP ${response.status}`;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!WOFF2_CONTENT_TYPE.test(contentType)) {
      return `${file}: content-type "${contentType || "(missing)"}"`;
    }

    const cacheFailure = validateLongCache(
      file,
      response.headers.get("cache-control") ?? "",
    );
    if (cacheFailure) return cacheFailure;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== fontEntry.bytes) {
      return `${file}: received ${bytes.length} bytes; manifest records ${fontEntry.bytes}`;
    }
    if (bytes.subarray(0, 4).toString("ascii") !== "wOF2") {
      return `${file}: invalid WOFF2 signature`;
    }
    return null;
  } catch (error) {
    return `${file}: request failed (${error.message})`;
  }
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const fonts = await validateManifest(baseUrl);

  const failures = [];
  for (let start = 0; start < PAGE_COUNT; start += CONCURRENCY) {
    const results = await Promise.all(
      fonts
        .slice(start, start + CONCURRENCY)
        .map((entry) => validateFont(baseUrl, entry)),
    );
    failures.push(...results.filter(Boolean));
  }

  if (failures.length) {
    throw new Error(
      `Published QCF V2 validation failed for ${failures.length} font(s):\n- ${failures.join("\n- ")}`,
    );
  }

  console.log(
    `Validated published QCF V2 manifest and all ${PAGE_COUNT} WOFF2 page fonts at ${baseUrl.origin}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});