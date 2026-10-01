import { describe, expect, it } from "vitest";
import {
  isAllowedWorksheetRenderRequest,
  renderWorksheetPage,
} from "../lib/worksheet-page-render";

describe("worksheet-page-render resource fence", () => {
  it("allows only embedded assets and exact HTTPS Google Fonts stylesheet/font origins", () => {
    expect(isAllowedWorksheetRenderRequest("data:image/png;base64,AA==", "image")).toBe(true);
    expect(isAllowedWorksheetRenderRequest("data:text/html,unsafe", "document")).toBe(false);
    expect(
      isAllowedWorksheetRenderRequest(
        "https://fonts.googleapis.com/css2?family=Cairo",
        "stylesheet",
      ),
    ).toBe(true);
    expect(
      isAllowedWorksheetRenderRequest("https://fonts.gstatic.com/font.woff2", "font"),
    ).toBe(true);
    expect(
      isAllowedWorksheetRenderRequest("https://fonts.googleapis.com.evil.test/a.css", "stylesheet"),
    ).toBe(false);
    expect(
      isAllowedWorksheetRenderRequest("https://fonts.googleapis.com:443/a.css", "stylesheet"),
    ).toBe(false);
    expect(
      isAllowedWorksheetRenderRequest("https://user@fonts.googleapis.com/a.css", "stylesheet"),
    ).toBe(false);
    expect(
      isAllowedWorksheetRenderRequest("http://fonts.googleapis.com/a.css", "stylesheet"),
    ).toBe(false);
    expect(
      isAllowedWorksheetRenderRequest("https://example.test/image.png", "image"),
    ).toBe(false);
  });

  it("renders Arabic text through real Chromium into a 2x PNG", async () => {
    const png = await renderWorksheetPage(
      '<h1 dir="rtl" style="font:700 32px Cairo,Tajawal,sans-serif">ورقة عمل عربية</h1>',
      600,
      240,
    );
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(480);
  }, 45_000);

  it("aborts a submitted external image request instead of fetching it", async () => {
    await expect(
      renderWorksheetPage('<img src="http://127.0.0.1:9/private.png">', 400, 200),
    ).rejects.toMatchObject({
      name: "WorksheetPageRenderError",
      statusCode: 422,
    });
  }, 45_000);

  it("does not execute scripts from submitted markup", async () => {
    const png = await renderWorksheetPage(
      `<script>document.body.innerHTML = '<img src="http://127.0.0.1:9/private.png">'</script><h1>آمن</h1>`,
      400,
      200,
    );
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }, 45_000);
});