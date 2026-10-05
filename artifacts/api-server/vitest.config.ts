import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // This suite requires setup-integration.ts to redirect DATABASE_URL before
    // @workspace/db is imported; the default setup intentionally auto-mocks it.
    exclude: [
      "src/__tests__/presentation-word-cloud.integration.test.ts",
      "src/__tests__/ai-video-render-recovery.integration.test.ts",
      "src/__tests__/ai-video-request-journal.integration.test.ts",
      "src/__tests__/teacher-schedule-vision-regression.integration.test.ts",
    ],
    // Registers a global vi.mock("@workspace/db") backed by a Proxy so any
    // table export — current or future — is auto-stubbed. Tests that supply
    // their own vi.mock factory continue to override this per-file.
    setupFiles: ["src/__tests__/setup-db-mock.ts"],
  },
});
