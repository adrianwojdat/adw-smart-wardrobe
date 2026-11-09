import Fastify from '../apps/api/node_modules/fastify';
import type { Queue } from '../apps/api/node_modules/bullmq';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mountQueueBoard, QUEUE_BOARD_PATH } from '../apps/api/src/queue-board';
import { HttpError } from '../apps/api/src/session';
const app = Fastify();
beforeAll(async () => {
  app.setErrorHandler((error, _req, reply) =>
    reply.code((error as HttpError).statusCode ?? 500).send({ message: (error as Error).message }),
  );
  const queues = ['wardrobe', 'wardrobe-ai'].map(
    (name) => ({ name, metaValues: { version: 'bullmq:6.7.2' } }) as unknown as Queue,
  );
  await mountQueueBoard(app, queues, ['admin'], async (req) => {
    if (!req.headers['x-test-user']) throw new HttpError(401, 'Zaloguj się.');
    return String(req.headers['x-test-user']);
  });
});
afterAll(async () => {
  await app.close();
});
it('serves the actual dashboard HTML and bundled static assets behind the guard', async () => {
  const response = await app.inject({
    url: QUEUE_BOARD_PATH + '/',
    headers: { 'x-test-user': 'admin' },
  });
  expect(response.statusCode).toBe(200);
  expect(response.body).toContain('Smart Wardrobe · Kolejki');
  const asset = response.body.match(/src="(static\/js\/[^"]+)"/)?.[1];
  expect(asset).toBeTruthy();
  expect((await app.inject({ url: QUEUE_BOARD_PATH + '/' + asset })).statusCode).toBe(401);
  expect(
    (
      await app.inject({
        url: QUEUE_BOARD_PATH + '/' + asset,
        headers: { 'x-test-user': 'ordinary' },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (await app.inject({ url: QUEUE_BOARD_PATH + '/' + asset, headers: { 'x-test-user': 'admin' } }))
      .statusCode,
  ).toBe(200);
});
it('denies a direct request to the real dashboard queue API without admin identity', async () => {
  expect((await app.inject({ url: QUEUE_BOARD_PATH + '/api/queues' })).statusCode).toBe(401);
  expect(
    (
      await app.inject({
        url: QUEUE_BOARD_PATH + '/api/queues',
        headers: { 'x-test-user': 'ordinary' },
      })
    ).statusCode,
  ).toBe(403);
});
