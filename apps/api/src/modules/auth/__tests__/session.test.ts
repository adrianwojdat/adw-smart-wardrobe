import cookie from '@fastify/cookie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configSchema } from '../../../app/config.js';
import { createApiServer } from '../../../app/server.js';

import { registerAuthRoutes } from '../routes.js';
import { decrypt, encrypt, HttpError, sessions } from '../session.js';

const state = vi.hoisted(() => {
  const user = {
    id: 'a7000000-0000-4000-8000-000000000001',
    email: 'fixture@example.invalid',
    app_metadata: {},
    user_metadata: { name: 'Fixture' },
    aud: 'authenticated',
    created_at: '2026-11-14',
  };
  const providerSession = {
    access_token: 'fixture-access',
    refresh_token: 'fixture-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };

  return {
    user,
    providerSession,
    exists: true,
    tokens: '',
    expiry: new Date(),
    query:
      vi.fn<
        (
          sql: string,
          values?: unknown[],
        ) => Promise<{ rows: { tokens: string; expires_at: Date }[]; rowCount: number }>
      >(),
    release: vi.fn(),
    getUser:
      vi.fn<
        () => Promise<{ data: { user: typeof user | null }; error: { status: number } | null }>
      >(),
    refresh: vi.fn<
      () => Promise<{
        data: { session: typeof providerSession | null };
        error: { status: number } | null;
      }>
    >(),
    signIn: vi.fn(),
  };
});

vi.mock('pg', () => ({
  default: {
    Pool: class {
      on() {}
      query = state.query;
      connect() {
        return Promise.resolve({ query: state.query, release: state.release });
      }
      end() {
        return Promise.resolve();
      }
    },
  },
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: state.getUser,
      refreshSession: state.refresh,
      signInWithPassword: state.signIn,
    },
  }),
}));

const config = configSchema.parse({
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://localhost:8080',
  COOKIE_SECURE: 'false',
  SUPABASE_URL: 'http://localhost:1',
  SUPABASE_ANON_KEY: 'a'.repeat(40),
  SESSION_DATABASE_URL: 'postgres://unused',
  SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
});
let manager: ReturnType<typeof sessions>;
let app: ReturnType<typeof createApiServer>['app'];

beforeEach(async () => {
  vi.clearAllMocks();
  state.exists = true;
  state.expiry = new Date(Date.now() + 30 * 86400000);
  state.tokens = encrypt(
    JSON.stringify({ ...state.providerSession, remember_me: true }),
    config.SESSION_ENCRYPTION_KEY,
  );
  state.getUser.mockResolvedValue({ data: { user: state.user }, error: null });
  state.refresh.mockResolvedValue({
    data: {
      session: {
        ...state.providerSession,
        access_token: 'fresh-access',
        refresh_token: 'rotated-refresh',
      },
    },
    error: null,
  });
  state.signIn.mockResolvedValue({
    data: { user: state.user, session: state.providerSession },
    error: null,
  });
  state.query.mockImplementation((sql, values = []) => {
    if (sql.startsWith('select tokens'))
      return Promise.resolve({
        rows:
          state.exists && state.expiry.getTime() > Date.now()
            ? [{ tokens: state.tokens, expires_at: state.expiry }]
            : [],
        rowCount: state.exists && state.expiry.getTime() > Date.now() ? 1 : 0,
      });

    if (sql.startsWith('insert into')) {
      if (typeof values[2] !== 'string' || typeof values[3] !== 'number')
        throw new Error('Invalid fixture write');
      state.tokens = values[2];
      state.expiry = new Date(Date.now() + values[3] * 1000);
    }

    if (sql.startsWith('update private.sessions set tokens')) {
      if (typeof values[0] !== 'string') throw new Error('Invalid token write');
      state.tokens = values[0];
    }

    if (sql.startsWith('update private.sessions set expires_at'))
      state.expiry = new Date(Date.now() + 30 * 86400000);
    if (sql.startsWith('delete')) state.exists = false;

    return Promise.resolve({ rows: [], rowCount: 1 });
  });
  manager = sessions(config);
  app = createApiServer(config).app;
  await app.register(cookie);
  app.setErrorHandler((error, _req, reply) =>
    reply.code(error instanceof HttpError ? error.statusCode : 500).send({ ok: false }),
  );
  registerAuthRoutes(app, config, manager);
  app.get('/test/me', async (req, reply) => ({ id: (await manager.load(req, reply)).user.id }));
  app.post('/test/logout', async (req, reply) => {
    await manager.clear(req, reply);

    return { ok: true };
  });
});
afterEach(async () => {
  await app.close();
  await manager.close();
});

function cookieText(response: { headers: { 'set-cookie'?: string | string[] } }) {
  const h = response.headers['set-cookie'];

  return Array.isArray(h) ? h.join('\n') : (h ?? '');
}

const reqCookie = { cookie: 'sw_session=fixture-opaque-id' };

