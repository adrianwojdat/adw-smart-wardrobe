import type { Garment } from './garment.js';
import { beltEvidence } from './outfit-accessories.js';
import { paletteValue, patternValue } from './outfit-colors.js';
import type { Decision } from './outfit-decision.js';
import { shoeDecision } from './outfit-shoes.js';
import { styleFamily } from './outfit-style.js';

export const scoreWeights = {
  style: 20,
  occasion: 15,
  thermal: 20,
  color: 18,
  pattern: 5,
  shoes: 10,
  accessories: 4,
  diversity: 8,
};
export type Weights = typeof scoreWeights;
export type { Decision } from './outfit-decision.js';
export { styleFamily } from './outfit-style.js';

export function styleDecision(items: Garment[]): Decision {
  const styles = items.map((g) => styleFamily(g.style));
  const known = styles.filter((s): s is string => !!s);
  const coverage = known.length / items.length;
  const unique = new Set(known);
  const affinity =
    unique.size === 1 ? 1 : unique.has('sport') && unique.has('formal') ? 0.25 : 0.65;

  return {
    rule: 'style.compatibility',
    garment_ids: items.map((g) => g.id),
    value: known.length ? affinity * coverage : 0.25,
    ...(known.length >= 2 && unique.size === 1
      ? { reason: 'The recognized garment styles are compatible.' }
      : {}),
  };
}

export function evaluateOutfit(
  items: Garment[],
  occasion: string,
  temperature: number,
  weights: Weights = scoreWeights,
) {
  const clothes = items.filter((g) => g.category !== 'accessories');
  const trace: Decision[] = [
    styleDecision(clothes),
    {
      rule: 'occasion.tags',
      garment_ids: clothes.map((g) => g.id),
      value:
        clothes.reduce(
          (n, g) =>
            n + (g.occasions.includes(occasion as never) ? 1 : g.occasions.length ? 0 : 0.35),
          0,
        ) / clothes.length,
      ...(clothes.every((g) => g.occasions.includes(occasion as never))
        ? { reason: 'All garments are tagged for the selected occasion.' }
        : {}),
    },
    {
      rule: 'thermal.heuristic',
      garment_ids: clothes.map((g) => g.id),
      value: clothes.every((g) => g.subcategory) ? 0.8 : 0.4,
      reason: `The layering passed the rules for ${temperature}°C; perceived comfort depends on conditions.`,
    },
  ];
  const palette = paletteValue(clothes);

  trace.push({
    rule: 'color.palette',
    garment_ids: clothes.map((g) => g.id),
    value: palette.value,
    ...(palette.neutral ? { reason: 'The recognized colors form a neutral palette.' } : {}),
  });
  trace.push({
    rule: 'pattern.combination',
    garment_ids: clothes.map((g) => g.id),
    value: patternValue(clothes),
  });

  const footwear = shoeDecision(items, occasion, temperature);

  trace.push(footwear);

  const belt = items.find((g) => g.category === 'accessories');
  const accessory = belt ? beltEvidence(clothes, belt) : undefined;

  if (accessory) trace.push(accessory);

  const values = {
    style: trace[0]!.value,
    occasion: trace[1]!.value,
    thermal: trace[2]!.value,
    color: palette.value,
    pattern: patternValue(clothes),
    shoes: footwear.value,
    accessories: accessory?.value ?? 0,
    diversity: 0,
  };
  const score = Object.entries(values).reduce(
    (sum, [k, v]) => sum + v * weights[k as keyof Weights],
    0,
  );

  return { score, trace, values, complete: items.some((g) => g.category === 'shoes') };
}
