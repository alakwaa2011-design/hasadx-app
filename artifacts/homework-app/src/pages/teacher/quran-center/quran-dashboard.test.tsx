import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const refetch = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetQuranTodayDashboard: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch,
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

import { QuranDashboard } from "./quran-dashboard";

describe("QuranDashboard request failure", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    refetch.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("shows an error state and lets the teacher retry instead of rendering a blank page", async () => {
    await act(async () => {
      root.render(<QuranDashboard surahs={[]} onNavigate={vi.fn()} />);
    });

    expect(container.textContent).toContain("تعذّر تحميل الرئيسية");
    const retryButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("إعادة المحاولة"));
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton?.click();
    });
    expect(refetch).toHaveBeenCalledOnce();
  });
});