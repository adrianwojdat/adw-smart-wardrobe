import Fastify from '../apps/api/node_modules/fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { queueBoardGuard, QUEUE_BOARD_PATH } from '../apps/api/src/queue-board';
import { HttpError } from '../apps/api/src/session';
const app = Fastify();
beforeAll(async () => {
  app.setErrorHandler((error, _req, reply) =>
    reply.code((error as HttpError).statusCode ?? 500).send({ message: (error as Error).message }),
  );
  await app.register(async (scope) => {
    scope.addHook(
      'onRequest',
      queueBoardGuard(['admin-id'], async (req) => {
        const id = req.headers['x-test-user'];
        if (!id) throw new HttpError(401, 'Zaloguj się.');
        return String(id);
      }),
    );
    for (const suffix of ['', '/', '/static/app.js', '/api/queues'])
      scope.route({
        method: ['GET', 'POST', 'DELETE'],
        url: QUEUE_BOARD_PATH + suffix,
        handler: async () => ({ ok: true }),
      });
  });
  app.get('/api/other', async () => ({ ok: true }));
});
afterAll(async () => {
  await app.close();
});
it('protects HTML, trailing slash, assets and API from anonymous and non-admin users', async () => {
  for (const suffix of ['', '/', '/static/app.js', '/api/queues']) {
    expect((await app.inject({ url: QUEUE_BOARD_PATH + suffix })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          url: QUEUE_BOARD_PATH + suffix,
          headers: { 'x-test-user': 'ordinary-user' },
        })
      ).statusCode,
    ).toBe(403);
    const response = await app.inject({
      url: QUEUE_BOARD_PATH + suffix,
      headers: { 'x-test-user': 'admin-id' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
  }
});
it('blocks direct dashboard mutations even by an admin', async () => {
  for (const method of ['POST', 'DELETE'] as const)
    expect(
      (
        await app.inject({
          method,
          url: QUEUE_BOARD_PATH + '/api/queues',
          headers: { 'x-test-user': 'admin-id' },
        })
      ).statusCode,
    ).toBe(405);
});
it('does not apply admin restrictions to other app routes', async () => {
  expect((await app.inject({ url: '/api/other' })).statusCode).toBe(200);
});
