export declare const dismissedSharedTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "dismissed_shared";
    schema: undefined;
    columns: {
        teacherId: import("drizzle-orm/pg-core").PgColumn<{
            name: "teacher_id";
            tableName: "dismissed_shared";
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
        itemType: import("drizzle-orm/pg-core").PgColumn<{
            name: "item_type";
            tableName: "dismissed_shared";
            dataType: "string";
            columnType: "PgText";
            data: "question" | "assignment" | "game";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["assignment", "question", "game"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        itemId: import("drizzle-orm/pg-core").PgColumn<{
            name: "item_id";
            tableName: "dismissed_shared";
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
        dismissedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "dismissed_at";
            tableName: "dismissed_shared";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
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
export type DismissedShared = typeof dismissedSharedTable.$inferSelect;
//# sourceMappingURL=dismissed-shared.d.ts.map