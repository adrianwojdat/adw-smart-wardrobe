import { expect, it } from 'vitest';
import {
  garmentSchema,
  garmentRole,
  thermalCompatible,
  recommend,
  type Garment,
} from '../packages/shared/src/index';
export const item = (n: number, category: Garment['category'], extra: Partial<Garment> = {}) =>
  garmentSchema.parse({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    wardrobe_id: '00000000-0000-4000-8000-000000000100',
    owner_id: '00000000-0000-4000-8000-000000000101',
    name: 'Test',
    category,
    created_at: '2026-11-10',
    updated_at: '2026-11-10',
    ...extra,
  });
it('permits a light base under a genuine winter coat, not a blazer', () => {
  const base = item(1, 'tops', { warmth: 1, subcategory: 'T-shirt' }),
    bottom = item(2, 'bottoms');
  expect(
    thermalCompatible(
      [base, bottom, item(3, 'outerwear', { subcategory: 'Kurtka zimowa', warmth: 5 })],
      0,
    ),
  ).toBe(true);
  expect(
    thermalCompatible(
      [base, bottom, item(3, 'outerwear', { subcategory: 'Marynarka', warmth: 3 })],
      0,
    ),
  ).toBe(false);
});
it('does not use a cardigan as the only base or warm clothes at 40 degrees', () => {
  expect(garmentRole(item(1, 'tops', { subcategory: 'Kardigan' }))).toBe('mid');
  expect(
    recommend([item(1, 'tops', { subcategory: 'Kardigan' }), item(2, 'bottoms')], 'everyday'),
  ).toEqual([]);
  expect(
    thermalCompatible([item(1, 'tops', { warmth: 5 }), item(2, 'bottoms', { warmth: 5 })], 40),
  ).toBe(false);
});

it('scores known compatible styles above missing data without forbidding mixtures', async () => {
  const { styleDecision } = await import('../packages/shared/src/outfit-scoring');
  expect(
    styleDecision([item(1, 'tops', { style: 'casual' }), item(2, 'bottoms', { style: 'casual' })])
      .value,
  ).toBeGreaterThan(styleDecision([item(1, 'tops'), item(2, 'bottoms')]).value);
  expect(
    styleDecision([
      item(1, 'tops', { style: 'sportowy' }),
      item(2, 'bottoms', { style: 'formalny' }),
    ]).value,
  ).toBeGreaterThan(0);
});
