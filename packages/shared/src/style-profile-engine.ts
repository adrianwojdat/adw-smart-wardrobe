import type { StyleProfileSummary } from './style-profile-summary.js';
import { resolveStyleContext } from './style-profile-summary.js';

export interface StyleGarmentMetadata {
  category: string;
  name: string;
  subcategory?: string | null;
  style?: string | null;
  pattern?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  warmth?: number | null;
  occasions?: string[];
}

const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const terms: Record<string, string[]> = {
  tracksuits: ['dres', 'jogger', 'track suit', 'tracksuit'],
  ripped_clothes: ['przetar', 'dziur', 'ripped'],
  slogans: ['napis', 'slogan', 'logo'],
  shorts: ['szort', 'shorts', 'bermud'],
  sneakers: ['sneaker', 'but sport'],
  formalwear: ['garnitur', 'formal'],
  bright_colors: ['neon', 'jaskraw', 'bright'],
  slim: ['slim'],
  regular: ['regular'],
  relaxed: ['relaxed'],
  oversized: ['oversize'],
  straight: ['straight', 'prosta'],
  wide: ['wide', 'szerok'],
  tailored: ['tailored', 'eleganck'],
  neon: ['neon'],
  large_logos: ['duze logo', 'logo'],
  animal_print: ['zwierzecy', 'panter', 'animal', 'leopard', 'zebra'],
  florals: ['kwiat', 'floral'],
  stripes: ['paski', 'prazki', 'stripe'],
  checks: ['krata', 'krat', 'checkered', 'checked', 'plaid'],
  pastels: ['pastel'],
  black: ['czarn', 'black'],
  white: ['bial', 'white'],
};
const styles: Record<string, string[]> = {
  minimalist: ['minimal'],
  classic: ['classic', 'klasycz', 'elegan'],
  streetwear: ['street', 'urban'],
  preppy: ['preppy', 'college'],
  scandinavian: ['scandinav', 'skandynaw'],
  boho: ['boho'],
  workwear: ['workwear', 'robocz'],
  sporty: ['sport', 'athlet'],
  romantic: ['romant'],
  avant_garde: ['avant', 'awangard'],
};
const colors: Record<string, string[]> = {
  black: ['black', 'czarn'],
  white: ['white', 'bial'],
  navy: ['navy', 'granat'],
  gray: ['gray', 'grey', 'szar'],
  beige: ['beige', 'bezow'],
  brown: ['brown', 'braz'],
  olive: ['olive', 'oliwk'],
  green: ['green', 'ziel'],
  blue: ['blue', 'niebies', 'blekit'],
  red: ['red', 'czerw'],
  burgundy: ['burgundy', 'bord'],
  pink: ['pink', 'roz'],
  purple: ['purple', 'fiolet'],
  yellow: ['yellow', 'zolt'],
  orange: ['orange', 'pomarancz'],
};
const text = (g: StyleGarmentMetadata) =>
  normalize([g.name, g.subcategory, g.style, g.pattern].join(' '));
const has = (v: string, patterns: string[]) =>
  patterns.some((p) => ` ${v}`.includes(` ${normalize(p)}`));

export function evaluateStyleOutfit(
  summary: StyleProfileSummary,
  garments: StyleGarmentMetadata[],
  context: { occasion: string; temperature: number; weather?: string },
) {
  const hard = summary.hardConstraints,
    scoped = resolveStyleContext(summary, context),
    violations: string[] = [];
  const texts = garments.map(text);

  if (hard.avoid_fits.some((f) => texts.some((t) => has(t, terms[f] ?? [f]))))
    violations.push('avoided_fit');
  if (
    scoped.occasionBans.some((b) =>
      garments.some((g, i) =>
        has(texts[i] + ' ' + normalize(g.primary_color ?? ''), terms[b] ?? [b]),
      ),
    )
  )
    violations.push('occasion_ban');
  if (
    hard.avoid_visuals.some((b) =>
      garments.some((g, i) =>
        has(
          texts[i] + ' ' + normalize((g.primary_color ?? '') + ' ' + (g.secondary_color ?? '')),
          terms[b] ?? [b],
        ),
      ),
    )
  )
    violations.push('visual_ban');

  const includes = (patterns: string[]) => texts.some((t) => has(t, patterns));
  const blazer = includes(['marynarka', 'blazer']);

  if (hard.bans.blazer_with_tshirt && blazer && includes(['t shirt', 'tshirt', 'koszulka']))
    violations.push('blazer_with_tshirt');
  if (hard.bans.hoodie_under_blazer && blazer && includes(['hoodie', 'bluza z kapturem']))
    violations.push('hoodie_under_blazer');
  if (hard.bans.sneakers_with_suit && includes(['sneaker']) && includes(['garnitur', 'suit']))
    violations.push('sneakers_with_suit');

  const p = summary.stylePreferences;
  const weight = (dimension: 'styles' | 'colors' | 'fits') =>
    p.strength[dimension] === 'strong' ? 3 : p.strength[dimension] === 'gentle' ? 0.5 : 1;
  let softScore = 0;
  const preferredStyles = [...(p.dominantStyle ? [p.dominantStyle] : []), ...p.supportingStyles];

  for (const g of garments) {
    const t = text(g),
      c = normalize((g.primary_color ?? '') + ' ' + (g.secondary_color ?? ''));

    if (preferredStyles.some((s) => has(t, styles[s] ?? [s])))
      softScore +=
        weight('styles') * (p.dominantStyle && has(t, styles[p.dominantStyle] ?? []) ? 3 : 1);
    if (p.colors.some((color) => has(c, colors[color] ?? [color]))) softScore += weight('colors');
    if (p.fits.some((f) => has(t, terms[f] ?? [f]))) softScore += weight('fits');
    if (p.patterns === 'plain' && has(t, ['gladk', 'plain', 'solid'])) softScore += 1;
    if (p.trousers.some((f) => has(t, terms[f] ?? [f]))) softScore += 0.5;
    if (p.shoes.some((f) => has(t, terms[f] ?? [f]))) softScore += 0.5;

    const formal = scoped.occasionPreferences.length
      ? scoped.occasionPreferences
      : scoped.dailyFormality
        ? [scoped.dailyFormality]
        : [];

    if (
      formal.some((f) =>
        has(
          t,
          f === 'casual'
            ? ['casual', 'swobod']
            : f === 'formal'
              ? ['formal', 'elegan']
              : f === 'relaxed'
                ? ['relaxed', 'sport']
                : [f.replaceAll('_', ' ')],
        ),
      )
    )
      softScore += weight('styles');

    if (scoped.thermalPreference && typeof g.warmth === 'number') {
      const target = Math.max(
        1,
        Math.min(
          5,
          (context.temperature < 5 ? 4 : context.temperature > 24 ? 1 : 3) +
            (scoped.thermalPreference === 'cold'
              ? 1
              : scoped.thermalPreference === 'warm'
                ? -1
                : 0),
        ),
      );

      softScore += Math.max(0, 2 - Math.abs(g.warmth - target));
    }
  }

  if (scoped.adverseWeather && garments.some((g) => g.category === 'outerwear')) softScore += 1;

  return { violations, softScore };
}
