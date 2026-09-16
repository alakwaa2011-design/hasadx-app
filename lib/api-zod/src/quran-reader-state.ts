import { z } from "zod";

export const QuranReaderPosition = z.object({
  surahNumber: z.number().int(),
  ayahNumber: z.number().int(),
  pageNumber: z.number().int(),
  revision: z.number().int(),
  updatedAt: z.coerce.date(),
});
export const QuranBookmark = z.object({
  surahNumber: z.number().int(),
  ayahNumber: z.number().int(),
  pageNumber: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export const GetQuranReaderStateResponse = z.object({
  position: QuranReaderPosition.nullable(),
  bookmarks: z.array(QuranBookmark),
});
export const UpdateQuranReaderPositionBody = z.object({
  surahNumber: z.number().int(),
  ayahNumber: z.number().int(),
  pageNumber: z.number().int(),
  expectedRevision: z.number().int(),
});
export const UpdateQuranReaderPositionResponse = QuranReaderPosition;
export const UpdateQuranBookmarkBody = z.object({ pageNumber: z.number().int() });
export const UpdateQuranBookmarkResponse = QuranBookmark;