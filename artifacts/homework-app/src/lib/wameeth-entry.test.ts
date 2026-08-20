import { describe, expect, it } from "vitest";
import {
  getWameethSetupAssignmentId,
  getWameethSetupPath,
  WAMEETH_SETUP_PATH,
} from "./wameeth-entry";

describe("Wameeth teacher entry contract", () => {
  it.each([
    ["أنشطتي → لعبة مباشرة", 42],
    ["الألعاب التعليمية → وميض → اختيار واجب", 42],
    ["بطاقة وميض المختصرة", 42],
  ])("%s ends at the shared assignment setup", (_entry, assignmentId) => {
    const destination = getWameethSetupPath(assignmentId);

    expect(destination).toBe(`${WAMEETH_SETUP_PATH}?assignmentId=${assignmentId}`);
    expect(getWameethSetupAssignmentId(new URL(destination, "https://hasaadx.com").search))
      .toBe(assignmentId);
  });

  it("keeps generic Wameeth entries on the same shared setup", () => {
    expect(getWameethSetupPath()).toBe(WAMEETH_SETUP_PATH);
  });

  it("rejects malformed assignment ids instead of preloading a wrong activity", () => {
    expect(getWameethSetupAssignmentId("?assignmentId=0")).toBeNull();
    expect(getWameethSetupAssignmentId("?assignmentId=42x")).toBeNull();
    expect(getWameethSetupAssignmentId("?assignmentId=-42")).toBeNull();
  });
});