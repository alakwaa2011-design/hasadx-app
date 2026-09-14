import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for integration tests only.
 *
 * Differences from the default vitest.config.ts
 * ───────────────────────────────────────────────
 * • Runs a single file: subscription-credits-integration.test.ts
 * • Does NOT load setup-db-mock.ts (no @workspace/db auto-stub).
 * • Loads setup-integration.ts instead, which:
 *     - Validates TEST_DATABASE_URL is present and ≠ DATABASE_URL.
 *     - Redirects DATABASE_URL to the test database before the suite loads.
 *
 * Usage
 * ─────
 *   TEST_DATABASE_URL=postgresql://... pnpm --filter @workspace/api-server run test:integration
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/__tests__/subscription-credits-integration.test.ts",
      "src/__tests__/extract-credits-integration.test.ts",
      "src/__tests__/credit-consumption-integration.test.ts",
      "src/__tests__/free-welcome-credits.test.ts",
      "src/__tests__/plan-patch-route.integration.test.ts",
      "src/__tests__/webhook-idempotency.integration.test.ts",
      "src/__tests__/credits-admin-teachers.integration.test.ts",
      "src/__tests__/credit-packages-endpoint.integration.test.ts",
      "src/__tests__/checkout-redirect-url.integration.test.ts",
      "src/__tests__/welcome-backfill-integration.test.ts",
      "src/__tests__/manual-plan-grant.integration.test.ts",
      "src/__tests__/tts-cache-compensation.integration.test.ts",
      "src/__tests__/personal-assistant.integration.test.ts",
      "src/__tests__/feedback-messaging.integration.test.ts",
      "src/__tests__/ai-chat-support.integration.test.ts",
      "src/__tests__/annual-credit-release.integration.test.ts",
      "src/__tests__/worksheet-cell-regeneration-credits.integration.test.ts",
      "src/__tests__/hasaad-kids-learning.integration.test.ts",
      "src/__tests__/welcome-credits-auth-routes.integration.test.ts",
      "src/__tests__/ai-video-render-recovery.integration.test.ts",
      "src/__tests__/ai-video-request-journal.integration.test.ts",
      "src/__tests__/classroom-reward-safety.integration.test.ts",
      "src/__tests__/assignment-revisions.integration.test.ts",
      "src/__tests__/solo-challenge-best-result.integration.test.ts",
    ],
    setupFiles: ["src/__tests__/setup-integration.ts"],
    // الملفات تتشارك قاعدة الاختبار وتعدّل صف basic في plans — التنفيذ التسلسلي يمنع التداخل
    fileParallelism: false,
  },
});
