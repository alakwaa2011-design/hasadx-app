import { describe, expect, it } from "vitest";
import { detectUploadType } from "../lib/objectStorage";

describe("direct upload byte validation", () => {
  it("accepts permitted raster and document signatures", () => {
    expect(detectUploadType(Buffer.from("89504e470d0a1a0a", "hex"), "image/png")).toBe("image/png");
    expect(detectUploadType(Buffer.from("%PDF-1.7"), "application/pdf")).toBe("application/pdf");
    expect(detectUploadType(Buffer.from("d0cf11e0a1b11ae1", "hex"), "application/msword")).toBe("application/msword");
    expect(detectUploadType(Buffer.from("PK\u0003\u0004[Content_Types].xml"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
      .toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("rejects spoofed active content and MIME claims", () => {
    expect(detectUploadType(Buffer.from("<script>alert(1)</script>"), "text/plain")).toBeNull();
    expect(detectUploadType(Buffer.from("<svg onload=alert(1)>"), "image/png")).toBeNull();
    expect(detectUploadType(Buffer.from("not a PDF"), "application/pdf")).toBeNull();
  });
});