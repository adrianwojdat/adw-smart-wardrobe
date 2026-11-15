import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  buildPackingPrompt,
  validatePackingResult,
} from '../apps/worker/src/jobs/travel-packing/generate.js';
import {
  garmentSchema,
  packingInputSchema,
  packingItemSchema,
  packingProgress,
  packingShortage,
  recommendPackingGarments,
  resizePackingItem,
  tripSchema,
} from '../packages/shared/src/index.ts';

const wardrobe = randomUUID();
const trip = {
  wardrobe_id: wardrobe,
  destination: 'Japan',
  days: 10,
  activity: 'mixed' as const,
  laundry: false,
  light: false,
  notes: '',
  language: 'en' as const,
};
const aiItem = {
  category: 'tops' as const,
  name: 'T-shirts',
  quantity: 10,
  description: 'Daily basics',
  weather_dependent: false,
  match_wardrobe: true,
  subcategory: 't-shirt',
  seasons: [],
  warmth: null,
  material: '',
  style: '',
  occasion: '',
};
const item = () =>
  packingItemSchema.parse({ ...aiItem, id: randomUUID(), assigned: [], packed: 0 });
const garment = (name: string, extra = {}) =>
  garmentSchema.parse({
    id: randomUUID(),
    wardrobe_id: wardrobe,
    owner_id: randomUUID(),
    name,
    category: 'tops',
    created_at: '2026-11-14',
    updated_at: '2026-11-14',
    ...extra,
  });

describe('Travel Packing contracts and generation', () => {
  it('requires destination and positive integer days, but not a departure', () => {
    expect(tripSchema.safeParse(trip).success).toBe(true);
    for (const days of [0, -1, 1.5, 366])
      expect(tripSchema.safeParse({ ...trip, days }).success).toBe(false);
    expect(tripSchema.safeParse({ ...trip, destination: ' ' }).success).toBe(false);
    expect(tripSchema.safeParse({ ...trip, departure: '2026-02-30' }).success).toBe(false);
  });
  it.each(['en', 'pl'] as const)(
    'passes %s language and explicit climate uncertainty without garment data',
    (language) => {
      const prompt = buildPackingPrompt({ ...trip, language });

      expect(prompt).toContain(language === 'pl' ? 'Polish' : 'English');
      expect(prompt).toContain('do not assume a season');
      expect(prompt).toContain('never claim verified weather');
    },
  );
  it('rejects malformed AI, invented garment ids, fractions and oversized lists', () => {
    for (const raw of [
      { items: [] },
      { items: [{ ...aiItem, quantity: 1.2 }] },
      { items: [{ ...aiItem, garment_ids: [randomUUID()] }] },
      { items: Array(81).fill(aiItem) },
    ])
      expect(() => validatePackingResult(raw, trip)).toThrow();
  });
  it('assigns stable app UUIDs only once and initializes progress', () => {
    const result = validatePackingResult({ items: [aiItem] }, trip);

    expect(packingItemSchema.safeParse(result.items[0]).success).toBe(true);
    expect(result.items[0]).toMatchObject({ packed: 0, assigned: [] });
  });
  it('does not match documents to wardrobe', () => {
    expect(
      validatePackingResult(
        { items: [{ ...aiItem, name: 'Passport', category: 'documents' }] },
        trip,
      ).items.find((i) => i.category === 'documents')?.match_wardrobe,
    ).toBe(false);
  });
});
describe('Packing quantities and matching', () => {
  it('reports four missing physical pieces for ten required and six assigned', () => {
    expect(
      packingShortage({ ...item(), assigned: Array.from({ length: 6 }, () => randomUUID()) }),
    ).toBe(4);
  });
  it('ranks clean relevant garments and filters archived and wrong category', () => {
    const clean = garment('T-shirt', { subcategory: 't-shirt' });
    const dirty = garment('Dirty T-shirt', { cleanliness: 'dirty' });
    const archived = garment('Archived', { archived: true });
    const bottom = garment('Trousers', { category: 'bottoms' });

    expect(
      recommendPackingGarments(item(), [dirty, archived, bottom, clean]).map((g) => g.id),
    ).toEqual([clean.id, dirty.id]);
    expect(recommendPackingGarments({ ...item(), match_wardrobe: false }, [clean])).toEqual([]);
  });
  it('clamps packed and assigned counts when reducing quantity', () => {
    const ids = [randomUUID(), randomUUID()];

    expect(resizePackingItem({ ...item(), packed: 8, assigned: ids }, 1)).toMatchObject({
      quantity: 1,
      packed: 1,
      assigned: ids.slice(0, 1),
    });
  });
  it('uses actual packed pieces for progress', () => {
    expect(
      packingProgress([
        { ...item(), packed: 3 },
        { ...item(), quantity: 2, packed: 2 },
      ]),
    ).toEqual({ packed: 5, total: 12, percent: 42 });
    expect(packingProgress([]).percent).toBe(0);
  });
  it('requires explicit reuse consent and never counts duplicate ids within a row', () => {
    const id = randomUUID(),
      first = { ...item(), assigned: [id] },
      second = { ...item(), assigned: [id] };
    const list = { name: 'Japan', trip, items: [first, second], allow_reuse: false };

    expect(packingInputSchema.safeParse(list).success).toBe(false);
    expect(packingInputSchema.safeParse({ ...list, allow_reuse: true }).success).toBe(true);
    expect(packingItemSchema.safeParse({ ...first, assigned: [id, id] }).success).toBe(false);
    expect(packingItemSchema.safeParse({ ...first, packed: 11 }).success).toBe(false);
  });
});

describe('Packing Gemini transport (mock only)', () => {
  it('uses the existing limiter and JSON transport for travel packing', async () => {
    const { runGeminiTask } = await import('../apps/worker/src/integrations/gemini/provider.js');
    let slots = 0;
    const raw = await runGeminiTask({
      apiKey: 'test-key',
      model: 'models/test',
      kind: 'travel_packing',
      prompt: buildPackingPrompt(trip),
      redis: {
        eval: () => {
          slots++;

          return Promise.resolve(0);
        },
      },
      rateKey: 'test',
      rpm: 12,
      signal: new AbortController().signal,
      fetchImpl: (_url, init) => {
        expect(init?.body).toContain('application/json');

        return Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [aiItem] }) }] } }],
            }),
          ),
        );
      },
    });

    expect(slots).toBe(1);
    expect(validatePackingResult(raw, trip).items.length).toBeGreaterThan(20);
  });
  it('rejects invalid model JSON without saving it', async () => {
    const { runGeminiTask } = await import('../apps/worker/src/integrations/gemini/provider.js');

    await expect(
      runGeminiTask({
        apiKey: 'test-key',
        model: 'models/test',
        kind: 'travel_packing',
        prompt: 'test',
        redis: { eval: () => Promise.resolve(0) },
        rateKey: 'test',
        rpm: 12,
        signal: new AbortController().signal,
        fetchImpl: () =>
          Promise.resolve(
            new Response(
              JSON.stringify({ candidates: [{ content: { parts: [{ text: 'broken json' }] } }] }),
            ),
          ),
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
