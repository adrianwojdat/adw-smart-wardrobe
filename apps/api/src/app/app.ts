import { uuid } from '@wardrobe/shared';

import { registerAuthRoutes } from '../modules/auth/routes.js';
import { HttpError, sessions } from '../modules/auth/session.js';
import { registerCustomPropertyRoutes } from '../modules/garments/custom-properties/routes.js';
import { registerGarmentRoutes } from '../modules/garments/routes.js';
import { registerGeminiRoutes } from '../modules/gemini/routes.js';
import { registerImageRoutes } from '../modules/images/routes.js';
import { registerJobRoutes } from '../modules/jobs/routes.js';
import { registerOutfitRoutes } from '../modules/outfits/routes.js';
import { registerProfileRoutes } from '../modules/profile/routes.js';
import { registerQueueBoard } from '../modules/queues/queue-board.js';
import { registerQueueControls } from '../modules/queues/queue-controls.js';
import { registerWardrobeRoutes } from '../modules/wardrobes/routes.js';
import type { Config } from './config.js';
import { createApiServer } from './server.js';

export { validatePropertyValue } from '../modules/garments/custom-properties/routes.js';

export async function buildApp(config: Config) {
  const server = createApiServer(config);
  const { app } = server;
  const session = sessions(config);

  session.pool.on('error', () =>
    app.log.error('Session database connection lost; pool will reconnect'),
  );
  await server.registerSecurity();
  app.setErrorHandler((error, _req, reply) => {
    const err = error as Error & { statusCode?: number; validation?: unknown; code?: string };
    const status = err.validation ? 400 : (err.statusCode ?? 500);

    if (status >= 500) app.log.error({ name: err.name, code: err.code }, 'Request failed');
    reply.code(status).send({
      code:
        err.code ??
        (err.validation
          ? 'VALIDATION_FAILED'
          : status === 401
            ? 'UNAUTHORIZED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 404
                ? 'NOT_FOUND'
                : status === 429
                  ? 'RATE_LIMITED'
                  : status >= 500
                    ? 'SERVICE_UNAVAILABLE'
                    : 'REQUEST_FAILED'),
      message: err.validation
        ? 'Check the submitted input.'
        : status >= 500 && !(err instanceof HttpError)
          ? 'The service is temporarily unavailable. Try again later.'
          : err.message,
    });
  });
  app.get('/api/health', { schema: { tags: ['system'] } }, async () => {
    await session.pool.query('select 1');

    return { status: 'ok' };
  });
  app.get('/api/config', async () => ({
    manualAnalysis:
      (
        await session.pool.query(
          "select to_regprocedure('public.reanalyze_image(uuid)') is not null as available",
        )
      ).rows[0]?.available === true,
    smtpConfigured: !!config.SMTP_ENABLED,
    emailConfirmation: config.EMAIL_AUTOCONFIRM !== 'true',
  }));
  registerGeminiRoutes(app, config, session);
  registerAuthRoutes(app, config, session);
  registerProfileRoutes(app, session);
  registerWardrobeRoutes(app, session, config);
  registerGarmentRoutes(app, session);
  registerCustomPropertyRoutes(app, session);
  registerImageRoutes(app, session);
  registerJobRoutes(app, session);
  registerOutfitRoutes(app, session);

  const queueAdmins = (config.QUEUE_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (queueAdmins.length && config.REDIS_URL) {
    queueAdmins.forEach((id) => uuid.parse(id));

    const queues = await registerQueueBoard(
      app,
      config.REDIS_URL,
      queueAdmins,
      async (req, reply) => (await session.load(req, reply)).user.id,
    );

    await registerQueueControls(app, queues, session.pool, async (req, reply) => {
      const { user } = await session.load(req, reply);

      if (!queueAdmins.includes(user.id))
        throw new HttpError(403, 'This dashboard is restricted to administrators.');
    });
  }

  app.addHook('onClose', async () => session.close());

  return app;
}
