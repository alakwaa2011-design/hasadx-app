import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const worksheetThemeIdSchema = z.enum([
  "geometric",
  "arabic_ink",
  "modern_band",
  "exam_paper",
  "kids_play",
  "science_lab",
  "editorial",
]);

export const worksheetCanvasElementSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["text", "rect", "circle", "line"]),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  text: z.string().max(2000).optional(),
  fontSize: z.number().min(6).max(200).optional(),
  fontColor: hexColorSchema.optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  fillColor: z.union([hexColorSchema, z.literal("transparent")]).optional(),
  strokeColor: hexColorSchema.optional(),
  strokeWidth: z.number().min(0).max(20).optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  borderRadius: z.number().min(0).max(100).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const worksheetTextStyleSchema = z.object({
  key: z.string().regex(/^(prompt|option:\d+|match-left:\d+|match-right:\d+)$/).max(30),
  fontSizePt: z.number().int().min(8).max(24).optional(),
  bold: z.boolean().optional(),
  align: z.enum(["start", "center", "end"]).optional(),
});

const worksheetQuestionStyleSchema = z.object({
  questionId: z.string().min(1).max(100),
  fields: z.array(worksheetTextStyleSchema).max(25).optional(),
  spacing: z.enum(["compact", "normal", "relaxed"]).optional(),
  choiceColumns: z.union([z.literal(1), z.literal(2)]).optional(),
  trueFalseLayout: z.enum(["mark", "choices"]).optional(),
  matchingLeftWidth: z.number().int().min(35).max(65).optional(),
});

export const worksheetSettingsSchema = z.object({
  instructions: z.string().max(2000).optional(),
  includeName: z.boolean().default(true),
  includeDate: z.boolean().default(true),
  includeClass: z.boolean().default(true),
  includeAnswerKey: z.boolean().default(false),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  headerNote: z.string().max(300).optional(),
  footerNote: z.string().max(300).optional(),
  goodLuck: z.string().max(200).optional(),
  schoolName: z.string().max(200).optional(),
  section: z.string().max(100).optional(),
  teacherName: z.string().max(100).optional(),
  customFields: z.array(z.object({
    label: z.string().max(40),
    value: z.string().max(120),
  })).max(6).optional(),
  fontFamily: z.enum([
    "default",
    "cairo",
    "tajawal",
    "amiri",
    "noto-naskh",
    "inter",
    "georgia",
  ]).default("default"),
  fontSizePt: z.number().int().min(9).max(18).default(12),
  showWatermark: z.boolean().default(true),
  themeColor: hexColorSchema.optional(),
  logoUrl: z.string().max(700_000).refine(
    (value) => /^data:image\/(?:png|jpe?g|webp|svg\+xml);base64,/.test(value),
    "logoUrl must be a supported image data URL",
  ).optional(),
  template: worksheetThemeIdSchema.optional(),
  layout: z.object({
    elements: z.array(worksheetCanvasElementSchema).max(100),
  }).optional(),
  pageBreaks: z.array(z.string().min(1).max(100)).max(59).optional(),
  questionStyles: z.array(worksheetQuestionStyleSchema).max(60).optional(),
});

export type WorksheetThemeId = z.infer<typeof worksheetThemeIdSchema>;
export type WorksheetCanvasElement = z.infer<typeof worksheetCanvasElementSchema>;
export type WorksheetCanvasLayout = NonNullable<
  z.infer<typeof worksheetSettingsSchema>["layout"]
>;
export type WorksheetSettings = z.infer<typeof worksheetSettingsSchema>;