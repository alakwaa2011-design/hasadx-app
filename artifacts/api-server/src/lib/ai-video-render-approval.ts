import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  aiVideoBriefSchema, aiVideoStoryboardSchema, requireRenderableDialogueStoryboard,
  sanitizeStoryboard,
} from "./ai-video-schemas";

// Published 1080p native-audio price, verified against the model API page.
// This is an estimate, never a claim that an invoice has been verified.
export const AI_VIDEO_PRICE_VERSION = "veo3.1-native-1080p-2026-09-08";
export const AI_VIDEO_PRICE_PER_SECOND_USD = 0.40;
export const AI_VIDEO_PRICE_SOURCE = "https://fal.ai/models/fal-ai/veo3.1/api";
export const aiVideoRenderConsentSchema = z.object({
  quoteId: z.string().uuid(),
  accepted: z.literal(true),
  maxProviderCostUsd: z.number().finite().nonnegative(),
}).strict();

export const aiVideoRenderQuoteSchema = z.object({
  id: z.string().uuid(),
  projectId: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(),
  model: z.literal("fal-ai/veo3.1"),
  currency: z.literal("USD"),
  generatedSeconds: z.number().int().positive(),
  sceneCount: z.number().int().positive(),
  providerCostUsd: z.number().nonnegative(),
  additionalProviderCostUsd: z.literal(0),
  totalEstimatedUsd: z.number().nonnegative(),
  platformCredits: z.number().int().nonnegative(),
  pricingVersion: z.literal(AI_VIDEO_PRICE_VERSION),
  priceSource: z.literal(AI_VIDEO_PRICE_SOURCE),
  requiresManualReview: z.literal(true),
});
export type AiVideoRenderQuote = z.infer<typeof aiVideoRenderQuoteSchema>;
type RenderContent = { id: number; brief: unknown; storyboard: unknown };

/** Full saved content (including edits/version/settings), not just duration. */
export function aiVideoRenderContentHash(project: RenderContent): string {
  return createHash("sha256").update(JSON.stringify({
    brief: project.brief, storyboard: project.storyboard,
  })).digest("hex");
}

export function createAiVideoRenderQuote(
  project: RenderContent, platformCredits: number, now = Date.now(),
): AiVideoRenderQuote {
  const brief = aiVideoBriefSchema.parse(project.brief);
  const storyboard = requireRenderableDialogueStoryboard(
    sanitizeStoryboard(aiVideoStoryboardSchema.parse(project.storyboard), brief), brief,
  );
  if (brief.aspectRatio === "1:1") {
    throw new Error("الحوار الواقعي يدعم الأبعاد 16:9 و9:16 فقط. أنشئ سيناريو بهذه الأبعاد.");
  }
  if (storyboard.scenes.some((scene) => scene.sourceImage)) {
    throw new Error("هذا المسار يولد حوارًا من النص؛ لا يدعم صورًا مرجعية ضمن المشاهد.");
  }
  // Conservative whole-run ceiling: recovery may reuse requests and cost less,
  // but it must never spend above this consent or issue replacement submissions.
  const generatedSeconds = storyboard.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const providerCostUsd = Math.round(generatedSeconds * AI_VIDEO_PRICE_PER_SECOND_USD * 100) / 100;
  return {
    id: randomUUID(), projectId: project.id, contentHash: aiVideoRenderContentHash(project),
    expiresAt: new Date(now + 15 * 60_000).toISOString(),
    model: "fal-ai/veo3.1", currency: "USD", generatedSeconds, sceneCount: storyboard.scenes.length,
    providerCostUsd, additionalProviderCostUsd: 0, totalEstimatedUsd: providerCostUsd,
    platformCredits, pricingVersion: AI_VIDEO_PRICE_VERSION, priceSource: AI_VIDEO_PRICE_SOURCE,
    requiresManualReview: true,
  };
}

export function validateAiVideoRenderApproval(
  project: RenderContent & { renderQuote?: unknown },
  consent: z.infer<typeof aiVideoRenderConsentSchema>,
  platformCredits: number,
  now = Date.now(),
): AiVideoRenderQuote {
  const quote = aiVideoRenderQuoteSchema.safeParse(project.renderQuote);
  if (!quote.success || quote.data.id !== consent.quoteId || quote.data.projectId !== project.id
    || new Date(quote.data.expiresAt).getTime() <= now
    || quote.data.contentHash !== aiVideoRenderContentHash(project)
    || quote.data.platformCredits !== platformCredits) {
    throw new Error("تغيّر السيناريو أو السعر أو انتهت صلاحية التقدير. راجع تقديرًا جديدًا ووافق عليه قبل الإنتاج.");
  }
  const current = createAiVideoRenderQuote(project, platformCredits, now);
  if (!consent.accepted || consent.maxProviderCostUsd !== quote.data.totalEstimatedUsd
    || current.totalEstimatedUsd !== quote.data.totalEstimatedUsd) {
    throw new Error("يلزم قبول صريح لتكلفة هذا الإنتاج. الموافقة على العينة لا تسمح بإنفاق جديد.");
  }
  return quote.data;
}