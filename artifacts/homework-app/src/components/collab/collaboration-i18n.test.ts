import { describe, expect, it } from "vitest";
import { collaborationText } from "./collaboration-i18n";

describe("collaborationText", () => {
  it("translates fixed labels and dynamic counts", () => {
    expect(collaborationText("إعدادات اللوحة", "en")).toBe("Board settings");
    expect(collaborationText("المشاركون (4)", "en")).toBe("Participants (4)");
    expect(collaborationText("مراجعة المشاركات (2)", "en")).toBe("Review posts (2)");
  });

  it("translates collaboration errors without changing user-authored content", () => {
    expect(collaborationText("لم نجد لوحة بهذا الكود.", "en")).toBe("No board was found with this code.");
    const teacherTitle = "ماذا تعلمت اليوم؟";
    expect(collaborationText(teacherTitle, "en")).toBe(teacherTitle);
  });

  it("keeps Arabic strings in Arabic mode", () => {
    expect(collaborationText("إعدادات اللوحة", "ar")).toBe("إعدادات اللوحة");
  });
});
