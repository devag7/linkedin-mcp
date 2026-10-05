/** Publisher-only mitigation for GHSA-ch52-4w7c-c8xp. Not shipped in the MCP package. */
module.exports = (CachePolicy) => class PublisherCachePolicy extends CachePolicy {
  evaluateRequest(request) {
    // Security prohibitions must survive max-stale and stale-while-revalidate.
    // Shared cookies require explicit public opt-in, even with immutable.
    const sharedProhibition = this._isShared && (
      this._rescc['proxy-revalidate'] ||
      (this._resHeaders['set-cookie'] && !this._rescc.public)
    );
    if (!this.storable() || this._rescc['no-cache'] || sharedProhibition) {
      this._assertRequestHasHeaders(request);
      return this._evaluateRequestMissResult(request);
    }
    return super.evaluateRequest(request);
  }
};
