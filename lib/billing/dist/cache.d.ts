/**
 * Tiny per-process cache with TTL. Used to avoid hitting the DB for plan +
 * subscription on every request. NOT a substitute for Redis in a multi-node
 * deployment, but the api-server runs as a single process so this is fine
 * until horizontal scaling is needed. Invalidate on subscription changes.
 */
export declare class TtlCache<K, V> {
    private ttlMs;
    private store;
    constructor(ttlMs: number);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    delete(key: K): void;
    clear(): void;
}
//# sourceMappingURL=cache.d.ts.map