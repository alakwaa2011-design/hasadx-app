import { describe, expect, it } from "vitest";
import { classNameFromPath } from "./class-route";

describe("rewards class route", () => {
  it.each(["العاشر/أ", "العاشر%2Fأ", "صف ٥", "العاشر?أ", "العاشر#أ"])(
    "reads the exact class name %s from its encoded URL",
    (name) => {
      const path = `/teacher/rewards/${encodeURIComponent(name)}`;
      expect(classNameFromPath(path, name)).toBe(name);
    },
  );

  it("keeps the router value for an invalid encoded segment", () => {
    expect(classNameFromPath("/teacher/rewards/%ZZ", "%ZZ")).toBe("%ZZ");
  });
});