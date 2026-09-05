import { afterEach, describe, expect, it, vi } from "vitest";
import { printToPdf } from "./print-export";

describe("printToPdf", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses the worksheet title as the suggested PDF filename", () => {
    vi.useFakeTimers();
    document.title = "منصة حصاد";
    let titleAtPrint = "";
    vi.spyOn(window, "print").mockImplementation(() => {
      titleAtPrint = document.title;
    });

    printToPdf("ورقة الكسور / الصف الخامس");

    expect(titleAtPrint).toBe("ورقة الكسور - الصف الخامس");
    vi.runAllTimers();
    expect(document.title).toBe("منصة حصاد");
  });
});