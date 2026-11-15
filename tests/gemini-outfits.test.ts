import { describe, expect, it } from 'vitest';

import {
  buildOutfitPrompt,
  validateGeminiOutfits,
} from '../apps/worker/src/jobs/outfit-generation/gemini-outfits.ts';
import type { OutfitRecommendationRequest } from '../packages/shared/src/index.ts';

const request: OutfitRecommendationRequest = {
  wardrobe_id: '11111111-1111-4111-8111-111111111111',
  occasion: 'everyday',
  temperature: 18,
  count: 2,
};
const garments = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Biała koszulka',
    category: 'tops',
    subcategory: 't-shirt',
    primary_color: 'biały',
    seasons: ['summer'],
    warmth: 1,
    style: 'casual',
    occasions: ['everyday'],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Granatowe jeansy',
    category: 'bottoms',
    subcategory: 'jeans',
    primary_color: 'granatowy',
    seasons: ['spring', 'autumn'],
    warmth: 2,
    style: 'casual',
    occasions: ['everyday'],
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Białe sneakersy',
    category: 'shoes',
    subcategory: 'sneakers',
    primary_color: 'biały',
    seasons: ['spring', 'summer'],
    warmth: 1,
    style: 'casual',
    occasions: ['everyday'],
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Granatowa marynarka',
    category: 'outerwear',
    subcategory: 'marynarka',
    primary_color: 'granatowy',
    seasons: ['spring', 'autumn'],
    warmth: 3,
    style: 'smart casual',
    occasions: ['office', 'everyday'],
  },
];
const profile = { schema_version: 1 as const, answers: {}, skipped: [] };
const valid = {
  outfits: [
    {
      id: '1',
      name: 'Lekki smart casual',
      garment_ids: garments.slice(0, 3).map((g) => g.id),
      rationale: 'Granat równoważy biel, a zestaw pasuje do codziennej okazji.',
      missing_items: [],
    },
  ],
};

describe('Gemini outfit composition and validation', () => {
  it('builds an English instruction prompt with only the supplied structured wardrobe/profile/context', () => {
    const prompt = buildOutfitPrompt({
      request: { ...request, requirements: 'wygodne na spacer' },
      profile,
      garments,
    });

    expect(prompt).toContain('in English');
    expect(prompt).toContain('wygodne na spacer');
    expect(prompt).toContain(garments[0]!.id);
    expect(prompt).toContain('hard_constraints');
    expect(prompt).not.toContain('owner_id');
    expect(prompt).not.toContain('path');
  });

  it('selects Polish generated prose explicitly while keeping instructions in English', () => {
    const prompt = buildOutfitPrompt({
      request: { ...request, language: 'pl' },
      profile,
      garments,
    });

    expect(prompt).toContain('in Polish');
    expect(prompt).toContain('hard_constraints');
    expect(prompt).not.toContain('Odpowiedz');
  });

  it('accepts a complete outfit made solely from available garments', () => {
    expect(validateGeminiOutfits(valid, { request, profile, garments }).outfits).toHaveLength(1);
  });

  it('rejects unknown or foreign garment IDs and duplicate IDs', () => {
    expect(() =>
      validateGeminiOutfits(
        {
          outfits: [
            {
              ...valid.outfits[0],
              garment_ids: [
                ...valid.outfits[0]!.garment_ids,
                '66666666-6666-4666-8666-666666666666',
              ],
            },
          ],
        },
        { request, profile, garments },
      ),
    ).toThrow();
    expect(() =>
      validateGeminiOutfits(
        {
          outfits: [
            {
              ...valid.outfits[0],
              garment_ids: [garments[0]!.id, garments[0]!.id, garments[1]!.id, garments[2]!.id],
            },
          ],
        },
        { request, profile, garments },
      ),
    ).toThrow();
  });

  it('rejects combinations prohibited by the structured profile', () => {
    const strictProfile = { ...profile, answers: { q11_blazer_with_tshirt: 'no' } };

    expect(() =>
      validateGeminiOutfits(
        {
          outfits: [
            {
              ...valid.outfits[0],
              garment_ids: [garments[0]!.id, garments[1]!.id, garments[2]!.id, garments[3]!.id],
            },
          ],
        },
        { request, profile: strictProfile, garments },
      ),
    ).toThrow();
  });

  it('allows an explicitly identified missing shoe, but never more than two missing items', () => {
    const partial = {
      outfits: [
        {
          ...valid.outfits[0],
          garment_ids: [garments[0]!.id, garments[1]!.id],
          missing_items: [{ category: 'shoes', description: 'Białe, minimalistyczne sneakersy' }],
        },
      ],
    };

    expect(validateGeminiOutfits(partial, { request, profile, garments }).outfits).toHaveLength(1);
    expect(() =>
      validateGeminiOutfits(
        {
          outfits: [
            {
              ...partial.outfits[0],
              missing_items: [
                ...partial.outfits[0]!.missing_items,
                { category: 'outerwear', description: 'Kurtka' },
                { category: 'accessories', description: 'Pasek' },
              ],
            },
          ],
        },
        { request, profile, garments },
      ),
    ).toThrow();
  });

  it('rejects duplicate combinations and incomplete outfits without explicit missing roles', () => {
    expect(
      validateGeminiOutfits(
        { outfits: [valid.outfits[0], { ...valid.outfits[0], id: '2', name: 'Powtórka' }] },
        { request, profile, garments },
      ).outfits,
    ).toHaveLength(1);
    expect(() =>
      validateGeminiOutfits(
        { outfits: [{ ...valid.outfits[0], garment_ids: [garments[0]!.id] }] },
        { request, profile, garments },
      ),
    ).toThrow();
  });
});

describe('shared style-profile ranking in the active Gemini pipeline', () => {
  it('uses exactly the shared interpretation in the prompt without assuming extension answers', async () => {
    const { interpretStyleProfile } = await import('../packages/shared/src/index.ts');
    const legacy = { ...profile, answers: { q28_remind_rarely_worn: false } };
    const prompt = buildOutfitPrompt({ request, profile: legacy, garments });
    const data: unknown = JSON.parse(prompt.split('Input data:\n')[1]!);

    expect(data).toMatchObject({ profile_summary: interpretStyleProfile(legacy.answers) });
  });
  it('reorders valid alternatives using soft color preferences without excluding the others', () => {
    const alternative = {
      ...garments[0]!,
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Bordowy T-shirt',
      primary_color: 'burgundy',
    };
    const raw = {
      outfits: [
        valid.outfits[0]!,
        {
          ...valid.outfits[0]!,
          id: '2',
          garment_ids: [alternative.id, garments[1]!.id, garments[2]!.id],
        },
      ],
    };
    const ranked = validateGeminiOutfits(raw, {
      request,
      profile: {
        ...profile,
        answers: { q32_colors: ['burgundy'], q34_preference_strength: { colors: 'strong' } },
      },
      garments: [...garments, alternative],
    });

    expect(ranked.outfits.map((o) => o.id)).toEqual(['2', '1']);
  });
});
