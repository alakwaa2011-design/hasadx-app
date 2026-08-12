/**
 * Credit Hold Items — maps each hold to the exact batches it drew from.
 *
 * When a hold needs credits from multiple batches, one row per batch is
 * inserted here. Refunds use these rows to restore to the exact same batches.
 *
 * Replaces the per-bucket columns (held_promo / held_earned / held_paid) for
 * new-style holds. Legacy holds (no items) continue using those columns.
 */
export declare const creditHoldItemsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "credit_hold_items";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "credit_hold_items";
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
        holdId: import("drizzle-orm/pg-core").PgColumn<{
            name: "hold_id";
            tableName: "credit_hold_items";
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
        batchId: import("drizzle-orm/pg-core").PgColumn<{
            name: "batch_id";
            tableName: "credit_hold_items";
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
        amount: import("drizzle-orm/pg-core").PgColumn<{
            name: "amount";
            tableName: "credit_hold_items";
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
    };
    dialect: "pg";
}>;
export type CreditHoldItem = typeof creditHoldItemsTable.$inferSelect;
export type NewCreditHoldItem = typeof creditHoldItemsTable.$inferInsert;
//# sourceMappingURL=credit-hold-items.d.ts.map