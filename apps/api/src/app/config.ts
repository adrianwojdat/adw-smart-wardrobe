import { z } from 'zod';

const optionalLimit = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  APP_ORIGIN: z.url(),
  APP_ADDITIONAL_ORIGINS: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).transform((v) => v === 'true'),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SESSION_DATABASE_URL: z.string().min(1),
  SESSION_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/),
  REDIS_URL: z.url().optional(),
  GEMINI_ENCRYPTION_KEY: z
    .string()
    .default('')
    .refine((v) => !v || /^[a-f0-9]{64}$/.test(v)),
  GEMINI_RPM_LIMIT: z.coerce.number().int().min(1).max(60).default(12),
  GEMINI_MAX_QUEUE: z.coerce.number().int().min(1).max(1000).default(100),
  GEMINI_SHARED_QUOTA_ID: z.string().max(120).default(''),
  GEMINI_TPM_LIMIT: optionalLimit,
  GEMINI_RPD_LIMIT: optionalLimit,
  QUEUE_ADMIN_USER_IDS: z.string().optional(),
  SMTP_ENABLED: z.string().default(''),
  EMAIL_AUTOCONFIRM: z.string().default('true'),
});
export type Config = z.infer<typeof configSchema>;
