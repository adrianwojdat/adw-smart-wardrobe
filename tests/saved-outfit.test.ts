import { describe, expect, it } from 'vitest';

import { outfitInput, outfitSchema } from '../packages/shared/src/index.ts';

const oldOutfit = {
  wardrobe_id: 'a7410000-0000-4000-8000-000000000001',
  name: 'Codzienny zestaw',
  occasion: 'everyday' as const,
  garment_ids: ['a7420000-0000-4000-8000-000000000001'],
  id: 'a7430000-0000-4000-8000-000000000001',
  created_by: 'a7400000-0000-4000-8000-000000000001',
  created_at: '2026-11-11T12:00:00.000Z',
};

describe('saved outfit descriptions', () => {
  it('accepts Gemini rationale, wearing advice and explicit missing items on save', () => {
    const saved = outfitInput.parse({
      ...oldOutfit,
      rationale: 'Granatowa marynarka pasuje do biura.',
      wearing_tips: 'Podwiń rękawy.',
      missing_items: [{ category: 'shoes', description: 'Brązowe loafersy' }],
    });

    expect(saved).toMatchObject({
      rationale: 'Granatowa marynarka pasuje do biura.',
      wearing_tips: 'Podwiń rękawy.',
      missing_items: [{ category: 'shoes', description: 'Brązowe loafersy' }],
    });
  });

  it('keeps old favorites compatible and defaults to no description or missing items', () => {
    expect(outfitSchema.parse({ ...oldOutfit, temperature: null })).toMatchObject({
      rationale: null,
      wearing_tips: null,
      missing_items: [],
    });
  });

  it('limits saved missing items to the same maximum of two as generated outfits', () => {
    expect(() =>
      outfitInput.parse({
        ...oldOutfit,
        missing_items: [
          { category: 'tops', description: 'Koszula' },
          { category: 'bottoms', description: 'Spodnie' },
          { category: 'shoes', description: 'Buty' },
        ],
      }),
    ).toThrow();
  });
});
