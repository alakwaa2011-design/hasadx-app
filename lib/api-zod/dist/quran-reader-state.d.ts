import { z } from "zod";
export declare const QuranBookmarkCategory: z.ZodEnum<["stopped_here", "review", "similar", "repeated_mistake", "ask_teacher"]>;
export declare const QuranReaderPosition: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    revision: z.ZodNumber;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    updatedAt: Date;
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    revision: number;
}, {
    updatedAt: Date;
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    revision: number;
}>;
export declare const QuranBookmark: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    category: z.ZodEnum<["stopped_here", "review", "similar", "repeated_mistake", "ask_teacher"]>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
}, {
    createdAt: Date;
    updatedAt: Date;
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
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
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        revision: number;
    }, {
        updatedAt: Date;
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        revision: number;
    }>>;
    bookmarks: z.ZodArray<z.ZodObject<{
        surahNumber: z.ZodNumber;
        ayahNumber: z.ZodNumber;
        pageNumber: z.ZodNumber;
        category: z.ZodEnum<["stopped_here", "review", "similar", "repeated_mistake", "ask_teacher"]>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        updatedAt: Date;
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
    }, {
        createdAt: Date;
        updatedAt: Date;
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    position: {
        updatedAt: Date;
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        revision: number;
    } | null;
    bookmarks: {
        createdAt: Date;
        updatedAt: Date;
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
    }[];
}, {
    position: {
        updatedAt: Date;
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        revision: number;
    } | null;
    bookmarks: {
        createdAt: Date;
        updatedAt: Date;
        pageNumber: number;
        surahNumber: number;
        ayahNumber: number;
        category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
    }[];
}>;
export declare const UpdateQuranReaderPositionBody: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    expectedRevision: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    expectedRevision: number;
}, {
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
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
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    revision: number;
}, {
    updatedAt: Date;
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    revision: number;
}>;
export declare const UpdateQuranBookmarkBody: z.ZodObject<{
    pageNumber: z.ZodNumber;
    category: z.ZodOptional<z.ZodEnum<["stopped_here", "review", "similar", "repeated_mistake", "ask_teacher"]>>;
}, "strip", z.ZodTypeAny, {
    pageNumber: number;
    category?: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher" | undefined;
}, {
    pageNumber: number;
    category?: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher" | undefined;
}>;
export declare const UpdateQuranBookmarkResponse: z.ZodObject<{
    surahNumber: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    pageNumber: z.ZodNumber;
    category: z.ZodEnum<["stopped_here", "review", "similar", "repeated_mistake", "ask_teacher"]>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
}, {
    createdAt: Date;
    updatedAt: Date;
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    category: "review" | "stopped_here" | "similar" | "repeated_mistake" | "ask_teacher";
}>;
//# sourceMappingURL=quran-reader-state.d.ts.map