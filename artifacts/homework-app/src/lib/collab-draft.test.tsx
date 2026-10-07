import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { draftKey, readDraft, removeDraft, useParticipationDraft, writeDraft, type ParticipationDraft } from "./collab-draft";

const initial: ParticipationDraft = {
  text: "", columnId: "main", color: "mint", tags: "", referenceUrl: "",
  imageId: null, thumbnail: null, clientId: "stable-request",
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe("collaboration drafts", () => {
  it("isolates board, participant and edit drafts", () => {
    const k = draftKey("b", "student-a");
    writeDraft(k, { ...initial, text: "private" });
    expect(readDraft(draftKey("b", "student-b")).draft).toBeUndefined();
    expect(readDraft(draftKey("other", "student-a")).draft).toBeUndefined();
    expect(readDraft(draftKey("b", "student-a", "post")).draft).toBeUndefined();
    expect(readDraft(k).draft?.text).toBe("private");
  });
  it("persists final input synchronously and restores all fields after unmount", () => {
    const k = draftKey("sync", "student");
    const { result, unmount } = renderHook(() => useParticipationDraft(k, initial));
    act(() => { result.current.update({ text: "last input", tags: "تعلم", referenceUrl: "https://example.com", color: "sky", columnId: "second", imageId: "image", thumbnail: "data:image/jpeg;base64,YQ==" }); });
    expect(JSON.parse(localStorage.getItem(k)!)).toMatchObject({ text: "last input", clientId: "stable-request" });
    unmount();
    const restored = renderHook(() => useParticipationDraft(k, { ...initial, clientId: "new-request" }));
    expect(restored.result.current.restored).toBe(true);
    expect(restored.result.current.persistent).toBe(true);
    expect(restored.result.current.draft).toMatchObject({ text: "last input", tags: "تعلم", imageId: "image", columnId: "second", clientId: "stable-request" });
  });
  it("never claims persistent saving when storage fails; latest temporary input wins", () => {
    const k = draftKey("blocked", "student");
    writeDraft(k, { ...initial, text: "old" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota exceeded"); });
    expect(writeDraft(k, { ...initial, text: "latest" })).toBe(false);
    expect(readDraft(k)).toMatchObject({ persistent: false, draft: { text: "latest" } });
  });
  it("ignores malformed persisted records and clears confirmed/discarded drafts", () => {
    const k = draftKey("clear", "student");
    localStorage.setItem(k, JSON.stringify({ text: "invalid" }));
    expect(readDraft(k).draft).toBeUndefined();
    writeDraft(k, { ...initial, text: "valid" });
    expect(removeDraft(k)).toBe(true);
    expect(readDraft(k).draft).toBeUndefined();
  });
});
