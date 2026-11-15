import type { FastifyInstance } from 'fastify';

import type { Config } from '../../app/config.js';

import { type sessions } from '../auth/session.js';
import { registerTravelPackingRoutes } from '../travel-packing/routes.js';
import { createGeminiQueue } from './gemini-queue.js';
import { registerGeminiSettingsRoutes } from './settings-routes.js';
import { registerGeminiTaskRoutes } from './task-routes.js';

type SessionManager = ReturnType<typeof sessions>;

export function registerGeminiRoutes(
  app: FastifyInstance,
  config: Config,
  session: SessionManager,
) {
  const { queue, publisher } = createGeminiQueue(app, config);

  registerTravelPackingRoutes(app, config, session, queue);
  registerGeminiSettingsRoutes(app, config, session);
  registerGeminiTaskRoutes(app, config, session, queue, publisher);
}
