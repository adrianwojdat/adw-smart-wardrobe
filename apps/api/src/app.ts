import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import {
  registerSchema,
  loginSchema,
  wardrobeInput,
  garmentInput,
  uuid,
  occasions,
  outfitInput,
  recommend,
  garmentSchema,
} from '@wardrobe/shared';
import { sessions, HttpError, hash } from './session.js';
import type { Config } from './config.js';
const idParams = z.object({ id: uuid });
function checked<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) {
    const code = (result.error as { code?: string }).code;
    throw new HttpError(
      code === 'PGRST116' ? 404 : code === '42501' ? 403 : 400,
      'Nie można wykonać tej operacji. Sprawdź dane i uprawnienia.',
    );
  }
  if (result.data == null) throw new HttpError(404, 'Nie znaleziono zasobu.');
  return result.data as NonNullable<T>;
}
export async function buildApp(config: Config) {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: 'info',
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
            ],
          },
    bodyLimit: 1024 * 1024,
    trustProxy: (_address, hop) => hop < 1,
    disableRequestLogging: true,
  }).withTypeProvider<ZodTypeProvider>();
  const session = sessions(config);
  session.pool.on('error', () =>
    app.log.error('Session database connection lost; pool will reconnect'),
  );
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Smart Wardrobe API', version: '0.1.0' },
      servers: [{ url: config.APP_ORIGIN }],
      components: {
        securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'sw_session' } },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store, private');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.headers.origin !== config.APP_ORIGIN)
        throw new HttpError(403, 'Nieprawidłowe źródło żądania.');
      const expected = req.cookies.sw_csrf,
        provided = req.headers['x-csrf-token'];
      if (
        !expected ||
        typeof provided !== 'string' ||
        expected.length !== provided.length ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
      )
        throw new HttpError(403, 'Odśwież stronę i spróbuj ponownie.');
    }
  });
  app.setErrorHandler((error, _req, reply) => {
    const err = error as Error & { statusCode?: number; validation?: unknown; code?: string };
    const status = err.validation ? 400 : (err.statusCode ?? 500);
    if (status >= 500) app.log.error({ name: err.name, code: err.code }, 'Request failed');
    reply.code(status).send({
      message: err.validation
        ? 'Sprawdź poprawność wprowadzonych danych.'
        : status >= 500 && !(err instanceof HttpError)
          ? 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.'
          : err.message,
    });
  });
  app.get('/api/health', { schema: { tags: ['system'] } }, async () => {
    await session.pool.query('select 1');
    return { status: 'ok' };
  });
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
  app.get('/api/config', async () => ({
    smtpConfigured: !!config.SMTP_ENABLED,
    emailConfirmation: config.EMAIL_AUTOCONFIRM !== 'true',
  }));
  const authRate = { rateLimit: { max: 10, timeWindow: '1 minute' } };
  app.post(
    '/api/auth/register',
    { config: authRate, schema: { body: registerSchema, tags: ['auth'] } },
    async (req, reply) => {
      if (config.EMAIL_AUTOCONFIRM !== 'true' && !config.SMTP_ENABLED)
        throw new HttpError(503, 'Administrator musi skonfigurować SMTP przed rejestracją.');
      const { data, error } = await session.auth().auth.signUp({
        email: req.body.email,
        password: req.body.password,
        options: { data: { name: req.body.name } },
      });
      if (error)
        throw new HttpError(400, 'Nie udało się utworzyć konta. Sprawdź dane lub zaloguj się.');
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
      const { data, error } = await session.auth().auth.signInWithPassword(req.body);
      if (error || !data.session) throw new HttpError(401, 'Nieprawidłowy email lub hasło.');
      await session.clear(req, reply);
      await session.save(reply, data.session);
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
        throw new HttpError(
          503,
          'Wysyłka email nie jest skonfigurowana. Skontaktuj się z administratorem.',
        );
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
      if (changed.error) throw new HttpError(400, 'Nie udało się zmienić hasła.');
      // Revoke every local session; sign out the provider session too.
      await client.auth.signOut({ scope: 'global' });
      await session.pool.query('delete from private.sessions where user_id=$1', [tokens.user.id]);
      await session.clear(req, reply);
      return { ok: true };
    },
  );
  app.patch(
    '/api/profile',
    { schema: { body: z.object({ name: z.string().trim().min(1).max(120) }) } },
    async (req, reply) => {
      const { sb, user } = await session.load(req, reply);
      return checked(
        await sb.from('profiles').update(req.body).eq('id', user.id).select().single(),
      );
    },
  );
  app.get('/api/wardrobes', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    return checked(await sb.from('wardrobes').select('*').order('created_at'));
  });
  app.post(
    '/api/wardrobes',
    { schema: { body: wardrobeInput, tags: ['wardrobes'] } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return checked(await sb.from('wardrobes').insert(req.body).select().single());
    },
  );
  app.patch(
    '/api/wardrobes/:id',
    { schema: { params: idParams, body: wardrobeInput.pick({ name: true }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return checked(
        await sb.from('wardrobes').update(req.body).eq('id', req.params.id).select().single(),
      );
    },
  );
  app.get('/api/wardrobes/:id/members', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    return checked(await sb.from('wardrobe_members').select('*').eq('wardrobe_id', req.params.id));
  });
  app.patch(
    '/api/wardrobes/:id/members/:userId',
    {
      schema: {
        params: idParams.extend({ userId: uuid }),
        body: z.object({ role: z.enum(['editor', 'viewer']) }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return checked(
        await sb
          .from('wardrobe_members')
          .update(req.body)
          .eq('wardrobe_id', req.params.id)
          .eq('user_id', req.params.userId)
          .select()
          .single(),
      );
    },
  );
  app.delete(
    '/api/wardrobes/:id/members/:userId',
    { schema: { params: idParams.extend({ userId: uuid }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      checked(
        await sb
          .from('wardrobe_members')
          .delete()
          .eq('wardrobe_id', req.params.id)
          .eq('user_id', req.params.userId)
          .select()
          .single(),
      );
      return { ok: true };
    },
  );
  app.post(
    '/api/wardrobes/:id/invitations',
    {
      schema: {
        params: idParams,
        body: z.object({ email: z.email(), role: z.enum(['editor', 'viewer']) }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const token = randomBytes(32).toString('base64url');
      checked(
        await sb
          .from('invitations')
          .insert({
            ...req.body,
            email: req.body.email.toLowerCase(),
            wardrobe_id: req.params.id,
            token_hash: hash(token),
          })
          .select()
          .single(),
      );
      return { url: config.APP_ORIGIN + '/family?invite=' + token };
    },
  );
  app.post(
    '/api/invitations/accept',
    { schema: { body: z.object({ token: z.string().min(20).max(100) }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return {
        wardrobe_id: checked(await sb.rpc('accept_invitation', { token: hash(req.body.token) })),
      };
    },
  );
  app.get(
    '/api/garments',
    {
      schema: {
        querystring: z.object({
          wardrobe_id: uuid.optional(),
          search: z.string().max(120).optional(),
          category: z
            .enum([
              'all',
              ...(['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'] as const),
            ])
            .optional(),
          archived: z.enum(['true', 'false']).default('false'),
          offset: z.coerce.number().int().min(0).default(0),
        }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      let query = sb
        .from('garments')
        .select('*,garment_images(*)')
        .eq('archived', req.query.archived === 'true')
        .order('created_at', { ascending: false })
        .range(req.query.offset, req.query.offset + 99);
      if (req.query.wardrobe_id) query = query.eq('wardrobe_id', req.query.wardrobe_id);
      if (req.query.search)
        query = query.ilike('name', '%' + req.query.search.replace(/[%_\\]/g, '\\$&') + '%');
      if (req.query.category && req.query.category !== 'all')
        query = query.eq('category', req.query.category);
      return checked(await query);
    },
  );
  app.post(
    '/api/garments',
    { schema: { body: garmentInput, tags: ['garments'] } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return checked(
        await sb.from('garments').insert(req.body).select('*,garment_images(*)').single(),
      );
    },
  );
  app.get('/api/garments/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    return checked(
      await sb.from('garments').select('*,garment_images(*)').eq('id', req.params.id).single(),
    );
  });
  app.patch(
    '/api/garments/:id',
    { schema: { params: idParams, body: garmentInput.partial() } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return checked(
        await sb
          .from('garments')
          .update(req.body)
          .eq('id', req.params.id)
          .select('*,garment_images(*)')
          .single(),
      );
    },
  );
  app.delete('/api/garments/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const g = checked(
      await sb
        .from('garments')
        .select('wardrobe_id,garment_images(path)')
        .eq('id', req.params.id)
        .single(),
    );
    if (!checked(await sb.rpc('has_wardrobe_access', { w: g.wardrobe_id, editing: true })))
      throw new HttpError(403, 'Brak uprawnień do edycji.');
    const paths = g.garment_images.map((i: { path: string }) => i.path);
    if (paths.length) checked(await sb.storage.from('garments').remove(paths));
    checked(await sb.from('garments').delete().eq('id', req.params.id).select('id').single());
    return { ok: true };
  });
  app.post(
    '/api/garments/:id/images',
    {
      schema: {
        params: idParams,
        querystring: z.object({ kind: z.enum(['garment', 'label']).default('garment') }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const garment = checked(
        await sb.from('garments').select('id,wardrobe_id').eq('id', req.params.id).single(),
      );
      if (!checked(await sb.rpc('has_wardrobe_access', { w: garment.wardrobe_id, editing: true })))
        throw new HttpError(403, 'Brak uprawnień do edycji.');
      const images = checked(
        await sb.from('garment_images').select('id').eq('garment_id', garment.id),
      );
      if (images.length >= 12) throw new HttpError(400, 'Maksymalnie 12 zdjęć na ubranie.');
      const file = await req.file();
      if (!file) throw new HttpError(400, 'Wybierz zdjęcie.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
        throw new HttpError(400, 'Dozwolone formaty: JPEG, PNG, WebP.');
      const input = await file.toBuffer();
      let output: Buffer;
      let width: number;
      let height: number;
      try {
        const source = sharp(input, { limitInputPixels: 40_000_000, animated: false });
        const meta = await source.metadata();
        if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1)
          throw Error('format');
        const result = await source
          .rotate()
          .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 86 })
          .toBuffer({ resolveWithObject: true });
        output = result.data;
        width = result.info.width;
        height = result.info.height;
      } catch {
        throw new HttpError(400, 'Nieprawidłowy obraz lub zbyt duża rozdzielczość (maks. 40 MP).');
      }
      const path = `${garment.wardrobe_id}/${garment.id}/${randomBytes(16).toString('hex')}.webp`;
      checked(
        await sb.storage
          .from('garments')
          .upload(path, output, { contentType: 'image/webp', upsert: false }),
      );
      const inserted = await sb
        .from('garment_images')
        .insert({
          garment_id: garment.id,
          wardrobe_id: garment.wardrobe_id,
          path,
          kind: req.query.kind,
          width,
          height,
        })
        .select()
        .single();
      if (inserted.error) {
        await sb.storage.from('garments').remove([path]);
        throw new HttpError(400, 'Nie udało się zapisać zdjęcia.');
      }
      const img = checked(inserted);
      checked(
        await sb
          .from('jobs')
          .insert({
            wardrobe_id: garment.wardrobe_id,
            garment_id: garment.id,
            image_id: img.id,
            type: 'process_image',
          })
          .select()
          .single(),
      );
      return img;
    },
  );
  app.get('/api/images/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const img = checked(
      await sb.from('garment_images').select('path').eq('id', req.params.id).single(),
    );
    const blob = checked(await sb.storage.from('garments').download(img.path));
    return reply
      .header('Content-Type', 'image/webp')
      .header('Content-Disposition', 'inline')
      .send(Buffer.from(await blob.arrayBuffer()));
  });
  app.delete('/api/images/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const img = checked(
      await sb.from('garment_images').select('path,wardrobe_id').eq('id', req.params.id).single(),
    );
    if (!checked(await sb.rpc('has_wardrobe_access', { w: img.wardrobe_id, editing: true })))
      throw new HttpError(403, 'Brak uprawnień.');
    checked(await sb.storage.from('garments').remove([img.path]));
    checked(await sb.from('garment_images').delete().eq('id', req.params.id).select().single());
    return { ok: true };
  });
  app.get(
    '/api/jobs',
    { schema: { querystring: z.object({ garment_id: uuid }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return checked(
        await sb
          .from('jobs')
          .select('*')
          .eq('garment_id', req.query.garment_id)
          .order('created_at', { ascending: false })
          .limit(20),
      );
    },
  );
  app.post('/api/jobs/:id/retry', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    return checked(await sb.rpc('retry_job', { job_id: req.params.id }));
  });
  app.post(
    '/api/recommendations',
    {
      schema: {
        body: z.object({
          wardrobe_id: uuid,
          occasion: z.enum(occasions),
          temperature: z.number().min(-40).max(55).default(18),
        }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const data = checked(
        await sb
          .from('garments')
          .select('*,garment_images(*)')
          .eq('wardrobe_id', req.body.wardrobe_id)
          .eq('cleanliness', 'clean')
          .eq('archived', false)
          .limit(500),
      );
      return {
        source: 'rules',
        outfits: recommend(
          z.array(garmentSchema).parse(data),
          req.body.occasion,
          req.body.temperature,
        ),
      };
    },
  );
  app.get('/api/outfits', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const data = checked(
      await sb
        .from('outfits')
        .select('*,outfit_garments(garment_id)')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    return data.map((o) => ({
      ...o,
      garment_ids: o.outfit_garments.map((g: { garment_id: string }) => g.garment_id),
    }));
  });
  app.post('/api/outfits', { schema: { body: outfitInput } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    return checked(await sb.rpc('save_outfit', { payload: req.body }));
  });
  app.delete('/api/outfits/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    checked(await sb.from('outfits').delete().eq('id', req.params.id).select().single());
    return { ok: true };
  });
  app.post(
    '/api/garments/:id/wear',
    { schema: { params: idParams, body: z.object({ worn_on: z.iso.date() }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      return checked(
        await sb.rpc('record_wear', { garment: req.params.id, day: req.body.worn_on }),
      );
    },
  );
  app.get('/api/garments/:id/history', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    return checked(
      await sb
        .from('wear_history')
        .select('*')
        .eq('garment_id', req.params.id)
        .order('worn_on', { ascending: false })
        .limit(100),
    );
  });
  app.addHook('onClose', async () => session.close());
  return app;
}
