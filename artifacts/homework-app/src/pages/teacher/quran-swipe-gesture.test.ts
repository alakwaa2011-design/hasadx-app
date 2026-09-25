import { describe, expect, it } from "vitest";
import { pageSwipeDirection, swipeAxis } from "./quran-swipe-gesture";

describe("Mushaf page swipes", () => {
  it("ignores taps and keeps a vertical scroll from becoming a page turn", () => {
    expect(swipeAxis(5, 4)).toBeNull();
    expect(swipeAxis(12, 65)).toBe("vertical");
    expect(pageSwipeDirection(100, 65, 160, "vertical")).toBeNull();
    expect(pageSwipeDirection(65, 70, 160, "horizontal")).toBeNull();
  });

  it("turns in both physical directions with a comfortable drag", () => {
    expect(pageSwipeDirection(52, 3, 500, swipeAxis(52, 3))).toBe("next");
    expect(pageSwipeDirection(-52, -3, 500, swipeAxis(-52, -3))).toBe("previous");
  });

  it("accepts a short deliberate flick but not a small accidental motion", () => {
    expect(pageSwipeDirection(-32, 2, 75, swipeAxis(-32, 2))).toBe("previous");
    expect(pageSwipeDirection(32, 2, 300, swipeAxis(32, 2))).toBeNull();
    expect(pageSwipeDirection(20, 2, 30, swipeAxis(20, 2))).toBeNull();
  });
});