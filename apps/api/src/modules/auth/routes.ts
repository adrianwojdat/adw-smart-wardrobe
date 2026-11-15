import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import { loginSchema, registerSchema } from '@wardrobe/shared';

import type { Config } from '../../app/config.js';
import type { ApiServer } from '../../app/server.js';
import { checked } from '../../lib/route-utils.js';

import type { SessionService } from './session.js';
import { HttpError } from './session.js';

export function registerAuthRoutes(app: ApiServer, config: Config, session: SessionService) {
  const authRate = { rateLimit: { max: 10, timeWindow: '1 minute' } };

  app.get('/api/auth/csrf', async (_req, reply) => {
    const token = randomBytes(32).toString('hex');

    reply.setCookie('sw_csrf', token, {
      httpOnly: false,
      secure: config.COOKIE_SECURE,
      sameSite: 'strict',
      path: '/',
    });

    return { token };
  });
  app.post(
    '/api/auth/register',
    { config: authRate, schema: { body: registerSchema, tags: ['auth'] } },
    async (req, reply) => {
      if (config.EMAIL_AUTOCONFIRM !== 'true' && !config.SMTP_ENABLED)
        throw new HttpError(503, 'The administrator must configure SMTP before registration.');

      const { data, error } = await session.auth().auth.signUp({
        email: req.body.email,
        password: req.body.password,
        options: { data: { name: req.body.name } },
      });

      if (error)
        throw new HttpError(400, 'Failed to create the account. Check the input or sign in.');

      if (data.session) {
        await session.clear(req, reply);
        await session.save(reply, data.session);
      }

      return { confirmationRequired: !data.session };
    },
  );
  app.post(
    '/api/auth/login',
    { config: authRate, schema: { body: loginSchema, tags: ['auth'] } },
    async (req, reply) => {
      const body = loginSchema.parse(req.body);
      const { data, error } = await session
        .auth()
        .auth.signInWithPassword({ email: body.email, password: body.password });

      if (error || !data.session) throw new HttpError(401, 'Invalid email address or password.');
      await session.clear(req, reply);
      await session.save(reply, data.session, body.rememberMe ?? true);

      return {
        id: data.user.id,
        email: data.user.email ?? '',
        name: data.user.user_metadata.name ?? '',
      };
    },
  );
  app.get('/api/auth/me', { schema: { tags: ['auth'] } }, async (req, reply) => {
    const { sb, user } = await session.load(req, reply);
    const profile = checked(await sb.from('profiles').select('name').eq('id', user.id).single());

    return { id: user.id, email: user.email ?? '', name: profile.name };
  });
  app.post('/api/auth/refresh', { schema: { tags: ['auth'] } }, async (req, reply) => {
    await session.load(req, reply);

    return { ok: true };
  });
  app.post('/api/auth/logout', async (req, reply) => {
    try {
      const { session: tokens } = await session.load(req, reply);
      const client = session.auth();

      await client.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      await client.auth.signOut({ scope: 'local' });
    } catch {
      /* Local logout must always clear the opaque session. */
    }

    await session.clear(req, reply);
    reply.clearCookie('sw_csrf', { path: '/' });
    reply.header('Clear-Site-Data', '"cache"');

    return { ok: true };
  });
  app.post(
    '/api/auth/forgot-password',
    { config: authRate, schema: { body: z.object({ email: z.email() }) } },
    async (req) => {
      if (!config.SMTP_ENABLED)
        throw new HttpError(503, 'Email delivery is not configured. Contact the administrator.');
      await session.auth().auth.resetPasswordForEmail(req.body.email, {
        redirectTo: config.APP_ORIGIN + '/reset-password',
      });

      return { ok: true };
    },
  );
  app.get(
    '/api/auth/verify',
    {
      config: authRate,
      schema: {
        querystring: z.object({
          token: z.string().min(1).max(2048),
          type: z.enum(['signup', 'recovery', 'invite', 'email_change']),
          redirect_to: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const result = await session
        .auth()
        .auth.verifyOtp({ token_hash: req.query.token, type: req.query.type });

      if (result.error || !result.data.session)
        return reply.redirect(config.APP_ORIGIN + '/login?expired=1');
      await session.clear(req, reply);
      await session.save(reply, result.data.session);

      return reply.redirect(
        config.APP_ORIGIN + (req.query.type === 'recovery' ? '/reset-password' : '/dashboard'),
      );
    },
  );
  app.post(
    '/api/auth/password',
    { config: authRate, schema: { body: registerSchema.pick({ password: true }) } },
    async (req, reply) => {
      const { session: tokens } = await session.load(req, reply);
      const client = session.auth();

      checked(
        await client.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        }),
      );

      const changed = await client.auth.updateUser({ password: req.body.password });

      if (changed.error) throw new HttpError(400, 'Failed to change the password.');
      // Revoke every local session; sign out the provider session too.
      await client.auth.signOut({ scope: 'global' });
      await session.pool.query('delete from private.sessions where user_id=$1', [tokens.user.id]);
      await session.clear(req, reply);

      return { ok: true };
    },
  );
}
