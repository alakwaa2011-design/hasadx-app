import { z } from "zod/v4";
export declare const videoAnswersTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "video_answers";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "video_answers";
            dataType: "number";
            columnType: "PgSerial";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        videoSubmissionId: import("drizzle-orm/pg-core").PgColumn<{
            name: "video_submission_id";
            tableName: "video_answers";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        videoQuestionId: import("drizzle-orm/pg-core").PgColumn<{
            name: "video_question_id";
            tableName: "video_answers";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        selectedAnswer: import("drizzle-orm/pg-core").PgColumn<{
            name: "selected_answer";
            tableName: "video_answers";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        isCorrect: import("drizzle-orm/pg-core").PgColumn<{
            name: "is_correct";
            tableName: "video_answers";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const insertVideoAnswerSchema: z.ZodObject<{
    videoSubmissionId: z.ZodInt;
    videoQuestionId: z.ZodInt;
    selectedAnswer: z.ZodString;
    isCorrect: z.ZodBoolean;
}, {
    out: {};
    in: {};
}>;
export type InsertVideoAnswer = z.infer<typeof insertVideoAnswerSchema>;
export type VideoAnswer = typeof videoAnswersTable.$inferSelect;
//# sourceMappingURL=video-answers.d.ts.map