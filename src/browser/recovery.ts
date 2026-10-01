/** Recovery is invoked only by interactive --login, never by an MCP tool. */
import type { BrowserEngine } from './engine.js';
import type { CircuitBreaker } from '../safety/circuit-breaker.js';
import { CircuitBreaker as VerificationBreaker } from '../safety/circuit-breaker.js';
import { BrowserSafety, CHECKPOINT_MESSAGE } from './safety.js';
import { VoyagerClient } from './voyager.js';
import { ownPublicId, type NormalizedResponse } from './normalize.js';
import * as ep from './endpoints.js';
import type { Logger } from '../types.js';

export async function verifyLoginAndReset(
  engine: BrowserEngine,
  breaker: CircuitBreaker,
  logger: Logger,
): Promise<boolean> {
  // A temporary observer allows exactly this human-initiated verification while
  // the persisted hard stop stays intact until both page and API checks pass.
  const verification = new BrowserSafety(new VerificationBreaker());
  try {
    if (!(await engine.isLoggedIn())) return false;
    const page = await engine.getFeedPage();
    await verification.inspectPage(page);
    const url = new URL(page.url());
    if (url.origin !== 'https://www.linkedin.com' || !/^\/feed(?:\/|$)/.test(url.pathname))
      return false;
    const voyager = new VoyagerClient(engine, logger, verification);
    const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
    if (!ownPublicId(me)) return false;
    breaker.resetGlobal(); // preserve soft cooldowns
    return true;
  } catch {
    if (verification.breaker.isGlobalOpen() && !breaker.isGlobalOpen()) {
      breaker.trip('hard', undefined, CHECKPOINT_MESSAGE);
    }
    return false;
  }
}
