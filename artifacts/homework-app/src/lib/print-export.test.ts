import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWordDocumentHtml, printToPdf } from "./print-export";

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

describe("buildWordDocumentHtml", () => {
  it("preserves inline question formatting and converts two-column choices to an ordered table", () => {
    const root = document.createElement("div");
    root.id = "ws-printable-root";
    root.innerHTML = `
      <div data-worksheet-page>
        <div class="ws-q-prompt"><span style="font-size: 14pt; font-weight: 800; text-align: center;">السؤال الأول</span></div>
        <ol class="ws-mcq" data-choice-columns="2" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
          <li>الخيار الأول</li><li>الخيار الثاني</li><li>الخيار الثالث</li><li>الخيار الرابع</li>
        </ol>
      </div>`;

    const html = buildWordDocumentHtml({
      element: root,
      title: "ورقة عربية",
      lang: "ar",
    });
    const exported = new DOMParser().parseFromString(html, "text/html");
    const prompt = exported.querySelector(".ws-q-prompt span");
    const table = exported.querySelector(".ws-mcq-word-table");

    expect(exported.documentElement.dir).toBe("rtl");
    expect(prompt?.getAttribute("style")).toContain("font-size: 14pt");
    expect(prompt?.getAttribute("style")).toContain("font-weight: 800");
    expect(prompt?.getAttribute("style")).toContain("text-align: center");
    expect(table?.querySelectorAll("tr")).toHaveLength(2);
    expect(table?.querySelectorAll("td")).toHaveLength(4);
    expect(Array.from(table?.querySelectorAll("li") ?? []).map(choice => choice.textContent))
      .toEqual(["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"]);
    expect(root.querySelector(".ws-mcq-word-table")).toBeNull();
  });
});