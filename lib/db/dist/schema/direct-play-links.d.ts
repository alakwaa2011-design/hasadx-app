/**
 * One stable share-link per (assignment, gameType) pair.
 * The token is a 32-char random hex string — not guessable from the assignment ID.
 * Anyone with the token can start a solo game; no login required.
 * Supported gameType values: "wameeth" | "rocket_race"
 */
export declare const directPlayLinksTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "direct_play_links";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "direct_play_links";
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
        token: import("drizzle-orm/pg-core").PgColumn<{
            name: "token";
            tableName: "direct_play_links";
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
        assignmentId: import("drizzle-orm/pg-core").PgColumn<{
            name: "assignment_id";
            tableName: "direct_play_links";
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
        gameType: import("drizzle-orm/pg-core").PgColumn<{
            name: "game_type";
            tableName: "direct_play_links";
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
            tableName: "direct_play_links";
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
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "direct_play_links";
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
//# sourceMappingURL=direct-play-links.d.ts.map