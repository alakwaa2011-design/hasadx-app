import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, mkdir, cp, rename, writeFile } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

function runTypecheck() {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsc", "--noEmit"], {
      cwd: artifactDir,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`API typecheck failed (${code})`)));
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((err) => err ? reject(err) : resolve(port));
    });
  });
}

async function smokeTest(distDir) {
  const port = await availablePort();
  // Never inherit a production database address into the probe process.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    key !== "DATABASE_URL" && key !== "TEST_DATABASE_URL" && !key.startsWith("PG")
  ));
  Object.assign(env, {
    NODE_ENV: "production",
    PORT: String(port),
    SESSION_SECRET: "build-smoke-test-only-not-a-deployment-secret",
    DATABASE_URL: "postgres://smoke:smoke@127.0.0.1:1/smoke",
    API_BUILD_SMOKE_TEST: "1",
  });
  const child = spawn(process.execPath, ["--enable-source-maps", path.join(distDir, "index.mjs")], {
    cwd: artifactDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => { output = (output + chunk.toString()).slice(-8000); });
  }
  let exited = false;
  let spawnError;
  child.on("error", (err) => { spawnError = err; exited = true; });
  child.on("exit", () => { exited = true; });
  const deadline = Date.now() + 45_000;
  try {
    while (Date.now() < deadline) {
      if (exited) throw new Error(`Compiled API exited before the health check${spawnError ? `: ${spawnError.message}` : ""}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/healthz`, {
          signal: AbortSignal.timeout(1500),
        });
        if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
        const body = await response.json();
        if (body.status !== "ok") throw new Error("Health check returned an invalid status");
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (exited) throw new Error("Compiled API exited after the health check");
        return;
      } catch (err) {
        if (err.message?.startsWith("Health check")) throw err;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw new Error("Timed out waiting for compiled API /api/healthz");
  } catch (err) {
    throw new Error(`${err.message}\nSmoke-test output:\n${output}`, { cause: err });
  } finally {
    child.kill("SIGTERM");
    if (!exited) await new Promise((resolve) => {
      const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 2000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  const candidateDir = path.resolve(artifactDir, `.dist-candidate-${process.pid}`);
  const backupDir = path.resolve(artifactDir, `.dist-backup-${process.pid}`);
  await runTypecheck();
  await rm(candidateDir, { recursive: true, force: true });
  try {

  // Pino embeds the configured outdir as an absolute worker path. Build for
  // the final directory but hold all bytes in memory until the candidate passes.
  const result = await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    write: false,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "@resvg/resvg-js",
      "@resvg/resvg-js-linux-x64-gnu",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
      "pdf-parse",
      "pdfjs-dist",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
  await mkdir(candidateDir, { recursive: true });
  for (const file of result.outputFiles) {
    const destination = path.join(candidateDir, path.relative(distDir, file.path));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.contents);
  }

  const dataSrc = path.resolve(artifactDir, "src/data");
  const dataDst = path.resolve(candidateDir, "data");
  await mkdir(dataDst, { recursive: true });
  await cp(dataSrc, dataDst, { recursive: true });
  await smokeTest(candidateDir);

  await rm(backupDir, { recursive: true, force: true });
  let hadPreviousBuild = false;
  try {
    await rename(distDir, backupDir);
    hadPreviousBuild = true;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  try {
    await rename(candidateDir, distDir);
  } catch (err) {
    if (hadPreviousBuild) await rename(backupDir, distDir);
    throw err;
  }
  if (hadPreviousBuild) await rm(backupDir, { recursive: true, force: true });
  } finally {
    await rm(candidateDir, { recursive: true, force: true });
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
