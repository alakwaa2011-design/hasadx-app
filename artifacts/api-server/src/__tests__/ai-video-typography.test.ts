import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mocks = vi.hoisted(() => {
  const request = {
    url: vi.fn(() => "https://example.invalid/tracker"),
    abort: vi.fn(async () => {}),
    continue: vi.fn(async () => {}),
  };
  const page = {
    close: vi.fn(async () => {}),
    evaluate: vi.fn(async () => true),
    on: vi.fn((event: string, handler: (request: any) => void) => {
      if (event === "request") handler(request);
    }),
    screenshot: vi.fn(async () => {}),
    setContent: vi.fn(async (_html: string, _options?: unknown) => {}),
    setRequestInterception: vi.fn(async () => {}),
    setViewport: vi.fn(async () => {}),
  };
  const browser = {
    close: vi.fn(async () => {}),
    newPage: vi.fn(async () => page),
  };
  return {
    browser,
    launch: vi.fn(async () => browser),
    page,
    request,
  };
});

vi.mock("puppeteer-core", () => ({
  default: { launch: mocks.launch },
}));

import { renderAiVideoTerm } from "../lib/ai-video-typography";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUPPETEER_EXECUTABLE_PATH = "/bin/sh";
  mocks.request.url.mockReturnValue("https://example.invalid/tracker");
  mocks.page.evaluate.mockResolvedValue(true);
  mocks.page.on.mockImplementation((event, handler) => {
    if (event === "request") handler(mocks.request);
    return mocks.page;
  });
});

describe("AI video typography", () => {
  it("ships the reviewed upstream Cairo font and its OFL 1.1 license", async () => {
    const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data/fonts");
    const [font, license] = await Promise.all([
      readFile(resolve(dataDir, "Cairo-Variable.ttf")),
      readFile(resolve(dataDir, "licenses/Cairo-OFL.txt"), "utf8"),
    ]);

    expect(font.subarray(0, 4).toString("hex")).toBe("00010000");
    expect(createHash("sha256").update(font).digest("hex"))
      .toBe("667c987182391c91f4e57a2f455b1794fb5e3ee6ca4ef3383e86bb690fa9c964");
    expect(license).toContain(
      "Copyright 2009 The Cairo Project Authors (https://github.com/Gue3bara/Cairo)",
    );
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("renders escaped Arabic with the bundled Cairo font and no network access", async () => {
    await renderAiVideoTerm({
      text: '  دورة الماء <img src="https://bad.invalid/x">  ',
      language: "ar",
      width: 720,
      height: 1280,
      outputPath: "/tmp/arabic-term.png",
    });

    const html = mocks.page.setContent.mock.calls[0]?.[0] as string;
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("font-family: \"Cairo Video\"");
    expect(html).toContain("data:font/ttf;base64,");
    expect(html).toContain("دورة الماء &lt;img src=&quot;https://bad.invalid/x&quot;&gt;");
    expect(html).not.toContain('<img src="https://bad.invalid/x">');
    expect(mocks.request.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(mocks.page.setViewport).toHaveBeenCalledWith({
      width: 720,
      height: 1280,
      deviceScaleFactor: 1,
    });
    expect(mocks.page.screenshot).toHaveBeenCalledWith(expect.objectContaining({
      path: "/tmp/arabic-term.png",
      type: "png",
      omitBackground: true,
      captureBeyondViewport: false,
    }));
    expect(mocks.page.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("rejects narration-sized text before launching Chromium", async () => {
    await expect(renderAiVideoTerm({
      text: "one two three four five six seven eight",
      language: "en",
      width: 1280,
      height: 720,
      outputPath: "/tmp/too-long.png",
    })).rejects.toThrow("cannot exceed 7 words");

    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it("closes the page and owned browser when font verification fails", async () => {
    mocks.page.evaluate.mockResolvedValueOnce(false);

    await expect(renderAiVideoTerm({
      text: "Photosynthesis",
      language: "en",
      width: 720,
      height: 720,
      outputPath: "/tmp/english-term.png",
    })).rejects.toThrow("Bundled Cairo font failed to load");

    expect(mocks.page.screenshot).not.toHaveBeenCalled();
    expect(mocks.page.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });
});