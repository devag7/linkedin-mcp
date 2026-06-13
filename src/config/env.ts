import { z } from 'zod';

/**
 * Environment variable schema with validation and defaults.
 * All configuration is via environment variables (12-factor app).
 */
const envSchema = z.object({
  // Authentication
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  LINKEDIN_COOKIE: z.string().optional(),
  LINKEDIN_CSRF_TOKEN: z.string().optional(),

  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string().optional(),

  // Performance
  CACHE_TTL: z.coerce.number().int().min(0).default(300),
  RATE_LIMIT_RPM: z.coerce.number().int().min(1).default(30),
  REQUEST_TIMEOUT: z.coerce.number().int().min(1000).default(30000),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Returns a typed, validated config object.
 */
export function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([field, msgs]) => `  ${field}: ${(msgs ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${errorMessages}`);
  }

  return result.data;
}

/**
 * Check if any authentication method is configured.
 */
export function hasAuth(config: EnvConfig): boolean {
  return !!(config.LINKEDIN_ACCESS_TOKEN || config.LINKEDIN_COOKIE);
}

/**
 * Get the active authentication method.
 */
export function getAuthMethod(config: EnvConfig): 'oauth' | 'cookie' | 'none' {
  if (config.LINKEDIN_ACCESS_TOKEN) return 'oauth';
  if (config.LINKEDIN_COOKIE) return 'cookie';
  return 'none';
}
