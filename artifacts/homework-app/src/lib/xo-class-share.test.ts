import { describe, expect, it } from "vitest";
import { decodeXoClassSetup, encodeXoClassSetup, type XoClassSetup } from "./xo-class-share";

describe("XO classroom share links", () => {
  it("preserves Arabic questions and game settings", () => {
    const setup: XoClassSetup = {
      title: "مراجعة الدرس",
      teamX: "الفريق الأول",
      teamO: "الفريق الثاني",
      duration: 20,
      questions: [
        {
          text: "ما عاصمة الكويت؟",
          options: ["مدينة الكويت", "الجهراء", "حولي", "الفروانية"],
          correct: 0,
        },
      ],
    };

    expect(decodeXoClassSetup(encodeXoClassSetup(setup))).toEqual(setup);
  });

  it("rejects invalid shared data", () => {
    expect(decodeXoClassSetup("not-valid-base64")).toBeNull();
  });
});