import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../apps/api/src/app/app.ts';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({
    NODE_ENV: 'test',
    PORT: 3000,
    APP_ORIGIN: 'http://localhost:8080',
    COOKIE_SECURE: false,
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_ANON_KEY: 'a'.repeat(40),
    SESSION_DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused',
    SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
    GEMINI_ENCRYPTION_KEY: '',
    GEMINI_RPM_LIMIT: 12,
    GEMINI_MAX_QUEUE: 100,
    GEMINI_SHARED_QUOTA_ID: '',
    GEMINI_TPM_LIMIT: undefined,
    GEMINI_RPD_LIMIT: undefined,
    SMTP_ENABLED: '',
    EMAIL_AUTOCONFIRM: 'true',
  });
});
afterAll(async () => {
  await app.close();
});
describe('BFF authorization and validation', () => {
  it('rejects unauthenticated access before database access', async () => {
    for (const url of [
      '/api/auth/me',
      '/api/profile/style',
      '/api/gemini/settings',
      '/api/gemini/tasks/11111111-1111-4111-8111-111111111111',
      '/api/wardrobes',
      '/api/garments',
      '/api/wardrobes/11111111-1111-4111-8111-111111111111/custom-properties',
      '/api/garments/22222222-2222-4222-8222-222222222222/custom-properties',
    ]) {
      const res = await app.inject({ url });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
      expect(res.headers['cache-control']).toContain('no-store');
    }
  });
  it('requires an authenticated owner session to update stylistic answers', async () => {
    const csrf = await app.inject({ url: '/api/auth/csrf' });
    const token = csrf.json().token;
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/profile/style',
      headers: {
        origin: 'http://localhost:8080',
        'x-csrf-token': token,
        cookie: `sw_csrf=${token}`,
      },
      payload: { answers: { q01_thermal: 'cold' }, skipped: [] },
    });

    expect(response.statusCode).toBe(401);
  });
  it('requires authentication before submitting an outfit recommendation task', async () => {
    const csrf = await app.inject({ url: '/api/auth/csrf' });
    const token = csrf.json().token;
    const response = await app.inject({
      method: 'POST',
      url: '/api/recommendations',
      headers: {
        origin: 'http://localhost:8080',
        'x-csrf-token': token,
        cookie: `sw_csrf=${token}`,
      },
      payload: {
        wardrobe_id: '11111111-1111-4111-8111-111111111111',
        occasion: 'everyday',
        temperature: 18,
        count: 2,
      },
    });

    expect(response.statusCode).toBe(401);
  });
  it('requires authentication before any Gemini key or task operation', async () => {
    const csrf = await app.inject({ url: '/api/auth/csrf' });
    const token = csrf.json().token;

    for (const [method, url, payload] of [
      ['PUT', '/api/gemini/settings', { apiKey: 'A'.repeat(40) }],
      ['POST', '/api/gemini/tasks', { kind: 'connection_test' }],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: {
          origin: 'http://localhost:8080',
          'x-csrf-token': token,
          cookie: `sw_csrf=${token}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(401);
    }
  });
  it('rejects cross-origin mutations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/wardrobes',
      headers: { origin: 'https://attacker.test' },
      payload: { name: 'Attack' },
    });

    expect(res.statusCode).toBe(403);
  });
  it('requires double submit CSRF token even with matching origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'http://localhost:8080' },
      payload: { email: 'x@example.com', password: 'somepassword' },
    });

    expect(res.statusCode).toBe(403);
  });
  it('validates request with a valid CSRF handshake', async () => {
    const csrf = await app.inject({ url: '/api/auth/csrf' });
    const token = csrf.json().token;
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: {
        origin: 'http://localhost:8080',
        'x-csrf-token': token,
        cookie: `sw_csrf=${token}`,
      },
      payload: { email: 'not-an-email', password: 'x', name: 'X' },
    });

    expect(response.statusCode).toBe(400);
  });
  it('does not pretend password email was delivered without SMTP', async () => {
    const csrf = await app.inject({ url: '/api/auth/csrf' });
    const token = csrf.json().token;
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      headers: {
        origin: 'http://localhost:8080',
        'x-csrf-token': token,
        cookie: `sw_csrf=${token}`,
      },
      payload: { email: 'x@example.com' },
    });

    expect(response.statusCode).toBe(503);
  });
  it('publishes OpenAPI schemas and does not enable cross-origin reads', async () => {
    const res = await app.inject({
      url: '/api/docs/json',
      headers: { origin: 'https://attacker.test' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().paths['/api/garments'].post.requestBody).toBeDefined();
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
