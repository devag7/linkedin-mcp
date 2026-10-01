import { z } from 'zod';

/**
 * Environment variable schema with validation and defaults.
 * All configuration is via environment variables (12-factor app).
 */
const envSchema = z.object({
  LINKEDIN_PROVIDER: z.enum(['browser', 'official']).default('browser'),
  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Browser engine (v2 stealth engine — patchright)
  // Headless by DEFAULT: normal operation is invisible (no window) — the user
  // never sees the browser. `--login` forces a visible window for the one-time
  // sign-in (and to solve any captcha). After login the warm profile lets
  // headless pass Cloudflare. Set LINKEDIN_HEADLESS=false to force a window.
  LINKEDIN_HEADLESS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Optional explicit Chrome binary path (else patchright's bundled/`channel:'chrome'`).
  LINKEDIN_CHROME_PATH: z.string().optional(),
  // Persistent profile dir (cookies + localStorage + cf clearance). Empty → store default.
  LINKEDIN_PROFILE_DIR: z.string().optional(),
  // Close the browser context after this much inactivity (ms). 0 disables.
  LINKEDIN_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(300000),
  // Max time (ms) to wait for a Cloudflare challenge to clear before giving up.
  LINKEDIN_CF_TIMEOUT_MS: z.coerce.number().int().min(1000).default(20000),
  // All browser work remains serialized.
  LINKEDIN_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
  // Browser writes are alpha and require deliberate runtime opt-in plus per-call confirmation.
  LINKEDIN_ENABLE_WRITES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const fields = Object.keys(result.error.flatten().fieldErrors);
    throw new Error(
      `Invalid environment configuration: ${fields.join(', ')} (check documented configuration)`,
    );
  }
  if (result.data.LINKEDIN_PROVIDER === 'official')
    throw new Error(
      'Official provider is unavailable in this build. No browser fallback was attempted.',
    );
  return result.data;
}
