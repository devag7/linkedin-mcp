/**
 * LRU Cache Middleware
 *
 * In-memory cache with TTL expiration for LinkedIn API responses.
 * Reduces API calls for frequently accessed data (profiles, company info, etc.).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple LRU cache with TTL-based expiration.
 */
export class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtl: number; // milliseconds
  private maxSize: number;

  constructor(ttlSeconds: number = 300, maxSize: number = 500) {
    this.defaultTtl = ttlSeconds * 1000;
    this.maxSize = maxSize;
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) return undefined;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Move to end (LRU behavior — Map preserves insertion order)
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value as T;
  }

  /**
   * Set a cached value with optional custom TTL.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete a cached entry.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number } {
    // Prune expired entries
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }

    return {
      size: this.store.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Get or set a cached value. If the key doesn't exist, calls the factory function.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }
}
