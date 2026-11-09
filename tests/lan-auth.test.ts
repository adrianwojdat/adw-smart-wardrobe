import { beforeAll, afterAll, expect, it } from 'vitest';
import { buildApp } from '../apps/api/src/app';
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  app = await buildApp({
    NODE_ENV: 'test',
    PORT: 3000,
    APP_ORIGIN: 'http://localhost:8080',
    APP_ADDITIONAL_ORIGINS: 'http://192.168.0.217:8080',
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
it('accepts LAN and localhost with CSRF, reaching body validation without authentication calls', async () => {
  const csrf = await app.inject({ url: '/api/auth/csrf' });
  const token = csrf.json().token;
  expect(csrf.headers['set-cookie']).not.toContain('; Secure');
  for (const origin of ['http://192.168.0.217:8080', 'http://localhost:8080']) {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin, 'x-csrf-token': token },
      cookies: { sw_csrf: token },
      payload: {},
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toBe('Sprawdź poprawność wprowadzonych danych.');
  }
});
it('still rejects foreign origins and LAN requests missing CSRF', async () => {
  const csrf = await app.inject({ url: '/api/auth/csrf' });
  const token = csrf.json().token;
  const foreign = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: 'http://evil.example', 'x-csrf-token': token },
    cookies: { sw_csrf: token },
    payload: {},
  });
  expect(foreign.statusCode).toBe(403);
  const noCsrf = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: 'http://192.168.0.217:8080' },
    payload: {},
  });
  expect(noCsrf.statusCode).toBe(403);
});
