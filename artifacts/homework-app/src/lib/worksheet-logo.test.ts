import { describe, expect, it } from "vitest";
import { worksheetLogoUrl } from "./worksheet-logo";

describe("worksheet logo integration", () => {
  it("uses transparent copies of the official opaque artwork", () => {
    expect(worksheetLogoUrl("/images/logo-hasaad.png")).toBe("/images/logo-hasaad-transparent.png");
    expect(worksheetLogoUrl("/images/logo-icon.png")).toBe("/images/logo-mark-transparent.png");
    expect(worksheetLogoUrl("/images/logo-mark.png")).toBe("/images/logo-mark-transparent.png");
  });
  it("never replaces custom or externally hosted school logos", () => {
    expect(worksheetLogoUrl("/api/objects/uploads/school-logo.png")).toBe("/api/objects/uploads/school-logo.png");
    expect(worksheetLogoUrl("https://school.example/images/logo-hasaad.png")).toBe("https://school.example/images/logo-hasaad.png");
    expect(worksheetLogoUrl(undefined)).toBeUndefined();
  });
});