import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../apps/api/src/app';
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
    SMTP_ENABLED: '',
    EMAIL_AUTOCONFIRM: 'true',
  });
});
afterAll(async () => {
  await app.close();
});
describe('BFF authorization and validation', () => {
  it('rejects unauthenticated access before database access', async () => {
    for (const url of ['/api/auth/me', '/api/wardrobes', '/api/garments']) {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(401);
      expect(res.headers['cache-control']).toContain('no-store');
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
