import { defineConfig } from "vitest/config";

/**
 * Config للاختبارات التكاملية — تعمل على DB حقيقي بدون mocks.
 * تشغيل: pnpm --filter @workspace/api-server exec vitest run --config vitest.integration.config.ts
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/subscription-credits-integration.test.ts"],
    setupFiles: [], // NO mock setup
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
