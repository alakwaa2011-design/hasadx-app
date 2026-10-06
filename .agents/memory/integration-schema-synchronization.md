---
name: Integration schema synchronization
description: Why integration schema setup must preserve reference data while applying current Drizzle definitions.
---

Apply the current Drizzle schema to the existing dedicated integration database rather than dropping and recreating its `public` schema.

**Why:** The integration suite shares durable reference seeds such as subscription plans and AI tool prices. Rebuilding the schema produces structurally correct empty tables but causes unrelated tests to fail because those runtime-managed reference rows are gone.

**How to apply:** Use the integration-only database guard, run schema synchronization once in global setup, and let individual test files create only their scenario rows. Treat reference-data seeding as a separate concern from schema synchronization.

For a narrowly additive feature, its isolated integration tests can exercise the feature's runtime migration directly against the existing test schema when full-schema introspection exceeds the setup budget. Keep the dedicated test-database guard; never redirect those tests to shared application data.

**Why:** Full Drizzle introspection timed out while the test database was reachable; the focused additive migration and real concurrent HTTP persistence tests succeeded without rebuilding reference data.

**How to apply:** Limit this approach to tests whose baseline tables already exist and whose new schema is completely covered by the feature's migration. Do not use it to conceal unrelated stale-schema failures.