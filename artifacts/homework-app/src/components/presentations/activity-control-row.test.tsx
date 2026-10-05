import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActivityControlRow } from "./activity-control-row";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("ActivityControlRow", () => {
  it("keeps launch controls beside a wrapping title, without an expanding spacer", () => {
    const launch = vi.fn();
    render(
      <ActivityControlRow label="اذكر كلمات من مكروهات الصيام" detail="٢ سؤال جاهز">
        <Button onClick={launch}>فتح النشاط</Button>
      </ActivityControlRow>,
    );
    const title = screen.getByText("اذكر كلمات من مكروهات الصيام");
    expect(title.classList.contains("break-words")).toBe(true);
    expect(title.parentElement?.classList.contains("flex-1")).toBe(false);
    const controls = screen.getByRole("group", { name: "اذكر كلمات من مكروهات الصيام" });
    expect(controls.classList.contains("flex-wrap")).toBe(true);
    expect(controls.classList.contains("[&_button]:min-h-11")).toBe(true);
    expect(screen.getByText("٢ سؤال جاهز")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "فتح النشاط" }));
    expect(launch).toHaveBeenCalledOnce();
  });

  it("retains independent reveal, distribution and close actions for the active row", () => {
    const reveal = vi.fn();
    const distribution = vi.fn();
    const close = vi.fn();
    render(
      <ActivityControlRow label="عدد أبواب الجنة ٨" active>
        <Button aria-pressed onClick={distribution}>إخفاء التوزيع</Button>
        <Button aria-pressed={false} onClick={reveal}>كشف الإجابة</Button>
        <Button onClick={close}>إغلاق النشاط</Button>
      </ActivityControlRow>,
    );
    fireEvent.click(screen.getByRole("button", { name: "كشف الإجابة" }));
    fireEvent.click(screen.getByRole("button", { name: "إخفاء التوزيع" }));
    fireEvent.click(screen.getByRole("button", { name: "إغلاق النشاط" }));
    expect(reveal).toHaveBeenCalledOnce();
    expect(distribution).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "إخفاء التوزيع" }).getAttribute("aria-pressed")).toBe("true");
  });
});
