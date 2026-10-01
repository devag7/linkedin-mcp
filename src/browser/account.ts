/** Bind safety state to authenticated /me identity, never to cookies or a username. */
import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { BrowserEngine } from './engine.js';
import type { VoyagerClient } from './voyager.js';
import { me } from './endpoints.js';
import type { NormalizedResponse } from './normalize.js';
import type { BudgetTracker } from '../safety/budgets.js';
import { SafetyStateError } from '../safety/state-lock.js';

const identitySchema = z.object({
  data: z.record(z.unknown()).optional(),
  included: z.array(z.object({ entityUrn: z.string().optional() }).passthrough()).optional(),
});
export function verifiedAccountKey(input: unknown): string {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success)
    throw new SafetyStateError(
      'ACCOUNT_UNRESOLVED',
      'Authenticated account identity could not be verified. No action was submitted.',
    );
  const response = parsed.data;
  // Existing /me normalization recognizes mini-profile/profile URNs. Prefer the
  // envelope's explicit own-member reference; reject ambiguous fallback entities.
  const urnId = (value: unknown): string | undefined =>
    typeof value === 'string'
      ? /^urn:li:fs[d]?_(?:mini)?[Pp]rofile:([A-Za-z0-9_-]+)$/.exec(value)?.[1]
      : undefined;
  const reference = response.data?.['*miniProfile'];
  const ids = new Set(
    (response.included ?? [])
      .map((entity) => urnId(entity.entityUrn))
      .filter((id): id is string => !!id),
  );
  const own =
    reference === undefined ? (ids.size === 1 ? [...ids][0] : undefined) : urnId(reference);
  if (!own || (reference !== undefined && !ids.has(own)))
    throw new SafetyStateError(
      'ACCOUNT_UNRESOLVED',
      'Authenticated account identity could not be verified. No action was submitted. Run --login and check session health.',
    );
  return `acct_${createHash('sha256').update(`linkedin-voyager:${own}`).digest('hex')}`;
}

export class AccountBinding {
  private epoch?: number;
  private checking?: Promise<void>;
  private changed = false;
  constructor(
    private readonly engine: BrowserEngine,
    private readonly identity: VoyagerClient,
    private readonly budget: BudgetTracker,
  ) {}

  async ensure(force = false): Promise<void> {
    if (this.changed)
      throw new SafetyStateError(
        'ACCOUNT_CHANGED',
        'The signed-in account changed. Stop and restart this runtime after reviewing the account.',
      );
    this.budget.verifyStorage();
    await this.engine.ensureContext();
    if (!force && this.epoch === this.engine.sessionEpoch && this.budget.accountResolved) return;
    if (this.checking) return this.checking;
    this.checking = this.resolve();
    try {
      await this.checking;
    } finally {
      this.checking = undefined;
    }
  }
  private async resolve(): Promise<void> {
    const epoch = this.engine.sessionEpoch;
    const response = await this.identity.voyagerGet<NormalizedResponse>(me());
    if (this.engine.sessionEpoch !== epoch)
      throw new SafetyStateError(
        'ACCOUNT_UNRESOLVED',
        'Browser session changed during identity verification. No action was submitted.',
      );
    this.observe(response);
    this.epoch = epoch;
  }

  /** Diagnostics must validate their final /me sample, not only an earlier cached identity. */
  observe(response: unknown): void {
    if (this.changed)
      throw new SafetyStateError(
        'ACCOUNT_CHANGED',
        'The signed-in account changed. Stop and review this runtime.',
      );
    try {
      this.budget.bindAccount(verifiedAccountKey(response));
    } catch (error) {
      if (error instanceof SafetyStateError && error.code === 'ACCOUNT_CHANGED')
        this.changed = true;
      throw error;
    }
  }
}
