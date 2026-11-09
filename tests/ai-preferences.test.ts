import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { garmentPatch, aiPreferencesSchema } from '../packages/shared/src/index';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../apps/api/src/session.js', async (original) => ({
  ...(await original<typeof import('../apps/api/src/session')>()),
  sessions: () => ({ load: mocks.load, close: vi.fn(), pool: { on: vi.fn(), end: vi.fn() } }),
}));
import { buildApp } from '../apps/api/src/app';
let app: Awaited<ReturnType<typeof buildApp>>;
let user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const settings = new Map<string, boolean>();
beforeAll(async () => {
  app = await buildApp({
    NODE_ENV: 'test',
    PORT: 3000,
    APP_ORIGIN: 'http://localhost:8080',
    COOKIE_SECURE: false,
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_ANON_KEY: 'a'.repeat(40),
    SESSION_DATABASE_URL: 'postgres://unused@localhost/unused',
    SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
    SMTP_ENABLED: '',
    EMAIL_AUTOCONFIRM: 'true',
  });
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  settings.clear();
  user = '00000000-0000-4000-8000-000000000001';
  mocks.load.mockImplementation(async () => ({
    user: { id: user },
    sb: {
      from: (table: string) => {
        expect(table).toBe('profiles');
        let filter = '';
        let change: { ai_overwrite_metadata: boolean } | undefined;
        const chain = {
          select: () => chain,
          eq: (key: string, id: string) => {
            expect(key).toBe('id');
            filter = id;
            return chain;
          },
          update: (data: { ai_overwrite_metadata: boolean }) => {
            change = data;
            return chain;
          },
          single: async () => {
            expect(filter).toBe(user);
            if (change) settings.set(user, change.ai_overwrite_metadata);
            return { data: { ai_overwrite_metadata: settings.get(user) ?? false }, error: null };
          },
        };
        return chain;
      },
    },
  }));
});
it('persists the setting for the authenticated user across sessions without affecting others', async () => {
  const get = () => app.inject({ url: '/api/preferences/ai' });
  expect((await get()).json()).toEqual({ ai_overwrite_metadata: false });
  const r = await app.inject({
    method: 'PATCH',
    url: '/api/preferences/ai',
    headers: { origin: 'http://localhost:8080', 'x-csrf-token': 'test' },
    cookies: { sw_csrf: 'test' },
    payload: { ai_overwrite_metadata: true },
  });
  expect(r.statusCode).toBe(200);
  expect(r.json().ai_overwrite_metadata).toBe(true);
  const owner = user;
  user = other;
  expect((await get()).json().ai_overwrite_metadata).toBe(false);
  user = owner;
  expect((await get()).json().ai_overwrite_metadata).toBe(true);
});
it('does not accept identifiers or unrelated profile mutations', () => {
  expect(aiPreferencesSchema.safeParse({ ai_overwrite_metadata: true, id: other }).success).toBe(
    false,
  );
});
it('partial edits preserve all absent metadata instead of inserting defaults', () => {
  expect(garmentPatch.parse({ favorite: true })).toEqual({ favorite: true });
  expect(garmentPatch.parse({ warmth: 4, warmth_manual: true })).toEqual({
    warmth: 4,
    warmth_manual: true,
  });
});
