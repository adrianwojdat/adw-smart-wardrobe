import type { Garment } from './garment.js';

export function colorFamily(value: string): string | undefined {
  const text = value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');

  for (const [family, pattern] of Object.entries({
    black: /czarn|black/,
    white: /bial|white|krem|cream/,
    gray: /szar|gr[ae]y/,
    beige: /bezow|beige|taupe/,
    brown: /braz|brown/,
    navy: /granat|navy/,
    blue: /niebies|blue/,
    green: /zielon|oliwk|green|olive/,
    red: /czerwon|bord|red|burgundy/,
    pink: /rozow|pink/,
    yellow: /zolt|yellow/,
    purple: /fiolet|purple/,
    orange: /pomarancz|orange/,
  }))
    if (pattern.test(text)) return family;

  return undefined;
}

export const neutralColor = (c: string) =>
  ['black', 'white', 'gray', 'beige', 'brown', 'navy'].includes(c);

export function paletteValue(items: Garment[]) {
  const known = items.map((g) => colorFamily(g.primary_color));
  const coverage = known.filter(Boolean).length / Math.max(1, items.length);
  const colors = [
    ...new Set(
      items
        .flatMap((g) => [colorFamily(g.primary_color), colorFamily(g.secondary_color)])
        .filter((c): c is string => !!c),
    ),
  ];

  if (!colors.length) return { value: 0.25, neutral: false };

  let total = 0,
    pairs = 0;

  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i]!,
        b = colors[j]!;

      total +=
        neutralColor(a) || neutralColor(b)
          ? 0.9
          : [a, b].includes('green') && [a, b].includes('red')
            ? 0.35
            : 0.6;
      pairs++;
    }

  return {
    value:
      Math.max(0, (pairs ? total / pairs : 0.7) - Math.max(0, colors.length - 3) * 0.15) * coverage,
    neutral: coverage === 1 && colors.every(neutralColor),
  };
}

export function patternValue(items: Garment[]) {
  const labels = items
    .map((g) =>
      g.pattern?.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l'),
    )
    .filter((s): s is string => !!s && !/unknown|nieznan/.test(s));
  const patterned = labels.filter((s) => !/^(gladk[iaey]|bez wzoru|plain|solid)$/.test(s));

  return labels.length
    ? (Math.max(0.2, 1 - Math.max(0, patterned.length - 1) * 0.3) * labels.length) /
        Math.max(1, items.length)
    : 0.25;
}
