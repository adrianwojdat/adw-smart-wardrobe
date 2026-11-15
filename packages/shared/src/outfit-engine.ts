import type { Garment } from './garment.js';
import { beltCandidates } from './outfit-accessories.js';
import { evaluateOutfit, scoreWeights, type Weights } from './outfit-scoring.js';
import { fold } from './outfit-text.js';

export { fold } from './outfit-text.js';
export type Role = 'base' | 'mid' | 'outer' | 'bottom' | 'dress' | 'shoes' | 'accessory';

export function garmentRole(g: Garment): Role {
  if (g.category === 'tops')
    return /sweter|sweater|bluza|hoodie|kardigan|cardigan|sweatshirt/.test(fold(g.subcategory))
      ? 'mid'
      : 'base';

  return (
    {
      bottoms: 'bottom',
      dresses: 'dress',
      outerwear: 'outer',
      shoes: 'shoes',
      accessories: 'accessory',
    } as const
  )[g.category];
}

/** Ordinal warmth is never summed. These conservative temperature bands are heuristics. */
export function thermalCompatible(items: Garment[], temperature: number): boolean {
  const base = items.find((g) => ['base', 'dress'].includes(garmentRole(g)));

  if (!base) return false;

  const mid = items.find((g) => garmentRole(g) === 'mid');
  const outer = items.find((g) => garmentRole(g) === 'outer');
  const winter =
    outer && /zimow|winter|puchow|down jacket/.test(fold(outer.subcategory)) && outer.warmth >= 4;
  const coat = outer && !/marynark|blazer/.test(fold(outer.subcategory)) && outer.warmth >= 4;

  if (temperature < 5 && !winter) return false;
  if (temperature >= 5 && temperature < 12 && !coat) return false;
  if (
    temperature < 14 &&
    items.some(
      (g) => garmentRole(g) === 'bottom' && /szort|short|krotkie/.test(fold(g.subcategory)),
    )
  )
    return false;
  if (temperature >= 12 && temperature < 16 && !mid && !outer) return false;
  if (
    temperature < 12 &&
    items.some((g) => g.category === 'shoes' && /sanda|klapk|flip.flop/i.test(g.subcategory))
  )
    return false;
  if (temperature >= 22 && outer) return false;
  if (
    temperature >= 26 &&
    (mid ||
      items.some((g) => ['base', 'bottom', 'dress'].includes(garmentRole(g)) && g.warmth >= 3))
  )
    return false;
  if (temperature >= 18 && mid && outer) return false;

  return true;
}

export function generateOutfits(
  garments: Garment[],
  occasion: string,
  temperature = 18,
  random: () => number = Math.random,
  options: { weights?: Weights; minimumScore?: number } = {},
): Garment[][] {
  const wardrobe = garments[0]?.wardrobe_id;
  const available = garments.filter(
    (g) =>
      g.wardrobe_id === wardrobe &&
      !g.archived &&
      g.cleanliness === 'clean' &&
      (!g.occasions.length || g.occasions.includes(occasion as never)),
  );
  const slot = (role: Role) =>
    available.filter((g) => garmentRole(g) === role).sort((a, b) => a.id.localeCompare(b.id));
  const tops = slot('base'),
    bottoms = slot('bottom');
  const bases = slot('dress').map((g) => [g]);

  for (let offset = 0; offset < bottoms.length && bases.length < 4096; offset++)
    for (let i = 0; i < tops.length && bases.length < 4096; i++)
      bases.push([tops[i]!, bottoms[(i + offset) % bottoms.length]!]);

  const mids: [undefined, ...Garment[]] = [undefined, ...slot('mid').slice(0, 8)];
  const outers: [undefined, ...Garment[]] = [undefined, ...slot('outer').slice(0, 8)];
  const shoes = slot('shoes').slice(0, 12);
  const result: Garment[][] = [];

  for (const base of bases) {
    const plans: Garment[][] = [];

    for (const mid of mids)
      for (const outer of outers) {
        const items = [...base, ...(mid ? [mid] : []), ...(outer ? [outer] : [])];

        if (thermalCompatible(items, temperature)) plans.push(items);
      }

    plans.sort(
      (a, b) =>
        evaluateOutfit(b, occasion, temperature).score -
          evaluateOutfit(a, occasion, temperature).score || a.length - b.length,
    );

    for (const plan of plans.slice(0, 2))
      for (const shoe of shoes.length ? shoes : [undefined]) {
        const candidate = [...plan, ...(shoe ? [shoe] : [])];

        if (thermalCompatible(candidate, temperature)) result.push(candidate);
      }
  }

  const variants = result.flatMap((core) => [
    core,
    ...beltCandidates(core, available).map((belt) => [...core, belt]),
  ]);
  const weights = options.weights ?? scoreWeights;

  if (
    Object.values(weights).some((n) => !Number.isFinite(n) || n < 0) ||
    !Object.values(weights).some((n) => n > 0)
  )
    throw new Error('Invalid outfit weights');

  const floor = options.minimumScore ?? 32;

  if (!Number.isFinite(floor)) throw new Error('Invalid quality threshold');

  const ranked = variants
    .map((items) => ({
      items,
      score: evaluateOutfit(items, occasion, temperature, weights).score,
      tie: random(),
    }))
    .filter((c) => c.score >= floor);
  const selected: Garment[][] = [];
  const usedBases = new Set<string>();
  const key = (items: Garment[]) =>
    items
      .filter((g) => ['base', 'bottom', 'dress'].includes(garmentRole(g)))
      .map((g) => g.id)
      .sort()
      .join(':');

  while (ranked.length && selected.length < 6) {
    const utility = (c: (typeof ranked)[number]) => {
      const overlap = Math.max(
        0,
        ...selected.map((previous) => {
          const a = new Set(previous.map((g) => g.id)),
            b = new Set(c.items.map((g) => g.id));

          return [...a].filter((id) => b.has(id)).length / new Set([...a, ...b]).size;
        }),
      );

      return c.score - weights.diversity * overlap + c.tie * 0.000001;
    };

    ranked.sort((a, b) => utility(b) - utility(a));

    const next = ranked.shift()!;

    if (usedBases.has(key(next.items))) continue;
    selected.push(next.items);
    usedBases.add(key(next.items));
  }

  return selected;
}

export function seededOutfitRandom(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
}
