import { readFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';

import { analyzeFashion, rankFashion } from '../apps/worker/src/jobs/garment-analysis/fashion.ts';
import { localizeAnalysis } from '../packages/shared/src/index.ts';

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

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
vi.mock('onnxruntime-node', () => ({}));

it('loads classifier assets from the repository root used by the Docker image', async () => {
  const unavailable = new Error('Model fixture intentionally unavailable');

  vi.mocked(readFile).mockRejectedValueOnce(unavailable);

  await expect(analyzeFashion(Buffer.alloc(0))).rejects.toBe(unavailable);
  expect(readFile).toHaveBeenCalledWith(
    new URL('../infra/models/fashion-siglip/prototypes.json', import.meta.url),
    'utf8',
  );
});
