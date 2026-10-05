/** Publisher-only mitigation for GHSA-ch52-4w7c-c8xp. Not shipped in the MCP package. */
module.exports = (CachePolicy) => class PublisherCachePolicy extends CachePolicy {
  _publisherRequiresRevalidation() {
    // Security prohibitions must survive max-stale and stale-while-revalidate.
    // Shared cookies require explicit public opt-in, even with immutable.
    const sharedProhibition = this._isShared && (
      this._rescc['proxy-revalidate'] ||
      (this._resHeaders['set-cookie'] && !this._rescc.public)
    );
    return !this.storable() || this._rescc['no-cache'] || sharedProhibition;
  }
  evaluateRequest(request) {
    if (this._publisherRequiresRevalidation()) {
      this._assertRequestHasHeaders(request);
      return this._evaluateRequestMissResult(request);
    }
    return super.evaluateRequest(request);
  }
  useStaleWhileRevalidate() {
    return !this._publisherRequiresRevalidation() && super.useStaleWhileRevalidate();
  }
  _useStaleIfError() {
    return !this._publisherRequiresRevalidation() && super._useStaleIfError();
  }
};
