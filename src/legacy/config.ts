/** Isolated v1 configuration. This is not imported by the shipped browser runtime. */
import { z } from 'zod';
const legacySchema = z.object({
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  LINKEDIN_COOKIE: z.string().optional(),
  LINKEDIN_CSRF_TOKEN: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CACHE_TTL: z.coerce.number().default(300),
  RATE_LIMIT_RPM: z.coerce.number().default(30),
  REQUEST_TIMEOUT: z.coerce.number().default(30000),
});
export type LegacyEnvConfig = z.infer<typeof legacySchema>;
export const loadLegacyConfig = () => legacySchema.parse(process.env);
export const hasAuth = (config: LegacyEnvConfig) =>
  !!(config.LINKEDIN_ACCESS_TOKEN || config.LINKEDIN_COOKIE);
export function getAuthMethod(config: LegacyEnvConfig): 'oauth' | 'cookie' | 'none' {
  return config.LINKEDIN_ACCESS_TOKEN ? 'oauth' : config.LINKEDIN_COOKIE ? 'cookie' : 'none';
}
