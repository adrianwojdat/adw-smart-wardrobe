import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createClient, type Session } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import pg from 'pg';
import type { Config } from './config.js';
export function encrypt(text: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]).toString(
    'base64url',
  );
}
export function decrypt(text: string, key: string) {
  const bytes = Buffer.from(text, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString();
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
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
    maxAge: 30 * 86400,
  };
  async function save(reply: FastifyReply, session: Session) {
    const id = randomBytes(32).toString('base64url');
    await pool.query(
      "insert into private.sessions(id_hash,user_id,tokens,expires_at) values($1,$2,$3,now()+interval '30 days')",
      [hash(id), session.user.id, encrypt(JSON.stringify(session), config.SESSION_ENCRYPTION_KEY)],
    );
    reply.setCookie('sw_session', id, cookie);
  }
  async function clear(request: FastifyRequest, reply: FastifyReply) {
    const id = request.cookies.sw_session;
    if (id) await pool.query('delete from private.sessions where id_hash=$1', [hash(id)]);
    reply.clearCookie('sw_session', { path: '/', secure: config.COOKIE_SECURE, sameSite: 'lax' });
  }
  async function load(request: FastifyRequest, reply: FastifyReply) {
    const id = request.cookies.sw_session;
    if (!id) throw new HttpError(401, 'Zaloguj się, aby kontynuować.');
    const conn = await pool.connect();
    try {
      await conn.query('begin');
      const result = await conn.query(
        'select tokens from private.sessions where id_hash=$1 and expires_at>now() for update',
        [hash(id)],
      );
      if (!result.rowCount) throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.');
      let session = JSON.parse(
        decrypt(result.rows[0].tokens, config.SESSION_ENCRYPTION_KEY),
      ) as Session;
      if (!session.expires_at || session.expires_at < Date.now() / 1000 + 60) {
        const refreshed = await auth().auth.refreshSession({
          refresh_token: session.refresh_token,
        });
        if (refreshed.error || !refreshed.data.session)
          throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.');
        session = refreshed.data.session;
        await conn.query('update private.sessions set tokens=$1 where id_hash=$2', [
          encrypt(JSON.stringify(session), config.SESSION_ENCRYPTION_KEY),
          hash(id),
        ]);
      }
      await conn.query('commit');
      const sb = userClient(session.access_token);
      const { data, error } = await sb.auth.getUser(session.access_token);
      if (error || !data.user) throw new HttpError(401, 'Sesja jest nieważna.');
      return { sb, user: data.user, session };
    } catch (e) {
      await conn.query('rollback');
      if (e instanceof HttpError && e.statusCode === 401)
        reply.clearCookie('sw_session', { path: '/' });
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
