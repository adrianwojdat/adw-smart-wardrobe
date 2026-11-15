import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { timingSafeEqual } from 'node:crypto';

import { HttpError } from '../modules/auth/session.js';
import type { Config } from './config.js';
import { allowedOrigins } from './origins.js';

export function createApiServer(config: Config) {
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
  const origins = allowedOrigins(config.APP_ORIGIN, config.APP_ADDITIONAL_ORIGINS);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  return {
    app,
    origins,
    registerSecurity: async () => {
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
          if (!req.headers.origin || !origins.has(req.headers.origin))
            throw new HttpError(403, 'Invalid request origin.');

          const expected = req.cookies.sw_csrf,
            provided = req.headers['x-csrf-token'];

          if (
            !expected ||
            typeof provided !== 'string' ||
            expected.length !== provided.length ||
            !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
          )
            throw new HttpError(403, 'Refresh the page and try again.');
        }
      });
    },
  };
}

export type ApiServer = ReturnType<typeof createApiServer>['app'];
