import type { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  garmentSchema,
  packingInputSchema,
  packingListSchema,
  packingRecommendationsSchema,
  recommendPackingGarments,
  tripSchema,
} from '@wardrobe/shared';

import type { Config } from '../../app/config.js';
import { checked, errorCode } from '../../lib/route-utils.js';

import { HttpError, type SessionService } from '../auth/session.js';
import { readTask, requestError } from '../gemini/route-utils.js';

export function registerTravelPackingRoutes(
  app: FastifyInstance,
  config: Config,
  session: SessionService,
  queue: Queue | undefined,
) {
  app.post('/api/travel-packing/generate', { schema: { body: tripSchema } }, async (req, reply) => {
    const { sb, user } = await session.load(req, reply);
    const body = tripSchema.parse(req.body);

    if (!queue || !config.GEMINI_ENCRYPTION_KEY) throw new HttpError(503, 'Gemini unavailable');

    const configured = await sb.from('gemini_credentials').select('model').maybeSingle();

    if (!configured.data?.model) throw new HttpError(400, 'Configure Gemini in settings');

    const access = await sb.rpc('has_wardrobe_access', { w: body.wardrobe_id });

    if (access.error || access.data !== true) throw new HttpError(403, 'Wardrobe access required');

    let task: { id: string; status: string } | undefined;

    try {
      const created = await session.pool.query(
        'select id,status from private.create_gemini_packing_task_for_user($1,$2::jsonb,$3)',
        [user.id, JSON.stringify(body), config.GEMINI_MAX_QUEUE],
      );

      task = z.object({ id: z.uuid(), status: z.string() }).parse(created.rows[0]);
    } catch (error) {
      requestError({
        code: errorCode(error),
        message: error instanceof Error ? error.message : undefined,
      });
    }

    if (!task) throw new HttpError(503, 'Task unavailable');
    if (task.status !== 'queued') throw new HttpError(409, 'Another Gemini task is active');

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
      await session.pool.query('select private.cancel_gemini_task_for_user($1,$2)', [
        user.id,
        task.id,
      ]);
      throw new HttpError(503, 'Queue unavailable');
    }

    reply.code(202);

    return readTask(sb, task.id);
  });
  app.get('/api/travel-packing', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const lists = z
      .array(packingListSchema)
      .parse(
        checked(
          await sb
            .from('packing_lists')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(100),
        ),
      );
    const ids = [...new Set(lists.flatMap((l) => l.items.flatMap((i) => i.assigned)))];

    if (!ids.length) return lists;

    const available = new Set(
      z
        .array(z.object({ id: z.uuid() }))
        .parse(checked(await sb.from('garments').select('id').in('id', ids).eq('archived', false)))
        .map((g) => g.id),
    );

    return lists.map((l) => ({
      ...l,
      items: l.items.map((i) => ({ ...i, assigned: i.assigned.filter((id) => available.has(id)) })),
    }));
  });
  app.get('/api/travel-packing/:id/recommendations', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const list = packingListSchema.parse(
      checked(await sb.from('packing_lists').select('*').eq('id', id).single()),
    );
    const garments = z
      .array(garmentSchema)
      .parse(
        checked(
          await sb
            .from('garments')
            .select('*,garment_images(*)')
            .eq('wardrobe_id', list.trip.wardrobe_id)
            .eq('archived', false)
            .limit(2000),
        ),
      );

    return packingRecommendationsSchema.parse({
      wardrobe_count: garments.length,
      items: Object.fromEntries(
        list.items.map((i) => [
          i.id,
          recommendPackingGarments(i, garments).filter(
            (g, index) => index < 60 || i.assigned.includes(g.id),
          ),
        ]),
      ),
    });
  });
  app.put(
    '/api/travel-packing/:id',
    { schema: { body: packingInputSchema, params: z.object({ id: z.uuid() }) } },
    async (req, reply) => {
      const { sb, user } = await session.load(req, reply);
      const body = packingInputSchema.parse(req.body);
      const { id } = z.object({ id: z.uuid() }).parse(req.params);

      // User-token upsert: policies and trigger validate ownership, membership and every assignment.
      return packingListSchema.parse(
        checked(
          await sb
            .from('packing_lists')
            .upsert({ ...body, id, user_id: user.id, wardrobe_id: body.trip.wardrobe_id })
            .select('*')
            .single(),
        ),
      );
    },
  );
  app.delete('/api/travel-packing/:id', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);

    checked(await sb.from('packing_lists').delete().eq('id', id).select('id').single());

    return { ok: true };
  });
}
