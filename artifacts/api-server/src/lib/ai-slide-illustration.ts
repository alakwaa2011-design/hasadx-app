/* AI illustrations for v2 design decks.
   Cards whose imagePlan asks for an illustration or diagram get a picture drawn in the deck identity's
   own style (palette + drawing style) instead of a generic stock icon. At most MAX_PER_DECK pictures are
   made per build, in small parallel batches; every failure resolves to null so a slide never breaks —
   the layout then falls back to a web image or its built-in drawing. */

import { openai } from "@workspace/integrations-openai-ai-server";
import { designFor, type OutlineCard } from "@workspace/slide-templates";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const MAX_PER_DECK = 6;
const TIMEOUT_MS = 70_000;

const STYLE: Record<string, string> = {
  d_textbook: "warm friendly school-textbook illustration, soft shapes, gentle shading",
  d_lab: "clean scientific diagram style, precise lines, flat colour fills",
  d_modern: "bold minimal flat vector illustration with simple geometric shapes",
  d_kids: "cute playful children's cartoon illustration, rounded shapes, cheerful",
  d_academic: "refined classic editorial illustration, muted tones, elegant linework",
  d_nature: "soft flat botanical illustration, organic shapes, fresh greens",
  d_chalk: "white and pastel chalk line drawing as if sketched on a dark green blackboard",
};

function promptFor(query: string, themeKey: string): string {
  const d = designFor(themeKey);
  const palette = d ? d.accents.join(", ") : "teal, amber, blue";
  const style = STYLE[themeKey] ?? "clean flat educational illustration";
  return [
    `Educational illustration for a classroom slide showing: ${query}.`,
    `Style: ${style}. Colour palette: ${palette}.`,
    "One clear subject, centred, uncluttered, plain light background (or dark board for chalk style).",
    "Absolutely no text, letters, numbers, captions or watermark. No people's faces in close-up.",
    "Never depict prophets, messengers, angels, companions of the Prophet or any holy figure; show places, objects, light, nature or symbols instead. Avoid human figures altogether.",
  ].join(" ");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("illustration timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** One entry per card: the public URL of a generated picture, or null. */
export async function generateSlideIllustrations(cards: OutlineCard[], themeKey: string): Promise<(string | null)[]> {
  const out: (string | null)[] = cards.map(() => null);
  if (!designFor(themeKey)) return out;
  const wanted: number[] = [];
  cards.forEach((c, i) => {
    const plan = c.imagePlan;
    if (!plan || plan.placement === "none" || !plan.imageQuery) return;
    if (plan.mediaType !== "illustration" && plan.mediaType !== "diagram" && plan.mediaType !== "photo") return;
    if (c.kind === "interactive") return;
    wanted.push(i);
  });
  /* covers and hero slides first, then the rest in deck order */
  wanted.sort((a, b) => {
    const rank = (i: number) => (cards[i].kind === "title" || cards[i].kind === "visual-hero" ? 0 : 1);
    return rank(a) - rank(b) || a - b;
  });
  const picked = wanted.slice(0, MAX_PER_DECK);
  if (picked.length === 0) return out;

  const storage = new ObjectStorageService();
  const one = async (i: number): Promise<void> => {
    try {
      const res = await withTimeout(
        openai.images.generate({
          model: "gpt-image-1",
          prompt: promptFor(cards[i].imagePlan!.imageQuery!, themeKey),
          n: 1,
          size: "1024x1024",
          quality: "low",
        } as Parameters<typeof openai.images.generate>[0]),
        TIMEOUT_MS,
      );
      const b64 = (res as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
      if (!b64) return;
      out[i] = await storage.uploadBufferAsPublic({ buffer: Buffer.from(b64, "base64"), contentType: "image/png", extension: ".png" });
    } catch (err) {
      logger.warn({ err, slide: cards[i].index }, "Slide illustration failed; using fallback visual");
    }
  };
  const BATCH = 3;
  for (let k = 0; k < picked.length; k += BATCH) {
    await Promise.all(picked.slice(k, k + BATCH).map(one));
  }
  return out;
}

/** One picture drawn on demand (the editor's "draw me an image" button). Returns the stored public path or null. */
export async function drawIllustration(description: string, themeKey: string | null | undefined): Promise<string | null> {
  try {
    const res = await withTimeout(
      openai.images.generate({
        model: "gpt-image-1",
        prompt: promptFor(description, themeKey ?? "d_modern"),
        n: 1,
        size: "1024x1024",
        quality: "low",
      } as Parameters<typeof openai.images.generate>[0]),
      TIMEOUT_MS,
    );
    const b64 = (res as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
    if (!b64) return null;
    return await new ObjectStorageService().uploadBufferAsPublic({ buffer: Buffer.from(b64, "base64"), contentType: "image/png", extension: ".png" });
  } catch (err) {
    logger.warn({ err }, "On-demand illustration failed");
    return null;
  }
}
