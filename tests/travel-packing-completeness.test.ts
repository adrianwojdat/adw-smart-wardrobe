import { describe, expect, it } from 'vitest';

import {
  generatePackingWithFallback,
  validatePackingResult,
} from '../apps/worker/src/jobs/travel-packing/generate.ts';
import {
  buildBasePackingList,
  garmentSchema,
  packingCatalog,
  packingContext,
  packingGroups,
  packingInputSchema,
  packingItemSchema,
  type PackingKey,
  packingListSchema,
  packingProgress,
  recommendPackingGarments,
  type Trip,
} from '../packages/shared/src/index.ts';

const trip: Trip = {
  wardrobe_id: 'a7000000-0000-4000-8000-000000000001',
  destination: 'Japonia',
  days: 10,
  departure: '2026-11-16',
  activity: 'mixed',
  laundry: false,
  light: false,
  notes: '',
  language: 'pl',
};
const keyed = (input: Trip) => new Map(buildBasePackingList(input).map((i) => [i.packing_key, i]));
const essentials: PackingKey[] = [
  'briefs',
  'short_socks',
  'long_socks',
  'tshirt',
  'shirt',
  'trousers',
  'hoodie',
  'walking_shoes',
  'pyjamas',
  'toothbrush',
  'toothpaste',
  'deodorant',
  'shampoo',
  'body_wash',
  'charger',
  'identity',
  'payment',
  'dressings',
];

