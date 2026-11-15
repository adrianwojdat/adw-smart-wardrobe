import { z } from 'zod';

import { uuid } from '@wardrobe/shared';

import type { ApiServer } from '../../app/server.js';
import { checked } from '../../lib/route-utils.js';

import type { SessionService } from '../auth/session.js';

const idParams = z.object({ id: uuid });

export function registerJobRoutes(app: ApiServer, session: SessionService) {
  app.get(
    '/api/jobs',
    { schema: { querystring: z.object({ garment_id: uuid }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return checked(
        await sb
          .from('jobs')
          .select('*')
          .eq('garment_id', req.query.garment_id)
          .order('created_at', { ascending: false })
          .limit(20),
      );
    },
  );
  app.post('/api/jobs/:id/retry', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(await sb.rpc('retry_job', { job_id: req.params.id }));
  });
}
