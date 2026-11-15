import { z } from 'zod';

import { garmentInput, garmentPatch, uuid } from '@wardrobe/shared';

import type { ApiServer } from '../../app/server.js';
import { checked } from '../../lib/route-utils.js';

import type { SessionService } from '../auth/session.js';
import { HttpError } from '../auth/session.js';

const idParams = z.object({ id: uuid });

export function registerGarmentRoutes(app: ApiServer, session: SessionService) {
  app.get(
    '/api/garments',
    {
      schema: {
        querystring: z.object({
          wardrobe_id: uuid.optional(),
          search: z.string().max(120).optional(),
          category: z
            .enum([
              'all',
              ...(['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'] as const),
            ])
            .optional(),
          archived: z.enum(['true', 'false']).default('false'),
          offset: z.coerce.number().int().min(0).default(0),
        }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      let query = sb
        .from('garments')
        .select('*,garment_images(*)')
        .eq('archived', req.query.archived === 'true')
        .order('created_at', { ascending: false })
        .range(req.query.offset, req.query.offset + 99);

      if (req.query.wardrobe_id) query = query.eq('wardrobe_id', req.query.wardrobe_id);
      if (req.query.search)
        query = query.ilike('name', '%' + req.query.search.replace(/[%_\\]/g, '\\$&') + '%');
      if (req.query.category && req.query.category !== 'all')
        query = query.eq('category', req.query.category);

      return checked(await query);
    },
  );
  app.post(
    '/api/garments',
    { schema: { body: garmentInput.extend({ id: uuid.optional() }), tags: ['garments'] } },
    async (req, reply) => {
      const { sb, user } = await session.load(req, reply);
      const result = await sb
        .from('garments')
        .insert(req.body)
        .select('*,garment_images(*)')
        .single();

      if (result.error?.code === '23505' && req.body.id) {
        const existing = checked(
          await sb
            .from('garments')
            .select('*,garment_images(*)')
            .eq('id', req.body.id)
            .eq('wardrobe_id', req.body.wardrobe_id)
            .single(),
        );

        if (existing.owner_id !== user.id) throw new HttpError(403, 'Permission denied.');

        return existing;
      }

      return checked(result);
    },
  );
  app.get('/api/garments/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(
      await sb.from('garments').select('*,garment_images(*)').eq('id', req.params.id).single(),
    );
  });
  app.patch(
    '/api/garments/:id',
    { schema: { params: idParams, body: garmentPatch } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return checked(
        await sb
          .from('garments')
          .update({
            ...req.body,
            ...(req.body.name !== undefined ? { name_source: 'manual' } : {}),
          })
          .eq('id', req.params.id)
          .select('*,garment_images(*)')
          .single(),
      );
    },
  );
  app.delete('/api/garments/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const g = checked(
      await sb
        .from('garments')
        .select('wardrobe_id,garment_images(path)')
        .eq('id', req.params.id)
        .single(),
    );

    if (!checked(await sb.rpc('has_wardrobe_access', { w: g.wardrobe_id, editing: true })))
      throw new HttpError(403, 'You do not have permission to edit this resource.');

    const paths = g.garment_images.map((i: { path: string }) => i.path);

    if (paths.length) checked(await sb.storage.from('garments').remove(paths));
    checked(await sb.from('garments').delete().eq('id', req.params.id).select('id').single());

    return { ok: true };
  });
}
