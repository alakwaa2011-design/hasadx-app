// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuranBookmarkCategoryPicker } from "./quran-bookmark-category-picker";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));

afterEach(cleanup);

describe("QuranBookmarkCategoryPicker", () => {
  it("shows all specialized bookmark types and saves the selected type", () => {
    const onSelect = vi.fn();
    render(
      <QuranBookmarkCategoryPicker
        selectedCategory="review"
        onSelect={onSelect}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("توقفت هنا")).toBeTruthy();
    expect(screen.getByText("تحتاج مراجعة")).toBeTruthy();
    expect(screen.getByText("متشابهة")).toBeTruthy();
    expect(screen.getByText("خطأ متكرر")).toBeTruthy();
    expect(screen.getByText("سؤال للمعلم")).toBeTruthy();

    fireEvent.click(screen.getByTestId("bookmark-category-similar"));
    expect(onSelect).toHaveBeenCalledWith("similar");
  });
});