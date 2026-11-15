import { createClient, type Session } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';

import type { Config } from '../../app/config.js';

import { decrypt, encrypt, hash } from './session-crypto.js';

export { decrypt, encrypt, hash } from './session-crypto.js';
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
type StoredSession = Session & { remember_me?: boolean };

const rememberedSeconds = 30 * 86400;
const browserSeconds = 12 * 3600;

function authFailure(error: { status?: number } | null) {
  const invalid = error && [400, 401, 403].includes(error.status ?? 0);

  return new HttpError(
    invalid ? 401 : 503,
    invalid
      ? 'Your session has expired. Sign in again.'
      : 'Sign-in is temporarily unavailable. Try again later.',
  );
}

export function sessions(config: Config) {
  const pool = new pg.Pool({
    connectionString: config.SESSION_DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  const auth = () =>
    createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  const userClient = (token: string) =>
    createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  const cookie = {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
  };

  async function save(reply: FastifyReply, session: Session, rememberMe = true) {
    const id = randomBytes(32).toString('base64url');

    await pool.query(
      "insert into private.sessions(id_hash,user_id,tokens,expires_at) values($1,$2,$3,now()+$4*interval '1 second')",
      [
        hash(id),
        session.user.id,
        encrypt(
          JSON.stringify({ ...session, remember_me: rememberMe }),
          config.SESSION_ENCRYPTION_KEY,
        ),
        rememberMe ? rememberedSeconds : browserSeconds,
      ],
    );
    reply.setCookie('sw_session', id, {
      ...cookie,
      ...(rememberMe ? { maxAge: rememberedSeconds } : {}),
    });
  }

  async function clear(request: FastifyRequest, reply: FastifyReply) {
    const id = request.cookies.sw_session;

    if (id) await pool.query('delete from private.sessions where id_hash=$1', [hash(id)]);
    reply.clearCookie('sw_session', { path: '/', secure: config.COOKIE_SECURE, sameSite: 'lax' });
  }

  async function load(request: FastifyRequest, reply: FastifyReply) {
    const id = request.cookies.sw_session;

    if (!id) throw new HttpError(401, 'Sign in to continue.');

    const conn = await pool.connect();

    try {
      await conn.query('begin');

      const result = await conn.query(
        'select tokens,expires_at from private.sessions where id_hash=$1 and expires_at>now() for update',
        [hash(id)],
      );

      if (!result.rowCount) throw new HttpError(401, 'Your session has expired. Sign in again.');

      const row = z
        .object({ tokens: z.string(), expires_at: z.union([z.date(), z.string()]) })
        .parse(result.rows[0]);
      let session = JSON.parse(decrypt(row.tokens, config.SESSION_ENCRYPTION_KEY)) as StoredSession;
      // Old encrypted payloads predate the checkbox and retain their persistent behavior.
      const rememberMe = session.remember_me ?? true;

      if (!session.expires_at || session.expires_at < Date.now() / 1000 + 60) {
        const refreshed = await auth().auth.refreshSession({
          refresh_token: session.refresh_token,
        });

        if (refreshed.error || !refreshed.data.session) throw authFailure(refreshed.error);
        session = { ...refreshed.data.session, remember_me: rememberMe };
        await conn.query('update private.sessions set tokens=$1 where id_hash=$2', [
          encrypt(JSON.stringify(session), config.SESSION_ENCRYPTION_KEY),
          hash(id),
        ]);
      }

      await conn.query('commit');

      const sb = userClient(session.access_token);
      const { data, error } = await sb.auth.getUser(session.access_token);

      if (error || !data.user) throw authFailure(error);

      // Renew at most daily; expired/revoked sessions cannot be revived by this update.
      if (rememberMe && new Date(row.expires_at).getTime() < Date.now() + 29 * 86400000) {
        const renewed = await pool.query(
          "update private.sessions set expires_at=now()+interval '30 days' where id_hash=$1 and expires_at>now()",
          [hash(id)],
        );

        if (!renewed.rowCount) throw new HttpError(401, 'Your session has expired. Sign in again.');
        reply.setCookie('sw_session', id, { ...cookie, maxAge: rememberedSeconds });
      }

      return { sb, user: data.user, session };
    } catch (e) {
      await conn.query('rollback');

      if (e instanceof HttpError && e.statusCode === 401) {
        await pool.query('delete from private.sessions where id_hash=$1', [hash(id)]);
        reply.clearCookie('sw_session', {
          path: '/',
          secure: config.COOKIE_SECURE,
          sameSite: 'lax',
        });
      }

      throw e;
    } finally {
      conn.release();
    }
  }

  const cleanup = setInterval(() => {
    void pool.query('delete from private.sessions where expires_at<now()').catch(() => {});
  }, 3600000);

  cleanup.unref();

  return {
    pool,
    auth,
    save,
    clear,
    load,
    close: async () => {
      clearInterval(cleanup);
      await pool.end();
    },
  };
}

export type SessionService = ReturnType<typeof sessions>;
