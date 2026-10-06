// Focused additive migration tests do not need to introspect/push every table.
// Keep the same strict isolation guard as the full integration suite.
if (!process.env.TEST_DATABASE_URL || (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
  && process.env.VITEST_COLLAB_DATABASE_ISOLATED !== "true")) {
  throw new Error("Collaboration tests require a separate TEST_DATABASE_URL; shared application data is forbidden.");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.VITEST_COLLAB_DATABASE_ISOLATED = "true";
