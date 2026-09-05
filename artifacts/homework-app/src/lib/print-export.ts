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

function prepareWordBody(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  // Word's HTML renderer does not reliably support CSS Grid. Convert only the
  // exported copy of two-column choices to a real table, preserving the source
  // DOM (and therefore browser/PDF rendering) unchanged.
  clone.querySelectorAll<HTMLOListElement>(".ws-mcq[data-choice-columns='2']").forEach(list => {
    const choices = Array.from(list.children);
    const table = document.createElement("table");
    table.className = "ws-mcq ws-mcq-word-table";
    table.setAttribute("dir", list.getAttribute("dir") ?? "auto");

    const body = document.createElement("tbody");
    for (let index = 0; index < choices.length; index += 2) {
      const row = document.createElement("tr");
      for (let column = 0; column < 2; column += 1) {
        const cell = document.createElement("td");
        cell.className = "ws-mcq-word-cell";
        const choice = choices[index + column];
        if (choice) cell.appendChild(choice.cloneNode(true));
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    table.appendChild(body);
    list.replaceWith(table);
  });

  return clone.outerHTML;
}

export function buildWordDocumentHtml({
  element,
  title,
  lang = "ar",
}: WordExportOptions): string {
  const bodyHtml = prepareWordBody(element);

  const styles = Array.from(document.querySelectorAll("style"))
    .map(s => s.innerHTML)
    .join("\n");

  const fontImport =
    "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');";

  const wordPageCss = `
    @page WordSection1 {
      size: 210mm 297mm;
      mso-page-orientation: portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    div.WordSection1 { page: WordSection1; }
    body { font-family: 'Cairo','Inter',Arial,sans-serif; background: white !important; margin: 0; padding: 0; }
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
    .WordSection1 #ws-printable-root,
    .WordSection1 #lp-printable-root {
      background: white !important;
      padding: 0 !important;
      min-height: 0 !important;
      display: block !important;
    }
    .WordSection1 .ws-mcq-word-table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }
    .WordSection1 .ws-mcq-word-cell {
      width: 50% !important;
      border: 0 !important;
      padding: 2mm 1.5mm !important;
      vertical-align: top !important;
    }
    .WordSection1 .ws-mcq-word-cell > li {
      display: block !important;
    }
  `;

  const dir = lang === "ar" ? "rtl" : "ltr";

  return `<!DOCTYPE html>
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
}

/**
 * Trigger a `.doc` download containing the rendered HTML of `element`,
 * wrapped with the headers Microsoft Word recognises so it opens with
 * full A4 page setup, the same CSS, and full RTL/LTR direction.
 */
export function downloadAsWord({ element, title, lang = "ar" }: WordExportOptions): void {
  const html = buildWordDocumentHtml({ element, title, lang });

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
export function printToPdf(title?: string): void {
  const previousTitle = document.title;
  if (title?.trim()) document.title = sanitizeFilename(title);

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };

  window.addEventListener("afterprint", restoreTitle, { once: true });
  try {
    window.print();
  } finally {
    // Chromium blocks until the dialog closes; other browsers may not emit
    // afterprint reliably, so keep a fallback without changing the PDF name.
    window.setTimeout(restoreTitle, 1000);
  }
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
