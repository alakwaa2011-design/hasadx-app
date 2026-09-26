// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { copyMock, successMock, errorMock } = vi.hoisted(() => ({
  copyMock: vi.fn().mockResolvedValue(undefined),
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/teacher/quran/mushaf", vi.fn()] }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "ar" }) }));
vi.mock("sonner", () => ({ toast: { success: successMock, error: errorMock } }));
vi.mock("@workspace/api-client-react", () => ({
  useGetCurrentTeacher: () => ({ data: { id: 1 }, isLoading: false }),
  useListQuranSurahs: () => ({ data: [] }),
}));
vi.mock("@/components/quran/use-quran-reader-state", () => ({
  useQuranReaderState: () => ({ readerState: null, isReaderStateLoading: false }),
}));
vi.mock("@/components/layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("./quran-pages-view", () => ({ QuranPagesView: () => <div data-testid="teacher-mushaf" /> }));
vi.mock("./quran-center/quran-circles", () => ({ QuranCircles: () => null }));
vi.mock("./quran-center/quran-review-queue", () => ({ QuranReviewQueue: () => null }));
vi.mock("./quran-center/quran-smart-review", () => ({ QuranSmartReview: () => null }));
vi.mock("@/components/quran/quran-bookmarks-panel", () => ({ QuranBookmarksPanel: () => null }));

import QuranCenter from "./quran-center";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("teacher Mushaf install link", () => {
  it("shows the public Quran installation URL and copies that same URL", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copyMock },
    });
    render(<QuranCenter embedded selectedTab="mushaf" />);

    const link = screen.getByTestId("link-standalone-quran") as HTMLAnchorElement;
    expect(screen.getByTestId("teacher-mushaf")).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/quran?install=1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toBe(`${window.location.origin}/quran`);

    fireEvent.click(screen.getByTestId("button-copy-quran-install-link"));
    await waitFor(() => expect(copyMock).toHaveBeenCalledWith(`${window.location.origin}/quran`));
    expect(successMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("teacher-quran-install-link")).toBeNull());
  });

  it("keeps the link visible when copying fails", async () => {
    copyMock.mockRejectedValueOnce(new Error("Clipboard unavailable"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copyMock },
    });
    render(<QuranCenter embedded selectedTab="mushaf" />);

    fireEvent.click(screen.getByTestId("button-copy-quran-install-link"));

    await waitFor(() => expect(errorMock).toHaveBeenCalled());
    expect(screen.getByTestId("teacher-quran-install-link")).toBeTruthy();
  });
});