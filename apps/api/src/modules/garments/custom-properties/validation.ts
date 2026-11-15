import { z } from 'zod';

import { customPropertyTypes, uuid } from '@wardrobe/shared';

import { HttpError } from '../../auth/session.js';

export const idParams = z.object({ id: uuid });
export const customValueParams = z.object({ id: uuid, propertyId: uuid });
export const garmentRef = z.object({ id: uuid, wardrobe_id: uuid });
export const optionProperty = z.object({
  id: uuid,
  wardrobe_id: uuid,
  type: z.enum(customPropertyTypes),
});
export const optionRef = z.object({ id: uuid });

export function validatePropertyValue(type: (typeof customPropertyTypes)[number], value: unknown) {
  const valid = (() => {
    switch (type) {
      case 'text':
        return z.string().max(1000).safeParse(value).success;
      case 'number':
        return z.number().finite().safeParse(value).success;
      case 'currency':
        return z
          .object({ amount: z.number().finite().min(0), currency: z.string().regex(/^[A-Z]{3}$/) })
          .strict()
          .safeParse(value).success;

      case 'date': {
        if (
          !z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .safeParse(value).success
        )
          return false;

        const date = new Date(`${String(value)}T00:00:00.000Z`);

        return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
      }

      case 'select':
        return uuid.safeParse(value).success;
      case 'multi_select':
        return z
          .array(uuid)
          .max(50)
          .refine((items) => new Set(items).size === items.length)
          .safeParse(value).success;
      case 'boolean':
        return z.boolean().safeParse(value).success;
    }
  })();

  if (!valid) throw new HttpError(400, 'The value does not match the custom property type.');
}
