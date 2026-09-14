import { describe, expect, it } from "vitest";
import {
  canUseActivityAsWameethSource,
  getWameethSetupAssignmentId,
  getWameethSetupPath,
  isOwnedWameethSource,
  requiresImportedCopyForLiveWameeth,
  WAMEETH_SETUP_PATH,
} from "./wameeth-entry";

describe("Wameeth teacher entry contract", () => {
  it("shows only the current teacher's rows in personal activity pickers", () => {
    expect(isOwnedWameethSource({ teacherId: 42, isShared: true }, 42)).toBe(true);
    expect(isOwnedWameethSource({ teacherId: 7, isShared: true, hiddenByAdmin: false }, 42)).toBe(false);
    expect(isOwnedWameethSource({ teacherId: null }, 42)).toBe(false);
  });

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

  it("accepts an owned activity even when it is not shared", () => {
    expect(canUseActivityAsWameethSource({
      teacherId: 42,
      isShared: false,
      hiddenByAdmin: true,
      accessMode: "private",
    }, 42)).toBe(true);
  });

  it("accepts only a visibly published library activity for another teacher", () => {
    expect(canUseActivityAsWameethSource({
      teacherId: 7,
      isShared: true,
      hiddenByAdmin: false,
      accessMode: "public",
    }, 42)).toBe(true);
  });

  it.each([
    ["not shared", { isShared: false, hiddenByAdmin: false, accessMode: "public" }],
    ["hidden by moderation", { isShared: true, hiddenByAdmin: true, accessMode: "public" }],
    ["private", { isShared: true, hiddenByAdmin: false, accessMode: "private" }],
  ])("rejects a foreign activity that is %s", (_reason, activity) => {
    expect(canUseActivityAsWameethSource({ teacherId: 7, ...activity }, 42)).toBe(false);
  });

  it("requires importing only a valid foreign library activity for live modes", () => {
    const visibleLibraryActivity = {
      teacherId: 7,
      isShared: true,
      hiddenByAdmin: false,
      accessMode: "public",
    };

    expect(requiresImportedCopyForLiveWameeth(visibleLibraryActivity, 42)).toBe(true);
    expect(requiresImportedCopyForLiveWameeth({
      ...visibleLibraryActivity,
      teacherId: 42,
    }, 42)).toBe(false);
    expect(requiresImportedCopyForLiveWameeth({
      ...visibleLibraryActivity,
      hiddenByAdmin: true,
    }, 42)).toBe(false);
  });
});