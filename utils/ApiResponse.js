class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.cacheControl = null;
  }

  /**
   * Enables HTTP edge and browser caching headers (RFC 5861 stale-while-revalidate)
   * @param {number} [maxAge=60] - Browser max age in seconds
   * @param {number} [sMaxAge=120] - Shared CDN edge cache max age in seconds
   * @param {number} [staleWhileRevalidate=300] - Stale while revalidating duration in seconds
   */
  setCache(maxAge = 60, sMaxAge = 120, staleWhileRevalidate = 300) {
    this.cacheControl = `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
    return this;
  }

  send(res) {
    if (this.cacheControl && !res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', this.cacheControl);
    }
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }
}

module.exports = ApiResponse;
