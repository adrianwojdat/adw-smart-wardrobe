import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import {
  type StyleAnswers,
  styleAnswersSchema,
  styleProfileUpdateSchema,
} from '../packages/shared/src/index.ts';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('../apps/api/src/modules/auth/session.js', async (original) => ({
  ...(await original<typeof import('../apps/api/src/modules/auth/session.ts')>()),
  sessions: () => ({ load: mocks.load, close: vi.fn(), pool: { on: vi.fn(), end: vi.fn() } }),
}));
import { buildApp } from '../apps/api/src/app/app.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
const owner = '00000000-0000-4000-8000-000000000001',
  other = '00000000-0000-4000-8000-000000000002';
let user = owner;
const records = new Map<string, { schema_version: 1; answers: StyleAnswers; skipped: string[] }>();

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
  user = owner;
  records.clear();
  records.set(owner, {
    schema_version: 1,
    answers: { q01_thermal: 'cold', q21_aesthetics: ['classic'], q28_remind_rarely_worn: false },
    skipped: ['q02_at_18c'],
  });
  records.set(other, { schema_version: 1, answers: {}, skipped: [] });
  mocks.load.mockImplementation(() =>
    Promise.resolve({
      user: { id: user },
      sb: {
        from: (table: string) => {
          expect(table).toBe('profiles');

          const chain = {
            select: () => chain,
            eq: (column: string, id: string) => {
              expect(column).toBe('id');
              expect(id).toBe(user);

              return chain;
            },
            single: () =>
              Promise.resolve({ data: { style_profile: records.get(user) }, error: null }),
          };

          return chain;
        },
        rpc: (name: string, payload: unknown) => {
          expect(name).toBe('merge_my_style_answers');

          const input = styleProfileUpdateSchema.parse(
            (() => {
              if (
                typeof payload !== 'object' ||
                !payload ||
                !('p_answers' in payload) ||
                !('p_skipped' in payload)
              )
                throw Error('Invalid RPC input');

              return { answers: payload.p_answers, skipped: payload.p_skipped };
            })(),
          );
          const record = records.get(user)!;
          const next = {
            ...record,
            answers: styleAnswersSchema.parse({ ...record.answers, ...input.answers }),
            skipped: [
              ...new Set([
                ...record.skipped.filter((key) => !(key in input.answers)),
                ...input.skipped,
              ]),
            ],
          };

          for (const key of input.skipped) delete next.answers[key];
          records.set(user, next);

          return Promise.resolve({ data: next, error: null });
        },
      },
    }),
  );
});

const save = (payload: unknown) =>
  app.inject({
    method: 'PATCH',
    url: '/api/profile/style',
    headers: { origin: 'http://localhost:8080', 'x-csrf-token': 'test' },
    cookies: { sw_csrf: 'test' },
    payload,
  });

it('round-trips additive profile answers without overwriting old answers, false values or skips', async () => {
  const before = structuredClone(records.get(owner)!);
  const response = await save({
    answers: {
      q31_dominant_style: 'classic',
      q32_colors: ['navy'],
      q34_preference_strength: { colors: 'strong' },
    },
  });

  expect(response.statusCode).toBe(200);

  const read = await app.inject({ url: '/api/profile/style' });

  expect(read.statusCode).toBe(200);
  expect(read.json()).toMatchObject({
    ...before,
    answers: { ...before.answers, q31_dominant_style: 'classic', q32_colors: ['navy'] },
  });
  user = other;
  expect((await app.inject({ url: '/api/profile/style' })).json<unknown>()).toMatchObject({
    answers: {},
  });
});
it('rejects unknown option identifiers, empty strength objects and foreign user fields', async () => {
  for (const payload of [
    { answers: { q31_dominant_style: 'Klasyczny' } },
    { answers: { q34_preference_strength: {} } },
    { answers: { q32_colors: ['navy'] }, user_id: other },
  ]) {
    const before = structuredClone(records.get(owner));

    expect((await save(payload)).statusCode).toBe(400);
    expect(records.get(owner)).toEqual(before);
  }
});
