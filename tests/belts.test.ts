import { expect, it } from 'vitest';
import {
  garmentSchema,
  recommend,
  recommendBelt,
  beltCompatible,
  type Garment,
} from '../packages/shared/src/index';
const item = (id: number, category: Garment['category'], extra: Partial<Garment> = {}) =>
  garmentSchema.parse({
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    wardrobe_id: '00000000-0000-4000-8000-000000000100',
    owner_id: '00000000-0000-4000-8000-000000000001',
    name: 'Test ' + id,
    category,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...extra,
  });
const pants = item(1, 'bottoms', { subcategory: 'Chinosy', primary_color: 'beżowy', warmth: 2 });
const top = item(2, 'tops', { subcategory: 'Sweter', warmth: 3 });
const brown = item(3, 'accessories', {
  name: 'Brązowy pasek',
  subcategory: 'Pasek',
  primary_color: 'brązowy',
  warmth: 1,
});
const black = item(4, 'accessories', {
  name: 'Czarny pasek',
  subcategory: 'Pasek',
  primary_color: 'czarny',
});
it('adds an owned belt as an optional addition to chinos without replacing base clothes', () => {
  const outfits = recommend([top, pants, brown], 'everyday');
  expect(outfits).toEqual([[top, pants, brown]]);
  expect(recommend([top, pants], 'everyday')).toEqual([[top, pants]]);
});
it.each([
  'Dresy',
  'Spodnie dresowe',
  'Legginsy',
  'Spodnie legginsy',
  'Joggers',
  'Spodnie na gumkę',
  'Spódnica',
])('does not add a belt to %s', (subcategory) => {
  const garment = { ...pants, subcategory };
  expect(beltCompatible(garment)).toBe(false);
  expect(recommendBelt([top, garment], [brown, black])).toBeUndefined();
});
it('prefers a compatible neutral shoe color over a weaker trouser match', () => {
  const shoes = item(5, 'shoes', {
    primary_color: 'czarny',
    style: 'Formalny',
    subcategory: 'Półbuty',
  });
  expect(recommendBelt([top, pants, shoes], [brown, black])?.id).toBe(black.id);
  expect(
    recommendBelt([top, pants, { ...shoes, primary_color: 'brązowy' }], [black, brown])?.id,
  ).toBe(brown.id);
});
it('does not use unavailable or foreign belts and does not invent missing accessories', () => {
  expect(
    recommendBelt(
      [top, pants],
      [
        { ...brown, cleanliness: 'dirty' },
        { ...black, archived: true },
        { ...brown, wardrobe_id: '00000000-0000-4000-8000-000000000200' },
      ],
    ),
  ).toBeUndefined();
  expect(
    recommendBelt([top, pants], [item(6, 'accessories', { name: 'Zegarek' })]),
  ).toBeUndefined();
});
it('does not treat accessory warmth as clothing warmth', () => {
  expect(recommend([top, pants, brown], 'everyday', 5)[0]?.map((g) => g.id)).toContain(brown.id);
  expect(brown.warmth).toBe(1);
});
it('respects belt occasion availability and avoids sport belts with formal clothes', () => {
  expect(recommend([top, pants, { ...brown, occasions: ['office'] }], 'date')[0]).toEqual([
    top,
    pants,
  ]);
  expect(
    recommendBelt([{ ...pants, style: 'Formalny' }], [{ ...black, style: 'Sportowy' }]),
  ).toBeUndefined();
});
