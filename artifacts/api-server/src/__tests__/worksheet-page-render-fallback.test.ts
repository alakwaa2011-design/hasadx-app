import { beforeEach, describe, expect, it, vi } from "vitest";

const fallbackState = vi.hoisted(() => ({
  getWorksheetRenderBrowser: vi.fn(),
  launchWorksheetRenderFallbackBrowser: vi.fn(),
  fallbackBrowser: {} as Record<string, any>,
  page: {} as Record<string, any>,
}));

vi.mock("../lib/presentation-pdf", () => ({
  getWorksheetRenderBrowser: fallbackState.getWorksheetRenderBrowser,
  launchWorksheetRenderFallbackBrowser: fallbackState.launchWorksheetRenderFallbackBrowser,
}));

import { renderWorksheetPage } from "../lib/worksheet-page-render";

describe("worksheet renderer single-process fallback", () => {
  beforeEach(() => {
    fallbackState.page = {
      setJavaScriptEnabled: vi.fn(async () => {}),
      setViewport: vi.fn(async () => {}),
      setRequestInterception: vi.fn(async () => {}),
      on: vi.fn(),
      setContent: vi.fn(async () => {}),
      waitForFunction: vi.fn(async () => {}),
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ imageFailures: false, fontFailures: false }),
      $: vi.fn(async () => ({ screenshot: vi.fn(async () => Buffer.from("png")) })),
      close: vi.fn(async () => {}),
    };
    fallbackState.fallbackBrowser = {
      newPage: vi.fn(async () => fallbackState.page),
      close: vi.fn(async () => {}),
    };
    fallbackState.getWorksheetRenderBrowser.mockRejectedValue(
      new Error("Multiprocess Chromium unavailable"),
    );
    fallbackState.launchWorksheetRenderFallbackBrowser.mockResolvedValue(
      fallbackState.fallbackBrowser,
    );
  });

  it("uses and closes an isolated per-job browser without sharing PDF pages", async () => {
    const png = await renderWorksheetPage("<h1>معاينة</h1>", 400, 200);

    expect(png).toEqual(Buffer.from("png"));
    expect(fallbackState.getWorksheetRenderBrowser).toHaveBeenCalledOnce();
    expect(fallbackState.launchWorksheetRenderFallbackBrowser).toHaveBeenCalledOnce();
    expect(fallbackState.fallbackBrowser.newPage).toHaveBeenCalledOnce();
    expect(fallbackState.page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(fallbackState.fallbackBrowser.close).toHaveBeenCalledOnce();
  });
});