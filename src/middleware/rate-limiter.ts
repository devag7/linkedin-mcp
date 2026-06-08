/**
 * Rate Limiter Middleware
 *
 * Token bucket rate limiter to respect LinkedIn's API limits.
 * Prevents the server from making too many requests and getting blocked.
 */

export interface RateLimiterConfig {
  /** Maximum requests per minute */
  maxRpm: number;
  /** Maximum burst size (tokens in bucket) */
  maxBurst?: number;
}

/**
 * Token bucket rate limiter.
 * Allows bursts up to maxBurst, refills at maxRpm rate.
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond
  private lastRefill: number;

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxBurst ?? Math.min(config.maxRpm, 10);
    this.tokens = this.maxTokens;
    this.refillRate = config.maxRpm / 60000; // convert RPM to per-ms
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token. Returns true if allowed, false if rate limited.
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available, then consume it.
   * Returns the number of milliseconds waited.
   */
  async waitForToken(): Promise<number> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }

    // Calculate wait time for next token
    const deficit = 1 - this.tokens;
    const waitMs = Math.ceil(deficit / this.refillRate);

    await sleep(waitMs);
    this.refill();
    this.tokens -= 1;

    return waitMs;
  }

  /**
   * Get current rate limiter status.
   */
  getStatus(): { availableTokens: number; maxTokens: number } {
    this.refill();
    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
