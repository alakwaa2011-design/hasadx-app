import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findWebImage,
  isUsefulPresentationImage,
  normalizePresentationImageQuery,
} from "../lib/web-image-search";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("presentation web image quality", () => {
  it("removes search modifiers that make Commons return scanned documents", () => {
    expect(
      normalizePresentationImageQuery(
        "water cycle complete diagram illustration Arabic labels high resolution",
      ),
    ).toBe("water cycle diagram");
  });

  it("rejects scanned PDF and book-page results", () => {
    expect(
      isUsefulPresentationImage(
        "https://upload.wikimedia.org/wikipedia/commons/a/a1/Book.pdf/page1-960px-Book.pdf.jpg",
        "Illustrated history of water",
      ),
    ).toBe(false);
    expect(
      isUsefulPresentationImage(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Water_cycle.png/960px-Water_cycle.png",
        "Water cycle",
      ),
    ).toBe(true);
    expect(
      isUsefulPresentationImage(
        "https://upload.wikimedia.org/a/water-cycle-blank.svg",
        "Water Cycle - blank",
      ),
    ).toBe(false);
    expect(
      isUsefulPresentationImage(
        "https://upload.wikimedia.org/a/water-cycle-blank.svg",
        "Water Cycle",
      ),
    ).toBe(false);
  });

  it("identifies the Wikimedia client and skips a scanned result", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            "1": {
              title: "Illustrated history of water",
              imageinfo: [{
                thumburl: "https://upload.wikimedia.org/a/book.pdf/page1-book.pdf.jpg",
              }],
            },
            "2": {
              title: "Water cycle diagram",
              imageinfo: [{
                thumburl: "https://upload.wikimedia.org/a/water-cycle.png",
              }],
            },
          },
        },
      }),
    } as Response);

    const result = await findWebImage("water cycle labelled diagram", { timeoutMs: 1000 });
    expect(result?.title).toBe("Water cycle diagram");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("HasadX-Education"),
        }),
      }),
    );
  });

  it("prefers a relevant labelled diagram over a blank template", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            "1": {
              title: "File:Water Cycle - blank.svg",
              imageinfo: [{ thumburl: "https://upload.wikimedia.org/a/blank.png" }],
            },
            "2": {
              title: "File:Water Cycle Diagram.jpeg",
              imageinfo: [{ thumburl: "https://upload.wikimedia.org/a/diagram.jpg" }],
            },
          },
        },
      }),
    } as Response);

    const result = await findWebImage("water cycle diagram education", { timeoutMs: 1000 });
    expect(result?.title).toBe("Water Cycle Diagram");
  });

  it("ranks Brave results instead of accepting its first generic image", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "Generic water",
            properties: { url: "https://images.example/generic.jpg" },
          },
          {
            title: "Water Cycle Diagram",
            properties: { url: "https://images.example/cycle.jpg" },
          },
        ],
      }),
    } as Response);

    const result = await findWebImage("water cycle diagram brave", { timeoutMs: 1000 });
    expect(result?.title).toBe("Water Cycle Diagram");
    vi.unstubAllEnvs();
  });
});