import type { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { z } from 'zod';

import { outfitRecommendationRequestSchema } from '@wardrobe/shared';

import type { Config } from '../../app/config.js';

import { HttpError, type sessions } from '../auth/session.js';
import { readTask, requestError } from './route-utils.js';

type SessionManager = ReturnType<typeof sessions>;

export function registerGeminiTaskRoutes(
  app: FastifyInstance,
  config: Config,
  session: SessionManager,
  queue: Queue | undefined,
  publisher: Redis | undefined,
) {
  app.post(
    '/api/recommendations',
    { schema: { body: outfitRecommendationRequestSchema, tags: ['outfits'] } },
    async (req, reply) => {
      const { sb, user } = await session.load(req, reply);

      if (!queue) throw new HttpError(503, 'Kolejka Gemini nie jest skonfigurowana.');
      if (!config.GEMINI_ENCRYPTION_KEY)
        throw new HttpError(
          503,
          'Gemini key encryption has not been configured by the administrator.',
        );

      const body = outfitRecommendationRequestSchema.parse(req.body);
      const configured = await sb.from('gemini_credentials').select('model').maybeSingle();

      if (configured.error || !configured.data)
        throw new HttpError(400, 'Najpierw zapisz klucz Gemini.');
      if (!configured.data.model) throw new HttpError(400, 'Wybierz model Gemini w ustawieniach.');

      const access = await sb.rpc('has_wardrobe_access', { w: body.wardrobe_id });

      if (access.error || access.data !== true)
        throw new HttpError(403, 'You do not have access to this wardrobe.');

      let task: { id: string; status: string } | undefined;

      try {
        const created = await session.pool.query(
          'select id,status from private.create_gemini_outfit_task_for_user($1,$2::jsonb,$3)',
          [user.id, JSON.stringify(body), config.GEMINI_MAX_QUEUE],
        );

        task = created.rows[0] as { id: string; status: string } | undefined;
      } catch (error) {
        requestError(error as { code?: string; message?: string });
      }

      if (!task) throw new HttpError(503, 'Failed to create the outfit generation task.');

      const current = await readTask(sb, task.id);

      if (current.kind !== 'outfit_recommendation')
        throw new HttpError(409, 'Another Gemini task is already active. Wait for it to finish.');

      if (task.status === 'queued') {
        try {
          await queue.add(
            'execute',
            { taskId: task.id },
            {
              jobId: task.id,
              removeOnComplete: { age: 86400, count: 1000 },
              removeOnFail: { age: 86400, count: 1000 },
            },
          );
        } catch {
          await session.pool
            .query('select private.cancel_gemini_task_for_user($1,$2)', [user.id, task.id])
            .catch(() => undefined);
          throw new HttpError(503, 'Failed to enqueue the outfit generation task.');
        }
      }

      reply.code(task.status === 'queued' ? 202 : 200);

      return readTask(sb, task.id);
    },
  );

  app.post('/api/gemini/tasks', async (req, reply) => {
    const { sb, user } = await session.load(req, reply);

    if (!queue) throw new HttpError(503, 'Kolejka Gemini nie jest skonfigurowana.');

    const body = z.object({ kind: z.enum(['connection_test', 'list_models']) }).parse(req.body);

    if (!config.GEMINI_ENCRYPTION_KEY)
      throw new HttpError(
        503,
        'Gemini key encryption has not been configured by the administrator.',
      );

    const configured = await sb.from('gemini_credentials').select('model').maybeSingle();

    if (configured.error || !configured.data)
      throw new HttpError(400, 'Najpierw zapisz klucz Gemini.');
    if (body.kind === 'connection_test' && !configured.data.model)
      throw new HttpError(400, 'Select a Gemini model before testing the connection.');

    let task: { id: string; status: string } | undefined;

    try {
      const created = await session.pool.query(
        'select id,status from private.create_gemini_task_for_user($1,$2,$3)',
        [user.id, body.kind, config.GEMINI_MAX_QUEUE],
      );

      task = created.rows[0] as { id: string; status: string } | undefined;
    } catch (error) {
      requestError(error as { code?: string; message?: string });
    }

    if (!task) throw new HttpError(503, 'Failed to create the Gemini task.');

    if (task.status === 'queued') {
      try {
        await queue.add(
          'execute',
          { taskId: task.id },
          {
            jobId: task.id,
            removeOnComplete: { age: 86400, count: 1000 },
            removeOnFail: { age: 86400, count: 1000 },
          },
        );
      } catch {
        await session.pool
          .query('select private.cancel_gemini_task_for_user($1,$2)', [user.id, task.id])
          .catch(() => undefined);
        throw new HttpError(503, 'Failed to enqueue the Gemini task.');
      }
    }

    reply.code(task.status === 'queued' ? 202 : 200);

    return readTask(sb, task.id);
  });

  app.get('/api/gemini/tasks/:id', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);

    return readTask(sb, id);
  });

  app.post('/api/gemini/tasks/:id/cancel', async (req, reply) => {
    const { sb, user } = await session.load(req, reply);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    let status: string | undefined;

    try {
      const result = await session.pool.query(
        'select private.cancel_gemini_task_for_user($1,$2) as status',
        [user.id, id],
      );

      status = result.rows[0]?.status;
    } catch (error) {
      requestError(error as { code?: string; message?: string });
    }

    if (status === 'cancelled') {
      await publisher?.publish('gemini:cancel', id).catch(() => 0);

      const job = await queue?.getJob(id).catch(() => undefined);

      if (job && (await job.getState().catch(() => 'unknown')) !== 'active')
        await job.remove().catch(() => undefined);
    }

    return readTask(sb, id);
  });
}
