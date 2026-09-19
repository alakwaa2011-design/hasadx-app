import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("platform layout safe areas", () => {
  it("keeps global header controls below the iOS status bar", () => {
    expect(css).toContain("--site-safe-area-top: env(safe-area-inset-top, 0px)");
    expect(css).toContain(".site-layout-header");
    expect(css).toContain("padding-top: var(--site-safe-area-top)");
  });

  it("positions sticky page headers below the full safe platform header", () => {
    expect(css).toContain("--site-header-height: calc(3rem + var(--site-safe-area-top))");
    expect(css).toContain("top: var(--site-header-height)");
  });
});