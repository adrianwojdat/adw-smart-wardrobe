import { z } from 'zod';

import {
  aiPreferencesSchema,
  deriveStyleHardConstraints,
  styleProfileStoredSchema,
  styleProfileUpdateSchema,
} from '@wardrobe/shared';

import type { ApiServer } from '../../app/server.js';
import { checked } from '../../lib/route-utils.js';

import type { SessionService } from '../auth/session.js';

export function registerProfileRoutes(app: ApiServer, session: SessionService) {
  app.get('/api/preferences/ai', async (req, reply) => {
    const { sb, user } = await session.load(req, reply);

    return checked(
      await sb.from('profiles').select('ai_overwrite_metadata').eq('id', user.id).single(),
    );
  });
  app.patch(
    '/api/preferences/ai',
    { schema: { body: aiPreferencesSchema } },
    async (req, reply) => {
      const { sb, user } = await session.load(req, reply);

      return checked(
        await sb
          .from('profiles')
          .update(req.body)
          .eq('id', user.id)
          .select('ai_overwrite_metadata')
          .single(),
      );
    },
  );
  app.patch(
    '/api/profile',
    { schema: { body: z.object({ name: z.string().trim().min(1).max(120) }) } },
    async (req, reply) => {
      const { sb, user } = await session.load(req, reply);

      return checked(
        await sb.from('profiles').update(req.body).eq('id', user.id).select().single(),
      );
    },
  );
  app.get('/api/profile/style', { schema: { tags: ['profile'] } }, async (req, reply) => {
    const { sb, user } = await session.load(req, reply);
    const profile = checked(
      await sb.from('profiles').select('style_profile').eq('id', user.id).single(),
    );
    const stored = styleProfileStoredSchema.parse(profile.style_profile);

    return { ...stored, hard_constraints: deriveStyleHardConstraints(stored.answers) };
  });
  app.patch(
    '/api/profile/style',
    { schema: { body: styleProfileUpdateSchema, tags: ['profile'] } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const merged: unknown = checked(
        await sb.rpc('merge_my_style_answers', {
          p_answers: req.body.answers,
          p_skipped: req.body.skipped,
        }),
      );
      const stored = styleProfileStoredSchema.parse(merged);

      return { ...stored, hard_constraints: deriveStyleHardConstraints(stored.answers) };
    },
  );
}
