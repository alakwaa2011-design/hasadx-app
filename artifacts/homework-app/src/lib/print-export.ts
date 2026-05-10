// Lightweight export helpers for the teacher's printable surfaces
// (worksheets, lesson plans). Word export is implemented as
// "HTML wrapped in MS-Word MIME headers, downloaded as .doc" which is a
// long-standing technique that requires zero runtime dependencies and
// preserves the brand's CSS styling, RTL layout, gold/green colors,
// dashed borders, and watermark gradient. Word opens the resulting file
// natively and respects the embedded @page A4 setup.

export interface WordExportOptions {
  /** The DOM element whose HTML should be exported. */
  element: HTMLElement;
  /** Title used both as the file name and the Word document title. */
  title: string;
  /** Optional language attribute for the body — affects Word's text direction. */
  lang?: "ar" | "en";
}

/**
 * Trigger a `.doc` download containing the rendered HTML of `element`,
 * wrapped with the headers Microsoft Word recognises so it opens with
 * full A4 page setup, the same CSS, and full RTL/LTR direction.
 */
export function downloadAsWord({ element, title, lang = "ar" }: WordExportOptions): void {
  // Serialize the element (outerHTML preserves classes the page CSS hooks into).
  const bodyHtml = element.outerHTML;

  // Collect every <style> block on the page so the embedded CSS travels
  // with the document. Without this, Word would render unstyled HTML.
  const styles = Array.from(document.querySelectorAll("style"))
    .map(s => s.innerHTML)
    .join("\n");

  // Pull the same Google Fonts the print page uses so Arabic + Latin
  // rendering matches the on-screen preview as closely as Word allows.
  const fontImport =
    "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');";

  // Word-only @page size + portrait + small margins. The print CSS uses
  // `@page { size: A4; margin: 0 }` but Word ignores margin:0, so we set
  // a sensible non-zero margin for the .doc render.
  //
  // The on-screen print pages (`.ws-page`, `.lp-page`) are sized at a
  // fixed 210mm width so they look like a real A4 sheet in the browser.
  // Word's printable area inside our 12/10mm margins is only ~190mm, so
  // forcing those pages to `width: auto` and stripping the screen-only
  // chrome (shadow, rounded corners, page-fill min-height) is what keeps
  // the document from overflowing the page or scaling unexpectedly.
  const wordPageCss = `
    @page WordSection1 {
      size: 210mm 297mm;
      mso-page-orientation: portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    div.WordSection1 { page: WordSection1; }
    body { font-family: 'Cairo','Inter',Arial,sans-serif; background: white !important; margin: 0; padding: 0; }
    /* Neutralize fixed page width / on-screen chrome inside Word so the
       printable content sits inside Word's actual margin box. */
    .WordSection1 .ws-page,
    .WordSection1 .lp-page {
      width: auto !important;
      max-width: 100% !important;
      min-height: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    /* The wrapper hosts (the elements we serialize) include screen-only
       gray padding — drop it so Word treats them as transparent. */
    .WordSection1 #ws-printable-root,
    .WordSection1 #lp-printable-root {
      background: white !important;
      padding: 0 !important;
      min-height: 0 !important;
      display: block !important;
    }
  `;

  const dir = lang === "ar" ? "rtl" : "ltr";

  // The xmlns:o / xmlns:w / xmlns:m attributes are what tell Word "this
  // is really a Word document, not just HTML in disguise". Without them
  // Word still opens the file but treats it as plain HTML and ignores
  // @page / WordSection1.
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="${lang}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>${escapeHtml(title)}</title>
    <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
    <![endif]-->
    <style>
      ${fontImport}
      ${wordPageCss}
      ${styles}
    </style>
  </head>
  <body dir="${dir}">
    <div class="WordSection1">
      ${bodyHtml}
    </div>
  </body>
</html>`;

  const blob = new Blob(
    ["\ufeff", html], // BOM helps Word detect UTF-8 reliably for Arabic.
    { type: "application/msword" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Trigger the browser's print dialog. The print stylesheet on the page
 * already enforces `@page { size: A4; margin: 0 }` so the dialog's
 * "Save as PDF" produces a true A4 PDF.
 */
export function printToPdf(): void {
  window.print();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFilename(s: string): string {
  // Allow Arabic/Latin letters, digits, spaces, dashes, underscores;
  // collapse anything else to a single dash.
  const cleaned = s
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "document";
}
