import { createHash } from "node:crypto";

export type InvoicePlanOption = {
  variantId: string;
  interval: string;
  nameAr: string;
  nameEn: string;
};

export class InvoiceDocumentError extends Error {}

const MAX_PDF_BYTES = 2 * 1024 * 1024;
const ITEM_HEADER = /\b(description|item|product)\b|(?:الوصف|المنتج|الصنف)/i;
const ITEM_END = /\b(subtotal|total|tax|discount|amount due)\b|(?:الإجمالي|الضريبة|الخصم)/i;
const MONTH = /\b(monthly|month|per month|mo)\b|(?:شهري(?:ة|اً)?|شهر(?:يا|ي)?)/gi;
const YEAR = /\b(yearly|annual|annually|year|per year|yr)\b|(?:سنوي(?:ة|اً)?|سنويا|عام)/gi;

function normalized(value: string): string {
  return value.normalize("NFKC").toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}

/** Only an unambiguous invoice item line may supply a plan, never arbitrary text
 * elsewhere on the page (customer details, totals, footers, or a disclaimer). */
export function identifyInvoicePlan(text: string, options: InvoicePlanOption[]): InvoicePlanOption {
  const lines = text.split(/\r?\n/).map(normalized).filter(Boolean);
  const candidates: InvoicePlanOption[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!ITEM_HEADER.test(lines[i]) || ITEM_END.test(lines[i])) continue;
    for (const line of lines.slice(i + 1, i + 9)) {
      if (ITEM_END.test(line)) break;
      const monthly = [...line.matchAll(MONTH)].length > 0;
      const yearly = [...line.matchAll(YEAR)].length > 0;
      if (monthly === yearly) continue;
      // Strip only known invoice-item decorations. An unknown extra product
      // word (e.g. "Pro Plus") must not silently become the "Pro" plan.
      const item = line.replace(MONTH, " ").replace(YEAR, " ")
        .replace(/\b(?:hasaad|plan|subscription|qty|quantity|x)\b|(?:حصاد|باقة|اشتراك)/gi, " ")
        .replace(/\b\d+\s*[×x]\s*/gi, " ")
        .replace(/(?:[$€£]\s*[\d,.]+|[\d,.]+\s*(?:usd|eur|gbp))\b/gi, " ")
        .replace(/[\s()[\]{}:;.,|/\\–—-]+/g, " ").trim();
      // Lemon may print the quantity as a separate final column on the same
      // extracted line. Check both forms so numbered plan names remain
      // distinguishable; ambiguous matches are rejected below.
      const names = [item, item.replace(/\s+\d{1,3}$/, "")];
      const matches = options.filter(o => o.interval === (monthly ? "month" : "year")
        && [o.nameEn, o.nameAr].some(name => names.includes(normalized(name))));
      if (matches.length) candidates.push(...matches);
    }
  }
  if (candidates.length !== 1) throw new InvoiceDocumentError("invoice PDF has no single readable plan and billing interval item");
  return candidates[0];
}

/** Download only the exact provider URL, without redirects or credentials.
 * The PDF is used transiently and its bytes (not its signed URL) are audited. */
export async function verifyLemonInvoiceDocument(url: string, options: InvoicePlanOption[]) {
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); }
  catch { throw new InvoiceDocumentError("invalid provider invoice PDF URL"); }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "app.lemonsqueezy.com"
    || parsedUrl.port || parsedUrl.username || parsedUrl.password) {
    throw new InvoiceDocumentError("invalid provider invoice PDF origin");
  }
  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  } catch { throw new InvoiceDocumentError("provider invoice PDF download failed"); }
  if (!response.ok || !response.body) throw new InvoiceDocumentError("provider invoice PDF unavailable");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PDF_BYTES) {
    await response.body.cancel();
    throw new InvoiceDocumentError("provider invoice PDF too large");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PDF_BYTES) throw new InvoiceDocumentError("provider invoice PDF too large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof InvoiceDocumentError) throw error;
    throw new InvoiceDocumentError("provider invoice PDF download incomplete");
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new InvoiceDocumentError("provider invoice document is not a PDF");
  }
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  let text: string;
  try {
    const result = await parser.getText();
    if (result.total !== 1) throw new InvoiceDocumentError("invoice PDF has an unexpected page count");
    text = result.text;
  } catch {
    throw new InvoiceDocumentError("provider invoice PDF is unreadable");
  } finally { await parser.destroy(); }
  return {
    option: identifyInvoicePlan(text, options),
    documentSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}