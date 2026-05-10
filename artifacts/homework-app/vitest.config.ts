import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vitest config for component-level unit tests in the homework-app.
 *
 * The e2e suite under `tests/e2e` is driven by Playwright (see
 * `playwright.config.ts`). This config covers the lighter-weight
 * `*.test.ts(x)` specs that live next to the code they exercise under
 * `src/`. We need the React Vite plugin so JSX compiles, and a jsdom
 * environment so `react-dom/client` can render real DOM nodes whose
 * inline styles we can assert on.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
