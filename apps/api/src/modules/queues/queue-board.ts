import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';

import { HttpError } from '../auth/session.js';

export const QUEUE_BOARD_PATH = '/api/admin/queues';

/** Shared guard covers the HTML, static assets and every dashboard API route. */
export function queueBoardGuard(
  adminIds: string[],
  identify: (req: FastifyRequest, reply: FastifyReply) => Promise<string>,
) {
  const allowed = new Set(adminIds);

  return async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store, private');
    if (!allowed.has(await identify(req, reply)))
      throw new HttpError(403, 'The queue dashboard is restricted to administrators.');
    if (!['GET', 'HEAD'].includes(req.method))
      throw new HttpError(
        405,
        'The queue dashboard is read-only. Retry jobs from the garment page.',
      );
  };
}

export async function registerQueueBoard(
  app: FastifyInstance,
  redisUrl: string,
  adminIds: string[],
  identify: (req: FastifyRequest, reply: FastifyReply) => Promise<string>,
) {
  const url = new URL(redisUrl);
  const connection = new Redis({
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: decodeURIComponent(url.password),
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  });

  connection.on('error', () => app.log.warn('Queue dashboard Redis connection unavailable'));

  const queues = ['wardrobe', 'wardrobe-ai'].map((name) => new Queue(name, { connection }));

  for (const queue of queues)
    queue.on('error', () => app.log.warn('Queue dashboard connection unavailable'));
  app.addHook('onClose', async () => {
    await Promise.all(queues.map((queue) => queue.close()));
    connection.disconnect();
  });
  await mountQueueBoard(app, queues, adminIds, identify);

  return queues;
}

/** Mounting is separate from Redis ownership so adapter/auth can be tested offline. */
export async function mountQueueBoard(
  app: FastifyInstance,
  queues: Queue[],
  adminIds: string[],
  identify: (req: FastifyRequest, reply: FastifyReply) => Promise<string>,
) {
  const adapter = new FastifyAdapter();

  adapter.setBasePath(QUEUE_BOARD_PATH);
  createBullBoard({
    queues: queues.map(
      (queue) => new BullMQAdapter(queue, { readOnlyMode: true, allowRetries: false }),
    ),
    serverAdapter: adapter,
    options: {
      uiConfig: {
        boardTitle: 'Smart Wardrobe · Kolejki',
        miscLinks: [{ text: 'Queue controls', url: '/api/admin/queue-control' }],
        locale: { lng: 'pl' },
        hideRedisDetails: true,
        hideDocsLink: true,
        pollingInterval: { forceInterval: 10000 },
      },
    },
  });
  await app.register(async (scope) => {
    scope.addHook('onRequest', queueBoardGuard(adminIds, identify));
    await scope.register(adapter.registerPlugin(), { prefix: QUEUE_BOARD_PATH });
  });
}
