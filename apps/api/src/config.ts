import { z } from 'zod';
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
  QUEUE_ADMIN_USER_IDS: z.string().optional(),
  SMTP_ENABLED: z.string().default(''),
  EMAIL_AUTOCONFIRM: z.string().default('true'),
});
export type Config = z.infer<typeof configSchema>;
