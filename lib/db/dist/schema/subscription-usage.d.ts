/**
 * Per-teacher monthly usage counters. Keyed by (teacher_id, period_month).
 * period_month is "YYYY-MM" (UTC). Resources counted in real time from their
 * own tables (students, classes) are NOT stored here — only flow counters
 * that are time-bounded (homeworks per month, AI per month).
 *
 * Atomic increment pattern:
 *   INSERT INTO subscription_usage (teacher_id, period_month, homeworks_count, ai_usage_count)
 *   VALUES (?, ?, 1, 0)
 *   ON CONFLICT (teacher_id, period_month)
 *     DO UPDATE SET homeworks_count = subscription_usage.homeworks_count + 1
 *     WHERE subscription_usage.homeworks_count < ?  -- enforced limit, omit if NULL
 *   RETURNING homeworks_count;
 */
export declare const subscriptionUsageTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "subscription_usage";
    schema: undefined;
    columns: {
        teacherId: import("drizzle-orm/pg-core").PgColumn<{
            name: "teacher_id";
            tableName: "subscription_usage";
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
        periodMonth: import("drizzle-orm/pg-core").PgColumn<{
            name: "period_month";
            tableName: "subscription_usage";
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
        homeworksCount: import("drizzle-orm/pg-core").PgColumn<{
            name: "homeworks_count";
            tableName: "subscription_usage";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
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
        aiUsageCount: import("drizzle-orm/pg-core").PgColumn<{
            name: "ai_usage_count";
            tableName: "subscription_usage";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
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
        studentsAddedCount: import("drizzle-orm/pg-core").PgColumn<{
            name: "students_added_count";
            tableName: "subscription_usage";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
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
        classesCreatedCount: import("drizzle-orm/pg-core").PgColumn<{
            name: "classes_created_count";
            tableName: "subscription_usage";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
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
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "subscription_usage";
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
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "subscription_usage";
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
export type SubscriptionUsage = typeof subscriptionUsageTable.$inferSelect;
//# sourceMappingURL=subscription-usage.d.ts.map