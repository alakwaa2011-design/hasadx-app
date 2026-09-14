import { defineConfig } from "vitest/config";

/**
 * Paid, real-model regression checks. Keep this separate from the default
 * unit suite and run it periodically or before important releases.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/__tests__/teacher-schedule-vision-regression.integration.test.ts",
    ],
    fileParallelism: false,
  },
});