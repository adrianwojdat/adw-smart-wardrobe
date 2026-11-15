import { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';

import type { Config } from '../../app/config.js';

export function createGeminiQueue(app: FastifyInstance, config: Config) {
  const connection = config.REDIS_URL
    ? (() => {
        const url = new URL(config.REDIS_URL);
        const redis = new Redis({
          host: url.hostname,
          port: Number(url.port || 6379),
          username: url.username ? decodeURIComponent(url.username) : undefined,
          password: decodeURIComponent(url.password),
          maxRetriesPerRequest: 1,
          connectTimeout: 5000,
        });

        redis.on('error', () => app.log.warn('Gemini Redis queue unavailable'));

        return redis;
      })()
    : undefined;
  const queue = connection ? new Queue('gemini', { connection }) : undefined;
  const publisher = connection?.duplicate();

  queue?.on('error', () => app.log.warn('Gemini job queue unavailable'));
  app.addHook('onClose', async () => {
    await queue?.close();
    await Promise.all([connection?.quit(), publisher?.quit()]);
  });

  return { queue, publisher };
}
