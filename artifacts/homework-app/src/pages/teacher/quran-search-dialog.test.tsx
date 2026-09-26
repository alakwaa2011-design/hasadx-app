// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { QuranSearchDialog } from "./quran-search-dialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Quran search on mobile", () => {
  it("stops loading after a stalled request and can retry and select a verse", async () => {
    let stalled = true;
    const onSelect = vi.fn();
    vi.stubGlobal("fetch", vi.fn((url: string, options: { signal: AbortSignal }) => {
      if (stalled) {
        return new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      const data = url.includes("verses")
        ? [{ id: 1, chapter_id: 1, number: 1, page_id: 1, content: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" }]
        : [{ id: 1, name: "الفاتحة" }];
      return Promise.resolve({ ok: true, json: async () => data });
    }));

    vi.useFakeTimers();
    render(<I18nProvider><QuranSearchDialog onSelect={onSelect} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "البحث في القرآن" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.getByText("تعذر تحميل فهرس الآيات")).toBeTruthy();

    stalled = false;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.change(screen.getByPlaceholderText("اكتب كلمة مثل: الرحمن"), { target: { value: "الرحمن" } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("1 نتيجة")).toBeTruthy();
    fireEvent.click(screen.getByText("1 نتيجة").parentElement!.querySelector("button")!);
    expect(onSelect).toHaveBeenCalledWith({ chapterId: 1, ayah: 1, pageId: 1 });
  });
});