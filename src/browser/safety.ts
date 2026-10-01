import type { Page } from 'patchright';
import { CircuitBreaker, type CircuitSignal } from '../safety/circuit-breaker.js';

export const CHECKPOINT_MESSAGE =
  'LinkedIn checkpoint or challenge detected. Stop automation, resolve it manually with --login, then restart the server.';
export class BrowserSafetyError extends Error {
  constructor(
    readonly code: 'CHECKPOINT_REQUIRED' | 'CIRCUIT_OPEN' | 'AUTH_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'BrowserSafetyError';
  }
}

export function isLoginUrl(url: string): boolean {
  try {
    return /^\/(?:login|uas\/login|authwall)(?:\/|$)/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Local inspection only. Return a bounded title/challenge-element sample, never the feed. */
export async function pageSignal(page: Page, status?: number): Promise<CircuitSignal> {
  const finalUrl = page.url();
  const bodySample = await page.evaluate(() => {
    const title = document.title.slice(0, 512);
    const challenge = document.querySelector(
      'form[action*="/checkpoint/challenge"], iframe[src*="captcha"], input[name="captcha"]',
    );
    return challenge ? `${title} captcha` : title;
  });
  return { status, finalUrl, bodySample };
}

/** Shared by engine, Voyager, and DOM paths; trips before any fallback can swallow an error. */
export class BrowserSafety {
  constructor(readonly breaker: CircuitBreaker) {}

  assertAllowed(): void {
    if (this.breaker.isGlobalOpen()) {
      throw new BrowserSafetyError(
        'CIRCUIT_OPEN',
        'A safety stop is active. Resolve it manually with --login and restart the server.',
      );
    }
  }

  observe(signal: CircuitSignal): void {
    this.assertAllowed();
    if (this.breaker.classify(signal) === 'hard') {
      try {
        this.breaker.trip('hard', undefined, CHECKPOINT_MESSAGE);
      } catch {
        throw new BrowserSafetyError(
          'CIRCUIT_OPEN',
          'Checkpoint detected, but safety state could not be saved. Stop automation and repair storage before restarting.',
        );
      }
      throw new BrowserSafetyError('CHECKPOINT_REQUIRED', CHECKPOINT_MESSAGE);
    }
  }

  async inspectPage(page: Page, status?: number): Promise<void> {
    this.assertAllowed();
    // A challenge navigation can destroy the JS context. Act on URL/status
    // before attempting DOM inspection, so a failed evaluate cannot hide it.
    this.observe({ status, finalUrl: page.url() });
    const signal = await pageSignal(page, status);
    this.observe(signal);
    if (isLoginUrl(signal.finalUrl ?? '')) {
      throw new BrowserSafetyError('AUTH_REQUIRED', 'LinkedIn login has expired. Run --login.');
    }
  }

  inspectResponse(raw: { status: number; url: string; body: string }): void {
    // Successful JSON can contain posts about captcha/security. Never classify
    // user content as a challenge. Error envelopes and HTML are bounded signals.
    const sample = raw.body.trimStart().slice(0, 8192);
    const json = sample.startsWith('{') || sample.startsWith('[');
    const login = isLoginUrl(raw.url);
    this.observe({
      status: raw.status,
      finalUrl: raw.url,
      bodySample: json && raw.status < 400 ? undefined : sample,
      expectedJson: !login && raw.status !== 401,
    });
    if (login)
      throw new BrowserSafetyError('AUTH_REQUIRED', 'LinkedIn login has expired. Run --login.');
  }
}
