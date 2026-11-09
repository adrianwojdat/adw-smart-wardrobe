import Fastify from '../apps/api/node_modules/fastify';
import type { Pool } from '../apps/api/node_modules/pg';
import type { Queue } from '../apps/api/node_modules/bullmq';
import { validatorCompiler } from '../apps/api/node_modules/fastify-type-provider-zod';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { registerQueueControls } from '../apps/api/src/queue-controls';
import { HttpError } from '../apps/api/src/session';
const app = Fastify(),
  query = vi.fn(),
  removeWaiting = vi.fn(),
  removeActive = vi.fn();
beforeAll(async () => {
  app.setValidatorCompiler(validatorCompiler);
  app.setErrorHandler((error, _req, reply) =>
    reply.code((error as HttpError).statusCode ?? 400).send({ message: (error as Error).message }),
  );
  const queues = [
    {
      name: 'wardrobe-ai',
      getJob: async (id: string) => ({
        getState: async () => (id === 'active' ? 'active' : 'waiting'),
        remove: id === 'active' ? removeActive : removeWaiting,
      }),
    },
  ] as unknown as Queue[];
  await registerQueueControls(app, queues, { query } as unknown as Pool, async (req) => {
    if (req.headers['x-test-user'] !== 'admin') throw new HttpError(403, 'forbidden');
  });
});
afterAll(async () => {
  await app.close();
});
it('protects controls, scripts and cancellation endpoint', async () => {
  for (const url of ['/api/admin/queue-control', '/api/admin/queue-control.js'])
    expect((await app.inject({ url })).statusCode).toBe(403);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/admin/queue-control/cancel',
        payload: { queue: 'all' },
      })
    ).statusCode,
  ).toBe(403);
  expect(query).not.toHaveBeenCalled();
});
it('cancels durably before removing Redis jobs and leaves locked jobs to cooperative cancellation', async () => {
  query.mockResolvedValueOnce({
    rows: [
      {
        jobs: [
          { id: 'waiting', type: 'analyze_garment' },
          { id: 'active', type: 'analyze_garment' },
        ],
      },
    ],
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/queue-control/cancel',
    headers: { 'x-test-user': 'admin' },
    payload: { queue: 'ai' },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ cancelled: 2, removed: 1, cleanupPending: 1 });
  expect(query).toHaveBeenCalledWith('select private.cancel_queue_jobs($1) as jobs', ['ai']);
  expect(removeWaiting).toHaveBeenCalledOnce();
  expect(removeActive).not.toHaveBeenCalled();
  expect(query.mock.invocationCallOrder[0]).toBeLessThan(
    removeWaiting.mock.invocationCallOrder[0]!,
  );
});
it('serves confirmation controls without inline scripts', async () => {
  const response = await app.inject({
    url: '/api/admin/queue-control',
    headers: { 'x-test-user': 'admin' },
  });
  expect(response.statusCode).toBe(200);
  expect(response.body).toContain('Potwierdzam anulowanie');
  expect(response.body).toContain('src="/api/admin/queue-control.js"');
  expect(response.headers['cache-control']).toContain('no-store');
});
