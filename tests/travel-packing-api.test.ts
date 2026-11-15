import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../apps/api/src/app/app.ts';
import { configSchema } from '../apps/api/src/app/config.ts';
import { createApiServer } from '../apps/api/src/app/server.ts';
import { sessions } from '../apps/api/src/modules/auth/session.ts';
import { registerTravelPackingRoutes } from '../apps/api/src/modules/travel-packing/routes.ts';
import { buildBasePackingList, type Trip } from '../packages/shared/src/index.ts';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp(
    configSchema.parse({
      NODE_ENV: 'test',
      APP_ORIGIN: 'http://localhost:8080',
      COOKIE_SECURE: 'false',
      SUPABASE_URL: 'http://127.0.0.1:1',
      SUPABASE_ANON_KEY: 'a'.repeat(40),
      SESSION_DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused',
      SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
    }),
  );
});
afterAll(async () => {
  await app.close();
});
describe('Travel Packing API authorization', () => {
  it('rejects anonymous lists and recommendations', async () => {
    for (const url of [
      '/api/travel-packing',
      '/api/travel-packing/a7000000-0000-4000-8000-000000000001/recommendations',
    ]) {
      const response = await app.inject({ url });

      expect(response.statusCode).toBe(401);
      expect(response.headers['cache-control']).toContain('no-store');
    }
  });
  it('requires authentication to generate and delete lists', async () => {
    const csrf = await app.inject({ url: '/api/auth/csrf' });
    const data: unknown = csrf.json();

    if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string')
      throw new Error('Missing CSRF token');

    const token = data.token;

    for (const method of ['POST', 'DELETE'] as const) {
      const response = await app.inject({
        method,
        url:
          method === 'POST'
            ? '/api/travel-packing/generate'
            : '/api/travel-packing/a7000000-0000-4000-8000-000000000001',
        headers: {
          origin: 'http://localhost:8080',
          'x-csrf-token': token,
          cookie: `sw_csrf=${token}`,
        },
        ...(method === 'POST'
          ? {
              payload: {
                wardrobe_id: 'a7000000-0000-4000-8000-000000000001',
                destination: 'Japan',
                days: 10,
                activity: 'mixed',
                laundry: false,
                light: false,
                notes: '',
                language: 'en',
              },
            }
          : {}),
      });

      expect(response.statusCode).toBe(401);
    }
  });
  it('rejects state-changing requests without CSRF', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/travel-packing/generate',
      payload: {},
    });

    expect(response.statusCode).toBe(403);
  });
});

it('returns 200 for authenticated reads and saves of full database rows', async () => {
  const config = configSchema.parse({
    NODE_ENV: 'test',
    APP_ORIGIN: 'http://localhost:8080',
    COOKIE_SECURE: 'false',
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_ANON_KEY: 'a'.repeat(40),
    SESSION_DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused',
    SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
  });
  const id = 'a7000000-0000-4000-8000-000000000001';
  const trip: Trip = {
    wardrobe_id: id,
    destination: 'Japan',
    days: 10,
    activity: 'mixed',
    laundry: false,
    light: false,
    notes: '',
    language: 'en',
  };
  const input = {
    name: 'Existing trip',
    trip,
    items: buildBasePackingList(trip),
    allow_reuse: false,
  };
  const row = { ...input, id, updated_at: '2026-11-14', user_id: id, wardrobe_id: id };

  vi.stubGlobal(
    'fetch',
    vi.fn((_url: unknown, init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify(init?.method === 'POST' ? row : [row]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );

  const session = sessions(config);
  const user = {
    id,
    email: 'fixture@example.invalid',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-11-14',
  };

  vi.spyOn(session, 'load').mockResolvedValue({
    sb: session.auth(),
    user,
    session: {
      access_token: 'test',
      refresh_token: 'test',
      expires_in: 3600,
      token_type: 'bearer',
      user,
    },
  });

  const { app: server } = createApiServer(config);

  registerTravelPackingRoutes(server, config, session, undefined);

  try {
    const read = await server.inject({ url: '/api/travel-packing' });

    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject([{ id, name: 'Existing trip' }]);

    const saved = await server.inject({
      method: 'PUT',
      url: `/api/travel-packing/${id}`,
      payload: input,
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ id, name: 'Existing trip' });
    expect(saved.json()).not.toHaveProperty('user_id');
  } finally {
    await server.close();
    await session.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
