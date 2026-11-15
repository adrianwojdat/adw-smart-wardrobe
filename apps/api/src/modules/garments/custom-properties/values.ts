import { z } from 'zod';

import { customPropertyValueSchema, uuid } from '@wardrobe/shared';

import type { ApiServer } from '../../../app/server.js';
import { checked } from '../../../lib/route-utils.js';

import type { SessionService } from '../../auth/session.js';
import { HttpError } from '../../auth/session.js';

import {
  customValueParams,
  garmentRef,
  idParams,
  optionProperty,
  optionRef,
  validatePropertyValue,
} from './validation.js';

export function registerCustomPropertyValueRoutes(app: ApiServer, session: SessionService) {
  app.get(
    '/api/garments/:id/custom-properties',
    { schema: { params: idParams } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const garment = garmentRef.parse(
        checked(
          await sb.from('garments').select('id,wardrobe_id').eq('id', req.params.id).single(),
        ),
      );
      const values = checked(
        await sb
          .from('garment_property_values')
          .select('*')
          .eq('garment_id', garment.id)
          .eq('wardrobe_id', garment.wardrobe_id),
      );

      return customPropertyValueSchema.array().parse(values);
    },
  );
  app.put(
    '/api/garments/:id/custom-properties/:propertyId',
    { schema: { params: customValueParams, body: z.object({ value: z.unknown() }).strict() } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const garment = garmentRef.parse(
        checked(
          await sb.from('garments').select('id,wardrobe_id').eq('id', req.params.id).single(),
        ),
      );
      const property = optionProperty
        .pick({ id: true, type: true })
        .parse(
          checked(
            await sb
              .from('garment_property_definitions')
              .select('id,type')
              .eq('id', req.params.propertyId)
              .eq('wardrobe_id', garment.wardrobe_id)
              .single(),
          ),
        );

      if (!checked(await sb.rpc('has_wardrobe_access', { w: garment.wardrobe_id, editing: true })))
        throw new HttpError(403, 'You do not have permission to edit this wardrobe.');
      validatePropertyValue(property.type, req.body.value);

      const optionIds =
        property.type === 'select'
          ? [uuid.parse(req.body.value)]
          : property.type === 'multi_select'
            ? z.array(uuid).parse(req.body.value)
            : [];

      if (optionIds.length) {
        const options = optionRef
          .array()
          .parse(
            checked(
              await sb
                .from('garment_property_options')
                .select('id')
                .eq('property_id', property.id)
                .in('id', optionIds),
            ),
          );

        if (options.length !== optionIds.length)
          throw new HttpError(400, 'A selected option does not belong to this field.');
      }

      const value = customPropertyValueSchema.parse(
        checked(
          await sb
            .from('garment_property_values')
            .upsert(
              {
                garment_id: garment.id,
                property_id: property.id,
                wardrobe_id: garment.wardrobe_id,
                value: req.body.value,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'garment_id,property_id' },
            )
            .select('*')
            .single(),
        ),
      );

      return value;
    },
  );
  app.delete(
    '/api/garments/:id/custom-properties/:propertyId',
    { schema: { params: customValueParams } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const garment = garmentRef.parse(
        checked(
          await sb.from('garments').select('id,wardrobe_id').eq('id', req.params.id).single(),
        ),
      );

      if (!checked(await sb.rpc('has_wardrobe_access', { w: garment.wardrobe_id, editing: true })))
        throw new HttpError(403, 'You do not have permission to edit this wardrobe.');
      checked(
        await sb
          .from('garment_property_values')
          .delete()
          .eq('garment_id', garment.id)
          .eq('property_id', req.params.propertyId)
          .eq('wardrobe_id', garment.wardrobe_id),
      );

      return { ok: true };
    },
  );
}