describe('remembered opaque sessions', () => {
  it.each([true, false])(
    'persists the login choice %s only in encrypted server storage',
    async (rememberMe) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: state.user.email, password: 'fixture-password', rememberMe },
      });

      expect(response.statusCode).toBe(200);
      expect(state.signIn).toHaveBeenCalledWith({
        email: state.user.email,
        password: 'fixture-password',
      });
      expect(cookieText(response)).toContain('HttpOnly');
      expect(cookieText(response)).toContain('SameSite=Lax');
      if (rememberMe) expect(cookieText(response)).toContain('Max-Age=2592000');
      else expect(cookieText(response)).not.toContain('Max-Age=');
      expect(JSON.parse(decrypt(state.tokens, config.SESSION_ENCRYPTION_KEY))).toMatchObject({
        remember_me: rememberMe,
      });
      expect(state.tokens).not.toContain('fixture-refresh');
      expect(response.body).not.toContain('fixture-refresh');
      expect(Math.round((state.expiry.getTime() - Date.now()) / 1000)).toBe(
        rememberMe ? 2592000 : 43200,
      );
    },
  );
  it('renews a remembered session daily and keeps its opaque identifier', async () => {
    state.expiry = new Date(Date.now() + 27 * 86400000);

    const response = await app.inject({ url: '/test/me', headers: reqCookie });

    expect(response.statusCode).toBe(200);
    expect(cookieText(response)).toContain('sw_session=fixture-opaque-id');
    expect(cookieText(response)).toContain('Max-Age=2592000');
  });
  it('does not set a persistent cookie for a browser-only session on token refresh', async () => {
    state.tokens = encrypt(
      JSON.stringify({ ...state.providerSession, expires_at: 0, remember_me: false }),
      config.SESSION_ENCRYPTION_KEY,
    );
    state.expiry = new Date(Date.now() + 3600000);

    const response = await app.inject({ url: '/test/me', headers: reqCookie });

    expect(response.statusCode).toBe(200);
    expect(cookieText(response)).toBe('');
    expect(JSON.parse(decrypt(state.tokens, config.SESSION_ENCRYPTION_KEY))).toMatchObject({
      remember_me: false,
      refresh_token: 'rotated-refresh',
    });
  });
  it('refreshes expired access tokens under a row lock and saves rotated credentials', async () => {
    state.tokens = encrypt(
      JSON.stringify({ ...state.providerSession, expires_at: 0 }),
      config.SESSION_ENCRYPTION_KEY,
    );
    expect((await app.inject({ url: '/test/me', headers: reqCookie })).statusCode).toBe(200);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(state.query.mock.calls.some(([sql]) => sql.includes('for update'))).toBe(true);
    expect((await app.inject({ url: '/test/me', headers: reqCookie })).statusCode).toBe(200);
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });
  it.each([429, 503])('keeps the session on temporary user lookup failure %s', async (status) => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: { status } });

    const response = await app.inject({ url: '/test/me', headers: reqCookie });

    expect(response.statusCode).toBe(503);
    expect(cookieText(response)).toBe('');
    expect(state.exists).toBe(true);
  });
  it('keeps encrypted credentials on a temporary refresh failure', async () => {
    state.tokens = encrypt(
      JSON.stringify({ ...state.providerSession, expires_at: 0 }),
      config.SESSION_ENCRYPTION_KEY,
    );

    const before = state.tokens;

    state.refresh.mockResolvedValue({ data: { session: null }, error: { status: 503 } });

    const response = await app.inject({ url: '/test/me', headers: reqCookie });

    expect(response.statusCode).toBe(503);
    expect(state.tokens).toBe(before);
    expect(state.exists).toBe(true);
    expect(cookieText(response)).toBe('');
  });
  it('rejects revoked or expired sessions and removes the browser cookie', async () => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });

    const response = await app.inject({ url: '/test/me', headers: reqCookie });

    expect(response.statusCode).toBe(401);
    expect(cookieText(response)).toContain('Expires=');
    expect(state.exists).toBe(false);
  });
  it('does not revive expired database sessions', async () => {
    state.expiry = new Date(Date.now() - 1000);
    expect((await app.inject({ url: '/test/me', headers: reqCookie })).statusCode).toBe(401);
    expect(state.refresh).not.toHaveBeenCalled();
  });
  it('retains compatibility with encrypted sessions created before remember me', async () => {
    state.tokens = encrypt(JSON.stringify(state.providerSession), config.SESSION_ENCRYPTION_KEY);
    state.expiry = new Date(Date.now() + 27 * 86400000);

    const response = await app.inject({ url: '/test/me', headers: reqCookie });

    expect(response.statusCode).toBe(200);
    expect(cookieText(response)).toContain('Max-Age=2592000');
  });
  it('explicit logout deletes the server session and clears the cookie', async () => {
    const response = await app.inject({ method: 'POST', url: '/test/logout', headers: reqCookie });

    expect(response.statusCode).toBe(200);
    expect(state.exists).toBe(false);
    expect(cookieText(response)).toContain('Expires=');
  });
});
