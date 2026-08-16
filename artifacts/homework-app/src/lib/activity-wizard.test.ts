import { describe, it, expect } from "vitest";
import {
  getPublishBlockReason,
  hasAtLeastOneQuestion,
  PUBLISH_BLOCK_MESSAGES_AR,
  PUBLISH_BLOCK_MESSAGES_EN,
} from "./activity-wizard";
import { TEMPLATES } from "./activity-templates";

describe("getPublishBlockReason", () => {
  it("blocks when title is empty or whitespace", () => {
    expect(getPublishBlockReason("", [{ text: "س1" }], false)).toBe("no_title");
    expect(getPublishBlockReason("   ", [{ text: "س1" }], false)).toBe("no_title");
  });

  it("blocks when there are no questions with text", () => {
    expect(getPublishBlockReason("نشاط", [], false)).toBe("no_question");
    expect(getPublishBlockReason("نشاط", [{ text: "" }, { text: "  " }], false)).toBe("no_question");
  });

  it("blocks when some questions are empty", () => {
    expect(getPublishBlockReason("نشاط", [{ text: "س1" }, { text: "" }], false)).toBe("empty_question");
  });

  it("allows publish with title and non-empty questions", () => {
    expect(getPublishBlockReason("نشاط", [{ text: "س1" }], false)).toBeNull();
  });

  it("paper mode only requires a title", () => {
    expect(getPublishBlockReason("نشاط ورقي", [], true)).toBeNull();
    expect(getPublishBlockReason("", [], true)).toBe("no_title");
  });
});

describe("hasAtLeastOneQuestion", () => {
  it("is false with no questions or empty text", () => {
    expect(hasAtLeastOneQuestion([], false)).toBe(false);
    expect(hasAtLeastOneQuestion([{ text: " " }], false)).toBe(false);
  });
  it("is true with one real question", () => {
    expect(hasAtLeastOneQuestion([{ text: "" }, { text: "س" }], false)).toBe(true);
  });
  it("is always true in paper mode", () => {
    expect(hasAtLeastOneQuestion([], true)).toBe(true);
  });
});

describe("block messages", () => {
  it("has an AR and EN message for every reason", () => {
    for (const key of ["no_title", "no_question", "empty_question"] as const) {
      expect(PUBLISH_BLOCK_MESSAGES_AR[key]).toBeTruthy();
      expect(PUBLISH_BLOCK_MESSAGES_EN[key]).toBeTruthy();
    }
  });
  it("no_question message asks for at least one question", () => {
    expect(PUBLISH_BLOCK_MESSAGES_AR.no_question).toContain("سؤالاً واحداً على الأقل");
  });
});

describe("activity templates", () => {
  it("has unique ids and unique Arabic titles (no duplicated اختبار قصير)", () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const titles = TEMPLATES.map(t => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("renamed shorttest to اختبار مؤقت / Timed Test", () => {
    const shorttest = TEMPLATES.find(t => t.id === "shorttest");
    expect(shorttest?.title).toBe("اختبار مؤقت");
    expect(shorttest?.titleEn).toBe("Timed Test");
  });

  it("scratch template uses نشاط wording", () => {
    const scratch = TEMPLATES.find(t => t.id === "scratch");
    expect(scratch?.title).toContain("نشاط");
  });
});
