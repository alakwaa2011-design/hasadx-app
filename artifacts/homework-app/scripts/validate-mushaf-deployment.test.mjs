import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PAGE_COUNT = 604;
const validWoff2 = Buffer.from("wOF2-valid-test-font");
const validatorPath = fileURLToPath(
  new URL("./validate-mushaf-deployment.mjs", import.meta.url),
);

function manifest(overrides = {}) {
  const files = Array.from({ length: PAGE_COUNT }, (_, index) => ({
    page: index + 1,
    file: `p${index + 1}.woff2`,
    bytes: validWoff2.length,
    sha256: "a".repeat(64),
  }));
  return {
    format: "QCF V2 WOFF2",
    pageCount: PAGE_COUNT,
    files,
    totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
    ...overrides,
  };
}

async function runValidator(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    return await new Promise((resolve) => {
      const child = spawn(process.execPath, [
        validatorPath,
        `http://127.0.0.1:${port}`,
      ]);
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (code) => resolve({ code, output }));
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function deployment(overrides = {}) {
  return (request, response) => {
    if (request.url.endsWith("/manifest.json")) {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(overrides.manifest ?? manifest()));
      return;
    }

    const file = request.url.split("/").at(-1);
    const body = overrides.body?.(file) ?? validWoff2;
    response.statusCode = overrides.status?.(file) ?? 200;
    response.setHeader(
      "content-type",
      overrides.contentType?.(file) ?? "font/woff2",
    );
    response.setHeader(
      "cache-control",
      overrides.cacheControl?.(file) ??
        "public, max-age=31536000, immutable",
    );
    response.end(body);
  };
}

test("accepts all published QCF V2 fonts", async () => {
  const result = await runValidator(deployment());
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /all 604 WOFF2 page fonts/);
});

test("reports a missing font by filename", async () => {
  const result = await runValidator(
    deployment({ status: (file) => (file === "p123.woff2" ? 404 : 200) }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /p123\.woff2: HTTP 404/);
});

test("rejects a font without the WOFF2 signature", async () => {
  const invalid = Buffer.from(validWoff2);
  invalid.write("BAD!", 0, "ascii");
  const result = await runValidator(
    deployment({ body: (file) => (file === "p222.woff2" ? invalid : validWoff2) }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /p222\.woff2: invalid WOFF2 signature/);
});

test("rejects a font whose size disagrees with the manifest", async () => {
  const result = await runValidator(
    deployment({
      body: (file) =>
        file === "p333.woff2" ? validWoff2.subarray(0, 11) : validWoff2,
    }),
  );
  assert.equal(result.code, 1);
  assert.match(
    result.output,
    new RegExp(
      `p333\\.woff2: received 11 bytes; manifest records ${validWoff2.length}`,
    ),
  );
});

test("rejects a bad font content type", async () => {
  const result = await runValidator(
    deployment({
      contentType: (file) =>
        file === "p444.woff2" ? "text/html" : "font/woff2",
    }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /p444\.woff2: content-type "text\/html"/);
});

test("rejects short-lived font caching", async () => {
  const result = await runValidator(
    deployment({
      cacheControl: (file) =>
        file === "p555.woff2"
          ? "public, max-age=3600"
          : "public, max-age=31536000, immutable",
    }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /p555\.woff2: cache-control "public, max-age=3600"/);
});

test("rejects a manifest with the wrong page count", async () => {
  const result = await runValidator(
    deployment({ manifest: manifest({ pageCount: 603 }) }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /pageCount is 603; expected 604/);
});