import { expect, it } from 'vitest';
import { rankFashion } from '../apps/worker/src/fashion';
import { localizeAnalysis } from '../packages/shared/src/index';
it('uses cosine ranking, not embedding magnitude or confidence percentages', () => {
  const labels = [
    { en: 'shirt', pl: 'koszula', vector: [1, 0] },
    { en: 'skirt', pl: 'spódnica', vector: [0, 100] },
  ];
  expect(rankFashion([5, 0], labels)).toEqual([
    { label: 'shirt', label_pl: 'koszula', score: 1 },
    { label: 'skirt', label_pl: 'spódnica', score: 0 },
  ]);
  expect(() => rankFashion([0, 0], labels)).toThrow();
});
it('keeps classifier vocabulary and names Polish', () => {
  const result = localizeAnalysis({
    source: 'photo',
    confidence: 0,
    uncertainties: [],
    suggestions: { category: 'tops', subcategory: 'koszulka polo', primary_color: 'bordowy' },
  });
  expect(result.suggestions.warmth).toBe(2);
  expect(result.suggestions.material).toBeUndefined();
  expect(result.suggestions).toMatchObject({
    name: 'Bordowa koszulka polo',
    subcategory: 'Koszulka polo',
    primary_color: 'bordowy',
  });
});
