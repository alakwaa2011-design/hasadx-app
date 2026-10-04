import { afterEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildWordDocument } from "./print-export";
import { inlineWordSvgImages } from "./word-svg-images";

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

async function xmlFor(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({ element: root, title: "تصميم", lang: "ar" })));
  return (await zip.file("word/document.xml")!.async("string"));
}

describe("editable Word design fidelity", () => {
  it("keeps each source page's padding, frame and separate page section", async () => {
    const xml = await xmlFor(`
      <div data-worksheet-page style="padding:4px;border:2px solid #123456">
        <div class="ws-content" style="padding:12px 20px"><h1>الصفحة الأولى</h1></div>
      </div>
      <div data-answer-key-page style="padding:10px"><p>الإجابات</p></div>`);
    expect(xml.match(/<w:sectPr>/g)).toHaveLength(2);
    expect(xml).toContain('w:top="240"');
    expect(xml).toContain('w:right="360"');
    expect(xml).toContain('w:top="150"');
    expect(xml).toContain('<w:pgBorders w:offsetFrom="page">');
    expect(xml).toContain('w:color="123456"');
    expect(xml).not.toContain('<w:br w:type="page"');
  });

  it("keeps decorative dividers even when they are aria-hidden in the browser", async () => {
    const xml = await xmlFor(`<div data-worksheet-page>
      <div class="ws-divider" aria-hidden="true"><span class="ws-divider-thick" style="background-color:#225739;height:2px"></span></div>
      <p>نص قابل للتعديل</p>
      <div class="ws-divider no-print">DO NOT EXPORT</div>
    </div>`);
    expect(xml).toContain('<w:pBdr>');
    expect(xml).toContain('w:color="225739"');
    expect(xml).toContain("نص قابل للتعديل");
    expect(xml).not.toContain("DO NOT EXPORT");
  });

  it("exports actual HTML tables with cell shading, borders and column spans", async () => {
    const xml = await xmlFor(`<div data-worksheet-page><table><tbody>
      <tr><td colspan="2" style="background-color:#fff1cc;border:1px solid #225739;padding:6px">عنوان الجدول</td></tr>
      <tr><td>الأول</td><td>الثاني</td></tr>
    </tbody></table></div>`);
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain('<w:gridSpan w:val="2"');
    expect(xml).toContain('w:fill="FFF1CC"');
    expect(xml).toContain("عنوان الجدول");
    expect(xml).toContain("<w:cantSplit");
    expect(xml).not.toContain("<w:drawing>");
  });

  it("uses the rendered paragraph line height instead of flattening every style", async () => {
    const xml = await xmlFor(`<div data-worksheet-page><p style="font-size:20px;line-height:30px">تباعد النص</p></div>`);
    expect(xml).toContain('w:line="360"');
  });

  it("embeds SVG shapes at higher resolution without rasterizing the surrounding text or maths", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    const root = document.createElement("div");
    root.innerHTML = `<p>النص يبقى قابلًا للتعديل</p>
      <svg style="width:80px;height:40px" viewBox="0 0 80 40"><rect width="80" height="40" style="fill:rgb(34,87,57)"/></svg>
      <div class="katex"><svg style="width:20px;height:20px"></svg></div>`;
    document.body.append(root);
    const clone = root.cloneNode(true) as HTMLElement;
    document.body.append(clone);
    const convert = vi.fn(async (blob: Blob) => {
      const svg = await blob.text();
      expect(svg).toContain('width="160"');
      expect(svg).toContain('viewBox="0 0 80 40"');
      return { blob: new NodeBlob(["image"]), mimeType: "image/png" };
    });
    await inlineWordSvgImages(root, clone, convert);
    expect(convert).toHaveBeenCalledTimes(1);
    expect(clone.querySelector("img")?.width).toBe(80);
    expect(clone.querySelector("img")?.height).toBe(40);
    expect(clone.querySelector(".katex svg")).not.toBeNull();
    expect(clone.querySelector("p")?.textContent).toBe("النص يبقى قابلًا للتعديل");
  });
});