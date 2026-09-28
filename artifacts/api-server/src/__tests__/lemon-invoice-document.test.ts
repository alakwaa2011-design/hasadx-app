import { describe, expect, it, vi, afterEach } from "vitest";
import { identifyInvoicePlan, verifyLemonInvoiceDocument } from "../lib/lemon-invoice-document";
import { invoiceTestPdf } from "./fixtures/lemon-invoice-pdf";

const options = [
  { variantId: "monthly-pro", interval: "month", nameEn: "Pro", nameAr: "الاحترافي" },
  { variantId: "yearly-pro", interval: "year", nameEn: "Pro", nameAr: "الاحترافي" },
  { variantId: "monthly-basic", interval: "month", nameEn: "Basic", nameAr: "الأساسي" },
];
const url = "https://app.lemonsqueezy.com/my-orders/123/document?token=signed";

afterEach(() => vi.unstubAllGlobals());

describe("Lemon invoice PDF evidence", () => {
  it("accepts only an exact item name with an explicit matching interval", () => {
    expect(identifyInvoicePlan("Description Quantity Amount\nHasaad Pro - Monthly 1 $10.00\nSubtotal", options).variantId).toBe("monthly-pro");
    expect(identifyInvoicePlan("Description\nPro - Annual\nSubtotal", options).variantId).toBe("yearly-pro");
    for (const line of ["Pro Plus - Monthly", "Pro", "Pro - Monthly Yearly", "Basic - Monthly\nPro - Monthly"]) {
      expect(() => identifyInvoicePlan(`Description\n${line}\nSubtotal`, options)).toThrow();
    }
    expect(() => identifyInvoicePlan("Customer Pro - Monthly\nDescription\nUnrelated item\nSubtotal", options)).toThrow();
  });

  it("downloads and parses a PDF but rejects unreadable and unsafe documents", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(invoiceTestPdf("Hasaad Pro - Monthly 1 $10.00"), {
      headers: { "content-type": "application/pdf" },
    })));
    const result = await verifyLemonInvoiceDocument(url, options);
    expect(result.option.variantId).toBe("monthly-pro");
    expect(result.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => verifyLemonInvoiceDocument("https://evil.example/document", options)).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>login</html>")));
    await expect(verifyLemonInvoiceDocument(url, options)).rejects.toThrow("not a PDF");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(invoiceTestPdf("Unknown - Monthly"))));
    await expect(verifyLemonInvoiceDocument(url, options)).rejects.toThrow("no single readable");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(Buffer.from("%PDF-1.4\nbroken"))));
    await expect(verifyLemonInvoiceDocument(url, options)).rejects.toThrow("unreadable");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(invoiceTestPdf("Pro - Monthly"), {
      headers: { "content-length": String(3 * 1024 * 1024) },
    })));
    await expect(verifyLemonInvoiceDocument(url, options)).rejects.toThrow("too large");
  });
});