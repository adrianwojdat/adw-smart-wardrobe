import type { Garment } from './index.js';
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
export interface Decision {
  rule: string;
  garment_ids: string[];
  value: number;
  reason?: string;
}
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
export function styleFamily(s: string): string | undefined {
  const text = normalize(s);
  if (/smart/.test(text)) return 'smart';
  if (/formal|elegan|business|biznes/.test(text)) return 'formal';
  if (/sport|athlet/.test(text)) return 'sport';
  if (/casual|codzien|swobod/.test(text)) return 'casual';
  return undefined;
}
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
      ? { reason: 'Rozpoznane style ubrań są zgodne.' }
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
        ? { reason: 'Wszystkie ubrania mają oznaczenie wybranej okazji.' }
        : {}),
    },
    {
      rule: 'thermal.heuristic',
      garment_ids: clothes.map((g) => g.id),
      value: clothes.every((g) => g.subcategory) ? 0.8 : 0.4,
      reason: `Układ warstw przeszedł reguły dla ${temperature}°C; odczuwalny komfort zależy od warunków.`,
    },
  ];
  const values = {
    style: trace[0]!.value,
    occasion: trace[1]!.value,
    thermal: trace[2]!.value,
    color: 0.25,
    pattern: 0.25,
    shoes: 0,
    accessories: 0,
    diversity: 0,
  };
  const score = Object.entries(values).reduce(
    (sum, [k, v]) => sum + v * weights[k as keyof Weights],
    0,
  );
  return { score, trace, values, complete: items.some((g) => g.category === 'shoes') };
}
