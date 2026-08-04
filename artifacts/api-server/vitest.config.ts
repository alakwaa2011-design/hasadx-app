import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Registers a global vi.mock("@workspace/db") backed by a Proxy so any
    // table export — current or future — is auto-stubbed. Tests that supply
    // their own vi.mock factory continue to override this per-file.
    setupFiles: ["src/__tests__/setup-db-mock.ts"],
  },
});
