import { z } from "zod";
export declare const QuranReaderPosition: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    revision: z.ZodNumber;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
    revision: number;
}, {
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
    revision: number;
}>;
export declare const QuranBookmark: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
}, {
    createdAt: Date;
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
}>;
export declare const GetQuranReaderStateResponse: z.ZodObject<{
    position: z.ZodNullable<z.ZodObject<{
        surahNumber: z.ZodNumber;
        ayahNumber: z.ZodNumber;
        pageNumber: z.ZodNumber;
        revision: z.ZodNumber;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
        revision: number;
    }, {
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
        revision: number;
    }>>;
    bookmarks: z.ZodArray<z.ZodObject<{
        surahNumber: z.ZodNumber;
        ayahNumber: z.ZodNumber;
        pageNumber: z.ZodNumber;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
    }, {
        createdAt: Date;
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    position: {
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
        revision: number;
    } | null;
    bookmarks: {
        createdAt: Date;
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
    }[];
}, {
    position: {
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
        revision: number;
    } | null;
    bookmarks: {
        createdAt: Date;
        updatedAt: Date;
        surahNumber: number;
        ayahNumber: number;
        pageNumber: number;
    }[];
}>;
export declare const UpdateQuranReaderPositionBody: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    expectedRevision: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
    expectedRevision: number;
}, {
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
    expectedRevision: number;
}>;
export declare const UpdateQuranReaderPositionResponse: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    revision: z.ZodNumber;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
    revision: number;
}, {
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
    revision: number;
}>;
export declare const UpdateQuranBookmarkBody: z.ZodObject<{
    pageNumber: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    pageNumber: number;
}, {
    pageNumber: number;
}>;
export declare const UpdateQuranBookmarkResponse: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
}, {
    createdAt: Date;
    updatedAt: Date;
    surahNumber: number;
    ayahNumber: number;
    pageNumber: number;
}>;
//# sourceMappingURL=quran-reader-state.d.ts.map