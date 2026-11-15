import type { Garment } from './garment.js';
import { appLocale, polishColor } from './locale.js';

const fold = (s: string) =>
  s.toLocaleLowerCase(appLocale.code).normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');

export function beltCompatible(garment: Garment): boolean {
  if (garment.category !== 'bottoms') return false;

  const text = fold(`${garment.subcategory} ${garment.name} ${garment.style}`);

  if (
    /dres|sweat|jogger|legging|legg?ins|sportow|yoga|joga|gumk|elastic|drawstring|spodnic|skirt/.test(
      text,
    )
  )
    return false;

  return /jeans|dzins|chinos|spodni|trouser|pants|szort|short/.test(text);
}

function color(value: string) {
  const text = fold(polishColor(value) ?? value);

  for (const [key, re] of Object.entries({
    black: /czarn|black/,
    brown: /braz|brown/,
    beige: /bezow|beige|taupe/,
    navy: /granat|navy/,
    blue: /niebies|blue/,
    gray: /szar|grey|gray/,
  }))
    if (re.test(text)) return key;

  return text;
}

function style(value: string) {
  const text = fold(value);

  if (/smart|swobodn/.test(text)) return 'smart';
  if (/formal|biznes|business|elegan/.test(text)) return 'formal';
  if (/sport|athlet/.test(text)) return 'sport';
  if (/casual|codzien/.test(text)) return 'casual';

  return '';
}

/** Select an owned optional belt; other accessory types can be added independently. */
export function recommendBelt(outfit: Garment[], available: Garment[]): Garment | undefined {
  const pants = outfit.find(beltCompatible);

  if (!pants) return;

  const shoe = outfit.find((g) => g.category === 'shoes');
  const shoeColor = shoe ? color(shoe.primary_color) : '';
  const pantsColor = color(pants.primary_color);
  const context =
    style(pants.style) ||
    style(shoe?.style ?? '') ||
    style(outfit.find((g) => g.category === 'tops')?.style ?? '');
  let best: Garment | undefined,
    bestScore = -Infinity;

  for (const belt of available) {
    if (
      belt.category !== 'accessories' ||
      belt.archived ||
      belt.cleanliness !== 'clean' ||
      belt.wardrobe_id !== pants.wardrobe_id
    )
      continue;

    const label = fold(`${belt.subcategory} ${belt.name}`);

    if (!/\bpasek\b|\bbelt\b/.test(label) || /zegark|watch/.test(label)) continue;

    const beltColor = color(belt.primary_color),
      beltStyle = style(belt.style);
    let score = ['black', 'brown', 'beige'].includes(beltColor) ? 1 : 0;

    if (
      shoeColor &&
      ['black', 'brown', 'beige', 'navy', 'gray'].includes(shoeColor) &&
      style(shoe?.style ?? '') !== 'sport' &&
      beltColor === shoeColor
    )
      score += 6;
    if (context && beltStyle === context) score += 3;
    if (context === 'formal' && beltStyle === 'sport') score -= 10;
    if (pantsColor === 'black' && beltColor === 'black') score += 3;
    if (['blue', 'navy', 'beige'].includes(pantsColor) && beltColor === 'brown') score += 2;
    if (pantsColor === 'gray' && beltColor === 'black') score += 2;

    if (score > bestScore) {
      best = belt;
      bestScore = score;
    }
  }

  return bestScore >= 0 ? best : undefined;
}
