/**
 * Integration test setup — loaded ONLY by vitest.integration.config.ts.
 *
 * Requirements
 * ────────────
 * • TEST_DATABASE_URL must be set and non-empty.
 * • TEST_DATABASE_URL must differ from DATABASE_URL (production guard).
 *
 * Effect
 * ──────
 * Overwrites process.env.DATABASE_URL with TEST_DATABASE_URL so that every
 * module imported by the integration test suite connects to the test database,
 * not the production one.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_SETUP_TIMEOUT_MS = 60_000;

function useTestDatabase(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  const currentUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      "\n[setup-integration] TEST_DATABASE_URL is not set.\n" +
        "Set it to a dedicated test-only PostgreSQL connection string and retry.\n",
    );
  }

  if (testUrl === currentUrl && process.env.VITEST_INTEGRATION_DATABASE_READY !== "true") {
    throw new Error(
      "\n[setup-integration] TEST_DATABASE_URL equals DATABASE_URL.\n" +
        "Running integration tests against the production database is forbidden.\n" +
        "Provide a separate test-only database URL in TEST_DATABASE_URL.\n",
    );
  }

  process.env.DATABASE_URL = testUrl;
  return testUrl;
}

// Point all @workspace/db connections at the test database for this process.
const testDatabaseUrl = useTestDatabase();

export default async function setupIntegrationDatabase() {
  const workspaceRoot = fileURLToPath(new URL("../../../../", import.meta.url));

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", "@workspace/db", "run", "push-force"],
      {
        cwd: workspaceRoot,
        env: { ...process.env, DATABASE_URL: testDatabaseUrl },
        // drizzle-kit can still ask rename questions with --force. Closing stdin
        // makes that condition terminate instead of leaving Vitest at 0 tests.
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `[setup-integration] Test schema setup did not finish within ${SCHEMA_SETUP_TIMEOUT_MS / 1000}s.\n${output}`,
        ),
      );
    }, SCHEMA_SETUP_TIMEOUT_MS);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `[setup-integration] Test schema setup failed (${signal ?? `exit ${code}`}).\n${output}`,
        ),
      );
    });
  });

  process.env.VITEST_INTEGRATION_DATABASE_READY = "true";
  return () => {
    delete process.env.VITEST_INTEGRATION_DATABASE_READY;
  };
}
