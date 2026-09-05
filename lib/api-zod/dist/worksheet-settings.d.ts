import { z } from "zod";
export declare const worksheetThemeIdSchema: z.ZodEnum<["geometric", "arabic_ink", "modern_band", "exam_paper", "kids_play", "science_lab", "editorial"]>;
export declare const worksheetCanvasElementSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["text", "rect", "circle", "line"]>;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    text: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodNumber>;
    fontColor: z.ZodOptional<z.ZodString>;
    bold: z.ZodOptional<z.ZodBoolean>;
    italic: z.ZodOptional<z.ZodBoolean>;
    align: z.ZodOptional<z.ZodEnum<["left", "center", "right"]>>;
    fillColor: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"transparent">]>>;
    strokeColor: z.ZodOptional<z.ZodString>;
    strokeWidth: z.ZodOptional<z.ZodNumber>;
    strokeStyle: z.ZodOptional<z.ZodEnum<["solid", "dashed", "dotted"]>>;
    borderRadius: z.ZodOptional<z.ZodNumber>;
    opacity: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "text" | "rect" | "circle" | "line";
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string | undefined;
    fontSize?: number | undefined;
    fontColor?: string | undefined;
    bold?: boolean | undefined;
    italic?: boolean | undefined;
    align?: "left" | "center" | "right" | undefined;
    fillColor?: string | undefined;
    strokeColor?: string | undefined;
    strokeWidth?: number | undefined;
    strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
    borderRadius?: number | undefined;
    opacity?: number | undefined;
}, {
    id: string;
    kind: "text" | "rect" | "circle" | "line";
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string | undefined;
    fontSize?: number | undefined;
    fontColor?: string | undefined;
    bold?: boolean | undefined;
    italic?: boolean | undefined;
    align?: "left" | "center" | "right" | undefined;
    fillColor?: string | undefined;
    strokeColor?: string | undefined;
    strokeWidth?: number | undefined;
    strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
    borderRadius?: number | undefined;
    opacity?: number | undefined;
}>;
export declare const worksheetSettingsSchema: z.ZodObject<{
    instructions: z.ZodOptional<z.ZodString>;
    includeName: z.ZodDefault<z.ZodBoolean>;
    includeDate: z.ZodDefault<z.ZodBoolean>;
    includeClass: z.ZodDefault<z.ZodBoolean>;
    includeAnswerKey: z.ZodDefault<z.ZodBoolean>;
    columns: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>]>>;
    headerNote: z.ZodOptional<z.ZodString>;
    footerNote: z.ZodOptional<z.ZodString>;
    goodLuck: z.ZodOptional<z.ZodString>;
    schoolName: z.ZodOptional<z.ZodString>;
    section: z.ZodOptional<z.ZodString>;
    teacherName: z.ZodOptional<z.ZodString>;
    customFields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        label: string;
    }, {
        value: string;
        label: string;
    }>, "many">>;
    fontFamily: z.ZodDefault<z.ZodEnum<["default", "cairo", "tajawal", "amiri", "noto-naskh", "inter", "georgia"]>>;
    fontSizePt: z.ZodDefault<z.ZodNumber>;
    showWatermark: z.ZodDefault<z.ZodBoolean>;
    themeColor: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    template: z.ZodOptional<z.ZodEnum<["geometric", "arabic_ink", "modern_band", "exam_paper", "kids_play", "science_lab", "editorial"]>>;
    layout: z.ZodOptional<z.ZodObject<{
        elements: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["text", "rect", "circle", "line"]>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
            text: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodNumber>;
            fontColor: z.ZodOptional<z.ZodString>;
            bold: z.ZodOptional<z.ZodBoolean>;
            italic: z.ZodOptional<z.ZodBoolean>;
            align: z.ZodOptional<z.ZodEnum<["left", "center", "right"]>>;
            fillColor: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"transparent">]>>;
            strokeColor: z.ZodOptional<z.ZodString>;
            strokeWidth: z.ZodOptional<z.ZodNumber>;
            strokeStyle: z.ZodOptional<z.ZodEnum<["solid", "dashed", "dotted"]>>;
            borderRadius: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "text" | "rect" | "circle" | "line";
            x: number;
            y: number;
            width: number;
            height: number;
            text?: string | undefined;
            fontSize?: number | undefined;
            fontColor?: string | undefined;
            bold?: boolean | undefined;
            italic?: boolean | undefined;
            align?: "left" | "center" | "right" | undefined;
            fillColor?: string | undefined;
            strokeColor?: string | undefined;
            strokeWidth?: number | undefined;
            strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
            borderRadius?: number | undefined;
            opacity?: number | undefined;
        }, {
            id: string;
            kind: "text" | "rect" | "circle" | "line";
            x: number;
            y: number;
            width: number;
            height: number;
            text?: string | undefined;
            fontSize?: number | undefined;
            fontColor?: string | undefined;
            bold?: boolean | undefined;
            italic?: boolean | undefined;
            align?: "left" | "center" | "right" | undefined;
            fillColor?: string | undefined;
            strokeColor?: string | undefined;
            strokeWidth?: number | undefined;
            strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
            borderRadius?: number | undefined;
            opacity?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        elements: {
            id: string;
            kind: "text" | "rect" | "circle" | "line";
            x: number;
            y: number;
            width: number;
            height: number;
            text?: string | undefined;
            fontSize?: number | undefined;
            fontColor?: string | undefined;
            bold?: boolean | undefined;
            italic?: boolean | undefined;
            align?: "left" | "center" | "right" | undefined;
            fillColor?: string | undefined;
            strokeColor?: string | undefined;
            strokeWidth?: number | undefined;
            strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
            borderRadius?: number | undefined;
            opacity?: number | undefined;
        }[];
    }, {
        elements: {
            id: string;
            kind: "text" | "rect" | "circle" | "line";
            x: number;
            y: number;
            width: number;
            height: number;
            text?: string | undefined;
            fontSize?: number | undefined;
            fontColor?: string | undefined;
            bold?: boolean | undefined;
            italic?: boolean | undefined;
            align?: "left" | "center" | "right" | undefined;
            fillColor?: string | undefined;
            strokeColor?: string | undefined;
            strokeWidth?: number | undefined;
            strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
            borderRadius?: number | undefined;
            opacity?: number | undefined;
        }[];
    }>>;
    pageBreaks: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    questionStyles: z.ZodOptional<z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            fontSizePt: z.ZodOptional<z.ZodNumber>;
            bold: z.ZodOptional<z.ZodBoolean>;
            align: z.ZodOptional<z.ZodEnum<["start", "center", "end"]>>;
        }, "strip", z.ZodTypeAny, {
            key: string;
            bold?: boolean | undefined;
            align?: "center" | "start" | "end" | undefined;
            fontSizePt?: number | undefined;
        }, {
            key: string;
            bold?: boolean | undefined;
            align?: "center" | "start" | "end" | undefined;
            fontSizePt?: number | undefined;
        }>, "many">>;
        spacing: z.ZodOptional<z.ZodEnum<["compact", "normal", "relaxed"]>>;
        choiceColumns: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>]>>;
        trueFalseLayout: z.ZodOptional<z.ZodEnum<["mark", "choices"]>>;
        matchingLeftWidth: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        fields?: {
            key: string;
            bold?: boolean | undefined;
            align?: "center" | "start" | "end" | undefined;
            fontSizePt?: number | undefined;
        }[] | undefined;
        spacing?: "compact" | "normal" | "relaxed" | undefined;
        choiceColumns?: 1 | 2 | undefined;
        trueFalseLayout?: "mark" | "choices" | undefined;
        matchingLeftWidth?: number | undefined;
    }, {
        questionId: string;
        fields?: {
            key: string;
            bold?: boolean | undefined;
            align?: "center" | "start" | "end" | undefined;
            fontSizePt?: number | undefined;
        }[] | undefined;
        spacing?: "compact" | "normal" | "relaxed" | undefined;
        choiceColumns?: 1 | 2 | undefined;
        trueFalseLayout?: "mark" | "choices" | undefined;
        matchingLeftWidth?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    includeName: boolean;
    includeDate: boolean;
    includeClass: boolean;
    includeAnswerKey: boolean;
    columns: 1 | 2;
    fontFamily: "default" | "cairo" | "tajawal" | "amiri" | "noto-naskh" | "inter" | "georgia";
    fontSizePt: number;
    showWatermark: boolean;
    instructions?: string | undefined;
    headerNote?: string | undefined;
    footerNote?: string | undefined;
    goodLuck?: string | undefined;
    schoolName?: string | undefined;
    section?: string | undefined;
    teacherName?: string | undefined;
    customFields?: {
        value: string;
        label: string;
    }[] | undefined;
    themeColor?: string | undefined;
    logoUrl?: string | undefined;
    template?: "geometric" | "arabic_ink" | "modern_band" | "exam_paper" | "kids_play" | "science_lab" | "editorial" | undefined;
    layout?: {
        elements: {
            id: string;
            kind: "text" | "rect" | "circle" | "line";
            x: number;
            y: number;
            width: number;
            height: number;
            text?: string | undefined;
            fontSize?: number | undefined;
            fontColor?: string | undefined;
            bold?: boolean | undefined;
            italic?: boolean | undefined;
            align?: "left" | "center" | "right" | undefined;
            fillColor?: string | undefined;
            strokeColor?: string | undefined;
            strokeWidth?: number | undefined;
            strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
            borderRadius?: number | undefined;
            opacity?: number | undefined;
        }[];
    } | undefined;
    pageBreaks?: string[] | undefined;
    questionStyles?: {
        questionId: string;
        fields?: {
            key: string;
            bold?: boolean | undefined;
            align?: "center" | "start" | "end" | undefined;
            fontSizePt?: number | undefined;
        }[] | undefined;
        spacing?: "compact" | "normal" | "relaxed" | undefined;
        choiceColumns?: 1 | 2 | undefined;
        trueFalseLayout?: "mark" | "choices" | undefined;
        matchingLeftWidth?: number | undefined;
    }[] | undefined;
}, {
    instructions?: string | undefined;
    includeName?: boolean | undefined;
    includeDate?: boolean | undefined;
    includeClass?: boolean | undefined;
    includeAnswerKey?: boolean | undefined;
    columns?: 1 | 2 | undefined;
    headerNote?: string | undefined;
    footerNote?: string | undefined;
    goodLuck?: string | undefined;
    schoolName?: string | undefined;
    section?: string | undefined;
    teacherName?: string | undefined;
    customFields?: {
        value: string;
        label: string;
    }[] | undefined;
    fontFamily?: "default" | "cairo" | "tajawal" | "amiri" | "noto-naskh" | "inter" | "georgia" | undefined;
    fontSizePt?: number | undefined;
    showWatermark?: boolean | undefined;
    themeColor?: string | undefined;
    logoUrl?: string | undefined;
    template?: "geometric" | "arabic_ink" | "modern_band" | "exam_paper" | "kids_play" | "science_lab" | "editorial" | undefined;
    layout?: {
        elements: {
            id: string;
            kind: "text" | "rect" | "circle" | "line";
            x: number;
            y: number;
            width: number;
            height: number;
            text?: string | undefined;
            fontSize?: number | undefined;
            fontColor?: string | undefined;
            bold?: boolean | undefined;
            italic?: boolean | undefined;
            align?: "left" | "center" | "right" | undefined;
            fillColor?: string | undefined;
            strokeColor?: string | undefined;
            strokeWidth?: number | undefined;
            strokeStyle?: "solid" | "dashed" | "dotted" | undefined;
            borderRadius?: number | undefined;
            opacity?: number | undefined;
        }[];
    } | undefined;
    pageBreaks?: string[] | undefined;
    questionStyles?: {
        questionId: string;
        fields?: {
            key: string;
            bold?: boolean | undefined;
            align?: "center" | "start" | "end" | undefined;
            fontSizePt?: number | undefined;
        }[] | undefined;
        spacing?: "compact" | "normal" | "relaxed" | undefined;
        choiceColumns?: 1 | 2 | undefined;
        trueFalseLayout?: "mark" | "choices" | undefined;
        matchingLeftWidth?: number | undefined;
    }[] | undefined;
}>;
export type WorksheetThemeId = z.infer<typeof worksheetThemeIdSchema>;
export type WorksheetCanvasElement = z.infer<typeof worksheetCanvasElementSchema>;
export type WorksheetCanvasLayout = NonNullable<z.infer<typeof worksheetSettingsSchema>["layout"]>;
export type WorksheetSettings = z.infer<typeof worksheetSettingsSchema>;
//# sourceMappingURL=worksheet-settings.d.ts.map