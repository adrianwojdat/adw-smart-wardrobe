import { expect, it } from 'vitest';

import { deriveWarmth, localizeAnalysis } from '../packages/shared/src/index.ts';

it.each([
  ['tops', 'T-shirt', 1],
  ['tops', 'top', 1],
  ['tops', 'koszulka bez rękawów', 1],
  ['bottoms', 'Krótkie spodenki', 1],
  ['tops', 'Koszula', 2],
  ['tops', 'koszulka polo', 2],
  ['bottoms', 'Jeansy', 2],
  ['bottoms', 'Chinosy', 2],
  ['bottoms', 'Długie spodnie', 2],
  ['tops', 'Bluza', 3],
  ['tops', 'Sweter', 3],
  ['outerwear', 'Marynarka', 3],
  ['outerwear', 'Kurtka przejściowa', 4],
  ['outerwear', 'Kurtka zimowa', 5],
] as const)('%s / %s derives %i', (category, sub, warmth) =>
  expect(deriveWarmth(category, sub)).toBe(warmth),
);
it('never invents accessory warmth', () => {
  for (const sub of ['Pasek', 'Zegarek', 'Biżuteria'])
    expect(deriveWarmth('accessories', sub)).toBeUndefined();
});
it('replaces visual AI heat guesses with shared rules', () => {
  const result = localizeAnalysis({
    source: 'photo',
    confidence: 0.8,
    uncertainties: [],
    suggestions: { category: 'tops', subcategory: 'T-shirt', warmth: 5 },
  });

  expect(result.suggestions.warmth).toBe(1);

  const accessory = localizeAnalysis({
    source: 'photo',
    confidence: 0.8,
    uncertainties: [],
    suggestions: { category: 'accessories', subcategory: 'Pasek', warmth: 4 },
  });

  expect(accessory.suggestions.warmth).toBeUndefined();
});
it('uses the newly selected category even when an old subtype has not been edited yet', () => {
  expect(deriveWarmth('outerwear', 'T-shirt')).toBe(4);
  expect(deriveWarmth('tops', 'Kurtka zimowa')).toBe(1);
});
