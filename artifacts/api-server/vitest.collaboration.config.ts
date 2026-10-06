import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/collaboration.integration.test.ts", "src/__tests__/collaboration-media.integration.test.ts"],
    setupFiles: ["src/__tests__/setup-collaboration-db.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
