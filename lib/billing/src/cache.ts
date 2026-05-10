/**
 * Tiny per-process cache with TTL. Used to avoid hitting the DB for plan +
 * subscription on every request. NOT a substitute for Redis in a multi-node
 * deployment, but the api-server runs as a single process so this is fine
 * until horizontal scaling is needed. Invalidate on subscription changes.
 */
export class TtlCache<K, V> {
  private store = new Map<K, { value: V; expiresAt: number }>();

  constructor(private ttlMs: number) {}

  get(key: K): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
