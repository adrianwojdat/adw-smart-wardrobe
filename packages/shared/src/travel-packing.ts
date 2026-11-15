import { z } from 'zod';

import { type Garment, garmentSchema } from './garment.js';
import {
  identifyPackingKey,
  packingGarmentMatches,
  packingGroups,
  packingKeys,
} from './travel-packing/catalog.js';

export const tripSchema = z
  .object({
    wardrobe_id: z.uuid(),
    destination: z.string().trim().min(1).max(160),
    days: z.number().int().min(1).max(365),
    departure: z.iso.date().optional(),
    activity: z.enum(['sightseeing', 'relaxation', 'business', 'active', 'mixed']),
    laundry: z.boolean(),
    light: z.boolean(),
    notes: z.string().trim().max(1000),
    language: z.enum(['en', 'pl']),
  })
  .strict();
export const packingAiItemSchema = z
  .object({
    packing_key: z.enum(packingKeys).optional(),
    packing_group: z.enum(packingGroups).optional(),
    optional: z.boolean().optional(),
    generation_source: z.enum(['baseline', 'ai', 'fallback']).optional(),
    category: z.enum([
      'tops',
      'bottoms',
      'dresses',
      'outerwear',
      'shoes',
      'accessories',
      'underwear',
      'toiletries',
      'documents',
      'electronics',
      'other',
    ]),
    name: z.string().trim().min(1).max(120),
    quantity: z.number().int().min(1).max(365),
    description: z.string().max(500),
    weather_dependent: z.boolean(),
    match_wardrobe: z.boolean(),
    subcategory: z.string().max(120),
    seasons: z.array(z.string().max(30)).max(4),
    warmth: z.number().int().min(1).max(5).nullable(),
    material: z.string().max(120),
    style: z.string().max(120),
    occasion: z.string().max(60),
  })
  .strict();
export const packingAiResultSchema = z
  .object({ items: z.array(packingAiItemSchema).min(1).max(80) })
  .strict();
export const packingItemSchema = packingAiItemSchema
  .extend({
    id: z.uuid(),
    assigned: z.array(z.uuid()).max(365),
    packed: z.number().int().min(0).max(365),
  })
  .superRefine((v, c) => {
    if (
      v.packed > v.quantity ||
      v.assigned.length > v.quantity ||
      new Set(v.assigned).size !== v.assigned.length
    )
      c.addIssue({ code: 'custom', message: 'Invalid quantities' });
    if (!v.match_wardrobe && v.assigned.length)
      c.addIssue({ code: 'custom', message: 'Non wardrobe item' });
  });
export const packingInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    trip: tripSchema,
    items: z.array(packingItemSchema).min(1).max(80),
    allow_reuse: z.boolean(),
  })
  .strict()
  .superRefine((v, c) => {
    const ids = v.items.flatMap((i) => i.assigned);

    if (!v.allow_reuse && new Set(ids).size !== ids.length)
      c.addIssue({ code: 'custom', message: 'Garment reused without consent' });
    if (new Set(v.items.map((i) => i.id)).size !== v.items.length)
      c.addIssue({ code: 'custom', message: 'Duplicate item' });
  });
// Database rows include tenant columns; strip them from responses while keeping write input strict.
export const packingListSchema = packingInputSchema
  .extend({
    id: z.uuid(),
    updated_at: z.string(),
  })
  .strip();
export type Trip = z.infer<typeof tripSchema>;
export type PackingItem = z.infer<typeof packingItemSchema>;
export type PackingInput = z.infer<typeof packingInputSchema>;
export type PackingList = z.infer<typeof packingListSchema>;

export function packingProgress(items: PackingItem[]) {
  const total = items.reduce((n, i) => n + i.quantity, 0);
  const packed = items.reduce((n, i) => n + Math.min(i.packed, i.quantity), 0);

  return { total, packed, percent: total ? Math.round((100 * packed) / total) : 0 };
}

export function packingShortage(item: PackingItem) {
  return item.match_wardrobe ? Math.max(0, item.quantity - item.assigned.length) : 0;
}

export function resizePackingItem(item: PackingItem, quantity: number): PackingItem {
  const next = Math.max(1, Math.min(365, Math.trunc(quantity) || 1));

  return {
    ...item,
    quantity: next,
    packed: Math.min(item.packed, next),
    assigned: item.assigned.slice(0, next),
  };
}

export function recommendPackingGarments(item: PackingItem, garments: Garment[]) {
  if (!item.match_wardrobe) return [];

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const key = item.packing_key ?? identifyPackingKey(item.name);

  return garments
    .filter((g) => !key || packingGarmentMatches(key, g.name, g.subcategory))
    .filter(
      (g) =>
        !g.archived &&
        (g.category === item.category ||
          (item.category === 'underwear' &&
            g.category === 'accessories' &&
            /sock|underwear|brief|boxer|bra|skarpet|bieliz|majtki|biustonosz/.test(
              norm(g.subcategory + ' ' + g.name),
            ))),
    )
    .map((g) => ({
      garment: g,
      score:
        (g.cleanliness === 'clean' ? 8 : -8) +
        (g.garment_images.length ? 2 : 0) +
        (item.subcategory && norm(g.subcategory).includes(norm(item.subcategory)) ? 12 : 0) +
        (item.seasons.some((s) => g.seasons.some((season) => season === s)) ? 4 : 0) +
        (item.warmth === null ? 0 : 5 - Math.abs(g.warmth - item.warmth) * 2) +
        (item.material && norm(g.material).includes(norm(item.material)) ? 3 : 0) +
        (item.style && norm(g.style).includes(norm(item.style)) ? 3 : 0) +
        (g.occasions.some((o) => o === item.occasion) ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.garment.id.localeCompare(b.garment.id))
    .map((v) => v.garment);
}

export const packingRecommendationsSchema = z.object({
  wardrobe_count: z.number().int().nonnegative(),
  items: z.record(z.string(), z.array(garmentSchema)),
});
