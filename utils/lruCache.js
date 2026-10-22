const { LRUCache: VendorLRUCache } = require('lru-cache');

/**
 * High-performance LRUCache adapter backed by npm 'lru-cache'
 * Time Complexity: get: O(1), set: O(1), delete: O(1)
 */
class LRUCache extends VendorLRUCache {
  /**
   * @param {number} [capacity=500] - Maximum number of entries before eviction
   * @param {number} [defaultTtlMs=60000] - Default TTL in milliseconds
   */
  constructor(capacity = 500, defaultTtlMs = 60000) {
    super({
      max: Math.max(1, capacity),
      ttl: defaultTtlMs,
    });
  }
}

module.exports = LRUCache;
