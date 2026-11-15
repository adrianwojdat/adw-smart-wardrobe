import { z } from 'zod';

import {
  customPropertyCreateSchema,
  customPropertyDefinitionSchema,
  customPropertyOptionCreateSchema,
  customPropertyOptionSchema,
  customPropertyPatchSchema,
  uuid,
} from '@wardrobe/shared';

import type { ApiServer } from '../../../app/server.js';
import { checked, errorCode } from '../../../lib/route-utils.js';

import type { SessionService } from '../../auth/session.js';
import { HttpError } from '../../auth/session.js';

import { idParams, optionProperty } from './validation.js';

export function registerCustomPropertyDefinitionRoutes(app: ApiServer, session: SessionService) {
  app.get(
    '/api/wardrobes/:id/custom-properties',
    { schema: { params: idParams } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const wardrobeId = req.params.id;

      if (!checked(await sb.rpc('has_wardrobe_access', { w: wardrobeId, editing: false })))
        throw new HttpError(403, 'Wardrobe access denied.');

      const definitions = checked(
        await sb
          .from('garment_property_definitions')
          .select('*,garment_property_options(*)')
          .eq('wardrobe_id', wardrobeId)
          .order('sort_order', { ascending: true }),
      );

      return customPropertyDefinitionSchema.array().parse(definitions);
    },
  );
  app.post(
    '/api/wardrobes/:id/custom-properties',
    { schema: { params: idParams, body: customPropertyCreateSchema } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const wardrobeId = req.params.id;

      if (
        !z
          .boolean()
          .parse(checked(await sb.rpc('has_wardrobe_access', { w: wardrobeId, editing: true })))
      )
        throw new HttpError(403, 'You do not have permission to edit this wardrobe.');

      const definition = customPropertyDefinitionSchema.parse(
        checked(
          await sb
            .from('garment_property_definitions')
            .insert({ ...req.body, wardrobe_id: wardrobeId })
            .select('*,garment_property_options(*)')
            .single(),
        ),
      );

      return definition;
    },
  );
  app.patch(
    '/api/custom-properties/:id',
    { schema: { params: idParams, body: customPropertyPatchSchema } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const definition = z
        .object({ wardrobe_id: uuid })
        .parse(
          checked(
            await sb
              .from('garment_property_definitions')
              .select('wardrobe_id')
              .eq('id', req.params.id)
              .single(),
          ),
        );

      if (
        !z
          .boolean()
          .parse(
            checked(
              await sb.rpc('has_wardrobe_access', { w: definition.wardrobe_id, editing: true }),
            ),
          )
      )
        throw new HttpError(403, 'You do not have permission to edit this wardrobe.');

      const updated = customPropertyDefinitionSchema.parse(
        checked(
          await sb
            .from('garment_property_definitions')
            .update({ ...req.body, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select('*,garment_property_options(*)')
            .single(),
        ),
      );

      return updated;
    },
  );
  app.post(
    '/api/custom-properties/:id/options',
    { schema: { params: idParams, body: customPropertyOptionCreateSchema } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const property = optionProperty.parse(
        checked(
          await sb
            .from('garment_property_definitions')
            .select('id,wardrobe_id,type')
            .eq('id', req.params.id)
            .single(),
        ),
      );

      if (!checked(await sb.rpc('has_wardrobe_access', { w: property.wardrobe_id, editing: true })))
        throw new HttpError(403, 'You do not have permission to edit this wardrobe.');
      if (property.type !== 'select' && property.type !== 'multi_select')
        throw new HttpError(400, 'Options are only available for selection fields.');

      const label = req.body.label.replace(/\s+/g, ' ');
      const existing = customPropertyOptionSchema
        .array()
        .parse(
          checked(
            await sb
              .from('garment_property_options')
              .select('*')
              .eq('property_id', property.id)
              .order('sort_order', { ascending: true }),
          ),
        );
      const key = label.toLocaleLowerCase('pl-PL');
      const match = existing.find((option) => option.label.toLocaleLowerCase('pl-PL') === key);

      if (match) return match;

      const inserted = await sb
        .from('garment_property_options')
        .insert({
          property_id: property.id,
          wardrobe_id: property.wardrobe_id,
          label,
          sort_order: existing.length,
        })
        .select('*')
        .single();

      if (errorCode(inserted.error) === '23505') {
        const winner = customPropertyOptionSchema.parse(
          checked(
            await sb
              .from('garment_property_options')
              .select('*')
              .eq('property_id', property.id)
              .eq('normalized_label', key)
              .single(),
          ),
        );

        return winner;
      }

      return customPropertyOptionSchema.parse(checked(inserted));
    },
  );
}
