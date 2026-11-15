import { z } from 'zod';

import { outfitInput, uuid } from '@wardrobe/shared';

import type { ApiServer } from '../../app/server.js';
import { checked } from '../../lib/route-utils.js';

import type { SessionService } from '../auth/session.js';

const idParams = z.object({ id: uuid });

export function registerOutfitRoutes(app: ApiServer, session: SessionService) {
  app.get('/api/outfits', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const data = checked(
      await sb
        .from('outfits')
        .select('*,outfit_garments(garment_id)')
        .order('created_at', { ascending: false })
        .limit(100),
    );

    return data.map((o) => ({
      ...o,
      garment_ids: o.outfit_garments.map((g: { garment_id: string }) => g.garment_id),
    }));
  });
  app.post('/api/outfits', { schema: { body: outfitInput } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(await sb.rpc('save_outfit', { payload: req.body }));
  });
  app.delete('/api/outfits/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    checked(await sb.from('outfits').delete().eq('id', req.params.id).select().single());

    return { ok: true };
  });
  app.post(
    '/api/garments/:id/wear',
    { schema: { params: idParams, body: z.object({ worn_on: z.iso.date() }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return checked(
        await sb.rpc('record_wear', { garment: req.params.id, day: req.body.worn_on }),
      );
    },
  );
  app.get('/api/garments/:id/history', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(
      await sb
        .from('wear_history')
        .select('*')
        .eq('garment_id', req.params.id)
        .order('worn_on', { ascending: false })
        .limit(100),
    );
  });
}
