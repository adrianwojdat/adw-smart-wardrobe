// Frozen baseline for comparisons, not used by the application.
import { type Garment, occasions, recommendBelt } from '../../packages/shared/src/index.ts';

/** Diverse rule-based suggestions; every ID comes from eligible owned garments. */
export function recommendBaseline(
  garments: Garment[],
  occasion: (typeof occasions)[number],
  temperature = 18,
  random: () => number = Math.random,
): Garment[][] {
  const eligible = garments.filter(
    (g) =>
      !g.archived &&
      g.cleanliness === 'clean' &&
      (!g.occasions.length || g.occasions.includes(occasion)) &&
      (g.category === 'accessories' || temperature >= 12 || g.warmth >= 2),
  );

  function shuffled<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));

      [items[i], items[j]] = [items[j]!, items[i]!];
    }

    return items;
  }

  const tops = eligible.filter((g) => g.category === 'tops');
  const bottoms = eligible.filter((g) => g.category === 'bottoms');
  const bases: Garment[][] = eligible.filter((g) => g.category === 'dresses').map((g) => [g]);

  for (const top of tops) for (const bottom of bottoms) bases.push([top, bottom]);
  shuffled(bases);

  const usage = new Map<string, number>();
  const selected: Garment[][] = [];

  while (bases.length && selected.length < 6) {
    let best = 0,
      bestMax = Infinity,
      bestAverage = Infinity;

    for (let i = 0; i < bases.length; i++) {
      const counts = bases[i]!.map((g) => usage.get(g.id) ?? 0);
      const max = Math.max(...counts);
      const average = counts.reduce((sum, n) => sum + n, 0) / counts.length;

      if (max < bestMax || (max === bestMax && average < bestAverage)) {
        best = i;
        bestMax = max;
        bestAverage = average;
      }
    }

    const [base] = bases.splice(best, 1);

    selected.push(base!);
    for (const g of base!) usage.set(g.id, (usage.get(g.id) ?? 0) + 1);
  }

  const shoes = shuffled(eligible.filter((g) => g.category === 'shoes'));
  const coats = shuffled(eligible.filter((g) => g.category === 'outerwear'));

  return selected.map((base, i) => {
    const shoe = shoes[i % shoes.length];
    const coat = coats[i % coats.length];
    const outfit = [...base, ...(shoe ? [shoe] : []), ...(temperature < 16 && coat ? [coat] : [])];
    const belt = recommendBelt(outfit, eligible);

    return belt ? [...outfit, belt] : outfit;
  });
}
