/** Process-owned preview proofs. They prove a preview was issued, not human consent. */
import { randomBytes } from 'node:crypto';
export class PreviewError extends Error {
  constructor(
    readonly code: 'PREVIEW_REQUIRED' | 'PREVIEW_EXPIRED' | 'PREVIEW_CHANGED' | 'PREVIEW_LIMIT',
  ) {
    super(code);
  }
}
export class WritePreviews {
  private readonly records = new Map<
    string,
    { operationId: string; hash: string; expiresAt: number }
  >();
  constructor(
    private readonly clock = () => Date.now(),
    private readonly lifetimeMs = 5 * 60_000,
    private readonly limit = 512,
  ) {}
  issue(operationId: string, hash: string) {
    for (const [token, record] of this.records)
      if (record.expiresAt <= this.clock()) this.records.delete(token);
    if (this.records.size >= this.limit) throw new PreviewError('PREVIEW_LIMIT');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.clock() + this.lifetimeMs;
    this.records.set(token, { operationId, hash, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }
  assert(token: string | undefined, operationId: string, hash: string): void {
    const record = token ? this.records.get(token) : undefined;
    if (!record) throw new PreviewError('PREVIEW_REQUIRED');
    if (record.expiresAt <= this.clock()) {
      this.records.delete(token!);
      throw new PreviewError('PREVIEW_EXPIRED');
    }
    if (record.operationId !== operationId || record.hash !== hash)
      throw new PreviewError('PREVIEW_CHANGED');
  }
  consume(token: string): void {
    this.records.delete(token);
  }
}
