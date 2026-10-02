import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { fileURLToPath } from "node:url";

let child;
let port;
function get(path, host = "hasaadx.com") {
  return new Promise((resolve, reject) => {
    request({ hostname: "127.0.0.1", port, path, headers: { host } }, response => {
      response.resume();
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers }));
    }).on("error", reject).end();
  });
}
before(async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  child = spawn(process.execPath, ["serve.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await get("/"); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error("Built frontend server did not start");
});
after(() => child?.kill());

test("short game path is a server-side redirect, not an SPA-only dependency", async () => {
  const response = await get("/s/abcdef2345");
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, "/api/game-share-links/abcdef2345/redirect");
  assert.equal(response.headers["cache-control"], "no-store");
});
test("legacy domain canonicalization preserves the short code", async () => {
  const response = await get("/s/abcdef2345", "hasadx.com");
  assert.equal(response.status, 301);
  assert.equal(response.headers.location, "https://hasaadx.com/s/abcdef2345");
});
test("short paths do not steal legacy student, solo or assignment SPA paths", async () => {
  for (const path of ["/solo/legacy-arabic-title", "/student/login", "/solve/1234"]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.location, undefined, path);
  }
});