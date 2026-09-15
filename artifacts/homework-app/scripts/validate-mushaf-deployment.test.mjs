import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PAGE_COUNT = 604;
const validatorPath = fileURLToPath(
  new URL("./validate-mushaf-deployment.mjs", import.meta.url),
);
const validWebp = await readFile(
  new URL("../public/quran/mushaf-hafs-1441/001.webp", import.meta.url),
);

function manifest(overrides = {}) {
  return {
    pageCount: PAGE_COUNT,
    pages: Array.from({ length: PAGE_COUNT }, (_, index) => ({
      page: index + 1,
      file: `${String(index + 1).padStart(3, "0")}.webp`,
      bytes: validWebp.length,
    })),
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
    const body = overrides.body?.(file) ?? validWebp;
    response.statusCode = overrides.status?.(file) ?? 200;
    response.setHeader(
      "content-type",
      overrides.contentType?.(file) ?? "image/webp",
    );
    response.end(body);
  };
}

test("accepts a complete published Mushaf", async () => {
  const result = await runValidator(deployment());
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /all 604 Mushaf WebP pages/);
});

test("reports a missing page by filename", async () => {
  const result = await runValidator(
    deployment({ status: (file) => (file === "123.webp" ? 404 : 200) }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /123\.webp: HTTP 404/);
});

test("rejects a corrupt body that retains the WebP header and byte count", async () => {
  const corruptWebp = Buffer.alloc(validWebp.length);
  validWebp.copy(corruptWebp, 0, 0, 12);
  const result = await runValidator(
    deployment({
      body: (file) => (file === "222.webp" ? corruptWebp : validWebp),
    }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /222\.webp: cannot be decoded as a valid WebP/);
});

test("rejects a page whose size disagrees with the manifest", async () => {
  const result = await runValidator(
    deployment({
      body: (file) =>
        file === "333.webp" ? validWebp.subarray(0, 11) : validWebp,
    }),
  );
  assert.equal(result.code, 1);
  assert.match(
    result.output,
    new RegExp(
      `333\\.webp: received 11 bytes; manifest records ${validWebp.length}`,
    ),
  );
});

test("rejects a bad page content type", async () => {
  const result = await runValidator(
    deployment({
      contentType: (file) =>
        file === "444.webp" ? "text/html" : "image/webp",
    }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /444\.webp: content-type "text\/html"/);
});

test("rejects a manifest with the wrong page count", async () => {
  const result = await runValidator(
    deployment({ manifest: manifest({ pageCount: 603 }) }),
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /pageCount is 603; expected 604/);
});