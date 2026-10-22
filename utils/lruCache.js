/**
 * LRUCache - High-Performance In-Memory Cache using Hash Map + Doubly-Linked ordering
 *
 * Time Complexity:
 * - get(key): O(1)
 * - set(key, value): O(1)
 * - delete(key): O(1)
 * - Space Complexity: O(capacity)
 *
 * Implements Least Recently Used eviction policy with Time-To-Live (TTL) expiration.
 */
class LRUCache {
  /**
   * @param {number} [capacity=500] - Maximum number of entries before eviction
   * @param {number} [defaultTtlMs=60000] - Default TTL in milliseconds (1 minute)
   */
  constructor(capacity = 500, defaultTtlMs = 60000) {
    this.capacity = Math.max(1, capacity);
    this.defaultTtlMs = defaultTtlMs;
    this.map = new Map();
  }

  /**
   * Retrieves an entry from cache in O(1) time
   * Refreshes item position to Most Recently Used (MRU)
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    if (!this.map.has(key)) return null;

    const entry = this.map.get(key);

    // TTL check
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // Refresh position to MRU (end of Map iteration order)
    this.map.delete(key);
    this.map.set(key, entry);

    return entry.value;
  }

  /**
   * Sets or updates an entry in O(1) time
   * Evicts Least Recently Used (LRU) entry if capacity is reached
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs] - Custom TTL in milliseconds
   */
  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Evict LRU element (the first key in Map insertion order)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
    this.map.set(key, { value, expiresAt });
  }

  /**
   * Invalidates a single entry in O(1) time
   * @param {string} key
   */
  delete(key) {
    return this.map.delete(key);
  }

  /**
   * Invalidates all entries in cache
   */
  clear() {
    this.map.clear();
  }

  /**
   * Current cached entry count
   */
  get size() {
    return this.map.size;
  }
}

module.exports = LRUCache;
