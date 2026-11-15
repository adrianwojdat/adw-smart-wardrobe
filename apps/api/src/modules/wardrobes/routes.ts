import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import { uuid, wardrobeInput } from '@wardrobe/shared';

import type { Config } from '../../app/config.js';
import type { ApiServer } from '../../app/server.js';
import { checked } from '../../lib/route-utils.js';

import type { SessionService } from '../auth/session.js';
import { hash, HttpError } from '../auth/session.js';

const idParams = z.object({ id: uuid });

export function registerWardrobeRoutes(app: ApiServer, session: SessionService, config: Config) {
  app.get('/api/wardrobes', async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(await sb.from('wardrobes').select('*').order('created_at'));
  });
  app.post(
    '/api/wardrobes',
    { schema: { body: wardrobeInput, tags: ['wardrobes'] } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return checked(await sb.from('wardrobes').insert(req.body).select().single());
    },
  );
  app.patch(
    '/api/wardrobes/:id',
    { schema: { params: idParams, body: wardrobeInput.pick({ name: true }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return checked(
        await sb.from('wardrobes').update(req.body).eq('id', req.params.id).select().single(),
      );
    },
  );
  app.get('/api/analysis/activity', async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const totals = new Map<
      string,
      { wardrobe_id: string; image_id: string; queued: number; processing: number }
    >();
    let cursor: string | undefined;

    for (;;) {
      let query = sb
        .from('jobs')
        .select('id,wardrobe_id,image_id,status')
        .in('type', ['analyze_garment', 'analyze_label'])
        .in('status', ['queued', 'processing'])
        .order('id')
        .limit(1000);

      if (cursor) query = query.gt('id', cursor);

      const rows = checked(await query);

      for (const row of rows) {
        const key = row.image_id;
        const total = totals.get(key) ?? {
          wardrobe_id: row.wardrobe_id,
          image_id: row.image_id,
          queued: 0,
          processing: 0,
        };

        if (row.status === 'queued') total.queued++;
        else total.processing++;
        totals.set(key, total);
      }

      if (rows.length < 1000) break;
      cursor = rows.at(-1)!.id;
    }

    return [...totals.values()];
  });
  app.post('/api/wardrobes/:id/analyze', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(await sb.rpc('reanalyze_wardrobe', { wardrobe: req.params.id }));
  });
  app.delete('/api/wardrobes/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const { error } = await sb.rpc('delete_wardrobe', { wardrobe: req.params.id });

    if (error)
      throw new HttpError(
        error.code === '42501' ? 403 : 400,
        'Only the owner can delete this wardrobe.',
      );

    return { ok: true };
  });
  app.get('/api/wardrobes/:id/members', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(await sb.from('wardrobe_members').select('*').eq('wardrobe_id', req.params.id));
  });
  app.patch(
    '/api/wardrobes/:id/members/:userId',
    {
      schema: {
        params: idParams.extend({ userId: uuid }),
        body: z.object({ role: z.enum(['editor', 'viewer']) }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return checked(
        await sb
          .from('wardrobe_members')
          .update(req.body)
          .eq('wardrobe_id', req.params.id)
          .eq('user_id', req.params.userId)
          .select()
          .single(),
      );
    },
  );
  app.delete(
    '/api/wardrobes/:id/members/:userId',
    { schema: { params: idParams.extend({ userId: uuid }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      checked(
        await sb
          .from('wardrobe_members')
          .delete()
          .eq('wardrobe_id', req.params.id)
          .eq('user_id', req.params.userId)
          .select()
          .single(),
      );

      return { ok: true };
    },
  );
  app.post(
    '/api/wardrobes/:id/invitations',
    {
      schema: {
        params: idParams,
        body: z.object({ email: z.email(), role: z.enum(['editor', 'viewer']) }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const token = randomBytes(32).toString('base64url');

      checked(
        await sb
          .from('invitations')
          .insert({
            ...req.body,
            email: req.body.email.toLowerCase(),
            wardrobe_id: req.params.id,
            token_hash: hash(token),
          })
          .select()
          .single(),
      );

      return { url: config.APP_ORIGIN + '/family?invite=' + token };
    },
  );
  app.post(
    '/api/invitations/accept',
    { schema: { body: z.object({ token: z.string().min(20).max(100) }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return {
        wardrobe_id: checked(await sb.rpc('accept_invitation', { token: hash(req.body.token) })),
      };
    },
  );
}
