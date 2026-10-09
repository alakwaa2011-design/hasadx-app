/* Pulls the pictures a teacher already has inside an uploaded lesson file (PDF / DOCX / PPTX) so the
   generated deck can use the book's own figures instead of stock art. Best-effort by contract:
   every failure resolves to an empty list. */
import JSZip from "jszip";

export interface SourceImage {
  buffer: Buffer;
  contentType: "image/png" | "image/jpeg";
  extension: ".png" | ".jpg";
  /** 1-based page / slide number when the container exposes it, else the image's order. */
  position: number;
}

const MAX_IMAGES = 8;
const MIN_BYTES = 12 * 1024;
const MAX_BYTES = 6 * 1024 * 1024;

function kindOf(name: string): { contentType: SourceImage["contentType"]; extension: SourceImage["extension"] } | null {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return { contentType: "image/png", extension: ".png" };
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return { contentType: "image/jpeg", extension: ".jpg" };
  return null;
}

async function fromZip(buffer: Buffer, mediaDir: string): Promise<SourceImage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((n) => n.startsWith(mediaDir) && !zip.files[n].dir && kindOf(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const out: SourceImage[] = [];
  for (const name of names) {
    if (out.length >= MAX_IMAGES) break;
    const kind = kindOf(name)!;
    const buf = await zip.files[name].async("nodebuffer");
    if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) continue;
    out.push({ buffer: buf, ...kind, position: out.length + 1 });
  }
  return out;
}

async function fromPdf(buffer: Buffer): Promise<SourceImage[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const res = await parser.getImage({ imageThreshold: 160, imageBuffer: false, imageDataUrl: true });
    const out: SourceImage[] = [];
    for (const page of res.pages) {
      for (const img of page.images) {
        if (out.length >= MAX_IMAGES) return out;
        const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(img.dataUrl ?? "");
        if (!m) continue;
        const buf = Buffer.from(m[2], "base64");
        if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) continue;
        const isPng = m[1] === "png";
        out.push({
          buffer: buf,
          contentType: isPng ? "image/png" : "image/jpeg",
          extension: isPng ? ".png" : ".jpg",
          position: page.pageNumber,
        });
      }
    }
    return out;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function extractSourceImages(
  buffer: Buffer,
  kind: "pdf" | "docx" | "pptx" | string,
): Promise<SourceImage[]> {
  try {
    if (kind === "pdf") return await fromPdf(buffer);
    if (kind === "docx") return await fromZip(buffer, "word/media/");
    if (kind === "pptx") return await fromZip(buffer, "ppt/media/");
  } catch {
    /* fall through */
  }
  return [];
}
