/**
 * Subscription Credit Grants — one row per Lemon Squeezy invoice.
 *
 * This is the primary guard against granting credits for the same
 * invoice more than once. credits_granted may be 0 (e.g. when the
 * user is already at the rollover cap) — the row is always inserted
 * so the invoice cannot be reprocessed later.
 *
 * Flow (inside one locked transaction):
 *   1. INSERT this row (ON CONFLICT subscription_invoice_id DO NOTHING → RETURNING)
 *   2. If no row returned → already processed → return alreadyGranted: true
 *   3. Calculate credits to grant
 *   4. INSERT credit_batch (if > 0)
 *   5. UPDATE credits_granted = actual amount
 */
export declare const subscriptionCreditGrantsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "subscription_credit_grants";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "subscription_credit_grants";
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
        subscriptionInvoiceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "subscription_invoice_id";
            tableName: "subscription_credit_grants";
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
        subscriptionId: import("drizzle-orm/pg-core").PgColumn<{
            name: "subscription_id";
            tableName: "subscription_credit_grants";
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
        teacherId: import("drizzle-orm/pg-core").PgColumn<{
            name: "teacher_id";
            tableName: "subscription_credit_grants";
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
        planCode: import("drizzle-orm/pg-core").PgColumn<{
            name: "plan_code";
            tableName: "subscription_credit_grants";
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
        creditsGranted: import("drizzle-orm/pg-core").PgColumn<{
            name: "credits_granted";
            tableName: "subscription_credit_grants";
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
        periodEnd: import("drizzle-orm/pg-core").PgColumn<{
            name: "period_end";
            tableName: "subscription_credit_grants";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
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
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "subscription_credit_grants";
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
export type SubscriptionCreditGrant = typeof subscriptionCreditGrantsTable.$inferSelect;
export type NewSubscriptionCreditGrant = typeof subscriptionCreditGrantsTable.$inferInsert;
//# sourceMappingURL=subscription-credit-grants.d.ts.map