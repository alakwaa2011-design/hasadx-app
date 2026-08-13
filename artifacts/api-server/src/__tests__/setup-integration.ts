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

const testUrl = process.env.TEST_DATABASE_URL;
const prodUrl = process.env.DATABASE_URL;

if (!testUrl) {
  console.error(
    "\n[setup-integration] ❌  TEST_DATABASE_URL is not set.\n" +
      "  Set it to a dedicated test-only PostgreSQL connection string and retry.\n",
  );
  process.exit(1);
}

if (testUrl === prodUrl) {
  console.error(
    "\n[setup-integration] ❌  TEST_DATABASE_URL equals DATABASE_URL.\n" +
      "  Running integration tests against the production database is forbidden.\n" +
      "  Provide a separate test-only database URL in TEST_DATABASE_URL.\n",
  );
  process.exit(1);
}

// Point all @workspace/db connections at the test database for this process.
process.env.DATABASE_URL = testUrl;