describe('deterministic packing completeness', () => {
  it('covers all thirteen typed categories and specific candidates', () => {
    expect(packingGroups).toHaveLength(13);
    expect(new Set(Object.values(packingCatalog).map((i) => i.group)).size).toBe(13);
  });
  it('Japan, November, ten days, no laundry preserves independent essentials', () => {
    const items = keyed(trip);

    for (const key of essentials) {
      expect(items.has(key), key).toBe(true);
      expect(items.get(key)?.quantity).toBeGreaterThan(0);
    }

    expect(items.get('briefs')?.quantity).toBe(12);
    expect(items.get('short_socks')!.quantity + items.get('long_socks')!.quantity).toBe(12);
    expect(items.get('tshirt')?.quantity).toBe(7);
    expect(items.get('trousers')?.quantity).toBe(3);
    expect(items.get('spare_shoes')?.optional).toBe(true);
    expect(items.has('bra')).toBe(false);
    expect(items.has('swimsuit')).toBe(false);

    for (const i of items.values()) {
      expect(i.quantity).toBeLessThanOrEqual(20);
      expect(packingItemSchema.safeParse(i).success).toBe(true);
    }
  });
  it('uses distinct counts for three days of hand luggage', () => {
    const items = keyed({ ...trip, days: 3, light: true });

    expect(items.get('briefs')?.quantity).toBe(4);
    expect(items.get('trousers')?.quantity).toBe(1);
    expect(items.has('spare_shoes')).toBe(false);
  });
  it('laundry reduces fourteen-day requirements instead of multiplying all clothes', () => {
    const laundry = keyed({ ...trip, days: 14, laundry: true });
    const noLaundry = keyed({ ...trip, days: 14 });

    expect(laundry.get('briefs')?.quantity).toBe(5);
    expect(laundry.get('briefs')!.quantity).toBeLessThan(noLaundry.get('briefs')!.quantity);
  });
  it('distinguishes summer, winter and unknown dates without inventing weather', () => {
    const summer = keyed({ ...trip, departure: '2026-07-10' }),
      winter = keyed({ ...trip, departure: '2026-01-10' });

    expect(summer.has('shorts')).toBe(true);
    expect(summer.has('gloves')).toBe(false);
    expect(winter.has('gloves')).toBe(true);
    expect(packingContext({ ...trip, departure: undefined }).climate).toBe('unknown');
    for (const i of keyed({ ...trip, departure: undefined }).values())
      expect(i.seasons).toEqual([]);
    expect(keyed({ ...trip, destination: 'Unknown region' }).get('jacket')?.weather_dependent).toBe(
      true,
    );
  });
  it('adapts business shirts and user-declared pool or shared showers', () => {
    expect(keyed({ ...trip, activity: 'business' }).get('shirt')?.quantity).toBe(5);
    expect(keyed({ ...trip, notes: 'Basen i wspólne prysznice' }).has('flip_flops')).toBe(true);
    expect(keyed({ ...trip, notes: 'hostel' }).has('swimsuit')).toBe(false);
  });
  it('supports explicit exclusions without inferring gender from destination or notes', () => {
    expect(keyed({ ...trip, notes: 'no T-shirts' }).has('tshirt')).toBe(false);
    expect(keyed({ ...trip, notes: 'bez majtek' }).has('briefs')).toBe(false);
    expect(keyed({ ...trip, notes: 'Brazil' }).has('bra')).toBe(false);
  });
  it.each(['en', 'pl'] as const)('produces baseline names in %s', (language) => {
    expect(keyed({ ...trip, language }).get('briefs')?.name).toBe(
      language === 'en' ? 'Underpants' : 'Majtki',
    );
  });
});
describe('AI enrichment and completeness repair', () => {
  it('repairs the reported sparse response and removes generic underwear bundles', () => {
    const { id: _, assigned: __, packed: ___, ...sample } = buildBasePackingList(trip)[0]!;
    const items = validatePackingResult(
      {
        items: [
          { ...sample, name: 'Bielizna', packing_key: undefined },
          { ...sample, name: 'Kurtka', packing_key: undefined, category: 'outerwear' },
        ],
      },
      trip,
    );

    expect(items.items.some((i) => i.name === 'Bielizna')).toBe(false);
    expect(items.items.length).toBeGreaterThan(20);
  });
  it('merges typed duplicates, validates names and types, and cannot omit core items', () => {
    const base = buildBasePackingList(trip).find((i) => i.packing_key === 'tshirt')!;
    const { id: _, assigned: __, packed: ___, ...ai } = base;
    const result = validatePackingResult(
      {
        adjustments: [
          { key: 'briefs', quantity: 0, reason: 'Forgot basics' },
          { key: 'tshirt', quantity: 1, reason: 'Reuse' },
          { key: 'belt', quantity: 0, reason: 'No belt needed' },
        ],
        additions: [
          ai,
          ai,
          { ...ai, name: 'Bielizna', packing_key: undefined },
          { ...ai, name: 'Koszule', category: 'shoes', packing_key: undefined },
        ],
      },
      trip,
    );

    expect(result.items.filter((i) => i.packing_key === 'tshirt')).toHaveLength(1);
    expect(result.items.find((i) => i.packing_key === 'briefs')?.quantity).toBeGreaterThanOrEqual(
      10,
    );
    expect(result.items.find((i) => i.packing_key === 'tshirt')?.quantity).toBeGreaterThanOrEqual(
      5,
    );
    expect(result.items.find((i) => i.packing_key === 'shirt')?.category).toBe('tops');
    expect(result.items.some((i) => i.name === 'Bielizna')).toBe(false);
    expect(result.items.some((i) => i.packing_key === 'belt')).toBe(false);
  });
  it('fills all omissions without a second AI call', async () => {
    let calls = 0;
    const result = await generatePackingWithFallback(
      trip,
      () => {
        calls++;

        return Promise.resolve({ adjustments: [], additions: [] });
      },
      new AbortController().signal,
    );

    expect(calls).toBe(1);
    for (const key of essentials)
      expect(
        result.items.some((i) => i.packing_key === key),
        key,
      ).toBe(true);
  });
  it('returns an explicitly marked baseline on no response or invalid response', async () => {
    for (const call of [
      () => Promise.reject(new Error('offline')),
      () => Promise.resolve({ bad: true }),
      () => Promise.resolve({ items: [] }),
    ]) {
      const result = await generatePackingWithFallback(trip, call, new AbortController().signal);

      expect(result.items.every((i) => i.generation_source === 'fallback')).toBe(true);
      expect(result.items.some((i) => i.packing_key === 'briefs')).toBe(true);
    }
  });
  it('does not turn user cancellation into a completed fallback', async () => {
    const controller = new AbortController();

    controller.abort('cancelled');
    await expect(
      generatePackingWithFallback(
        trip,
        () => Promise.reject(new Error('cancelled')),
        controller.signal,
      ),
    ).rejects.toThrow('cancelled');
  });
  it('does not rewrite saved legacy rows or reset manual progress', () => {
    const first = buildBasePackingList(trip)[0]!;
    const {
      packing_key: _,
      packing_group: __,
      generation_source: ___,
      optional: ____,
      ...legacy
    } = first;
    const saved = {
      id: crypto.randomUUID(),
      updated_at: '2026-11-14',
      name: 'Manual',
      trip,
      allow_reuse: false,
      items: [{ ...legacy, name: 'My edited row', quantity: 3, packed: 2 }],
    };
    const before = JSON.stringify(saved);
    const parsed = packingListSchema.parse(saved);

    expect(JSON.stringify(saved)).toBe(before);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.packed).toBe(2);
    expect(packingProgress(parsed.items).packed).toBe(2);
  });
  it('preserves clothes with no wardrobe match, and excludes unrelated tops', () => {
    const tshirt = buildBasePackingList(trip).find((i) => i.packing_key === 'tshirt')!;

    expect(recommendPackingGarments(tshirt, [])).toEqual([]);

    const garment = (name: string) =>
      garmentSchema.parse({
        id: crypto.randomUUID(),
        wardrobe_id: trip.wardrobe_id,
        owner_id: trip.wardrobe_id,
        category: 'tops',
        name,
        created_at: '2026-11-14',
        updated_at: '2026-11-14',
      });
    const tee = garment('Koszulka T-shirt'),
      shirt = garment('Koszula biała'),
      hoodie = garment('Bluza');

    expect(recommendPackingGarments(tshirt, [shirt, hoodie, tee]).map((g) => g.id)).toEqual([
      tee.id,
    ]);
    expect(buildBasePackingList(trip).some((i) => i.packing_key === 'briefs')).toBe(true);
  });
});

describe('packing database response compatibility', () => {
  it('reads full Supabase rows without leaking tenant columns; writes stay strict', () => {
    const row = {
      id: crypto.randomUUID(),
      user_id: trip.wardrobe_id,
      wardrobe_id: trip.wardrobe_id,
      name: 'Existing trip',
      trip,
      items: buildBasePackingList(trip),
      allow_reuse: false,
      updated_at: '2026-11-14',
    };
    const parsed = packingListSchema.parse(row);

    expect(parsed.items).toEqual(row.items);
    expect(parsed).not.toHaveProperty('user_id');
    expect(parsed).not.toHaveProperty('wardrobe_id');

    const { id: _, updated_at: __, ...input } = row;

    expect(packingInputSchema.safeParse(input).success).toBe(false);
  });
});
