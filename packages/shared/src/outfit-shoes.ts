import type { Garment } from './garment.js';
import type { Decision } from './outfit-decision.js';
import { styleFamily } from './outfit-style.js';

export function shoeDecision(items: Garment[], occasion: string, temperature: number): Decision {
  const shoe = items.find((g) => g.category === 'shoes');
  const bottom = items.find((g) => g.category === 'bottoms' || g.category === 'dresses');

  if (!shoe)
    return {
      rule: 'shoes.missing',
      garment_ids: [],
      value: 0,
      reason: 'Partial outfit: footwear is missing.',
    };

  const style = styleFamily(shoe.style),
    other = styleFamily(bottom?.style ?? '');
  let value = shoe.subcategory ? 0.35 : 0.2;

  if (style && other)
    value = style === other ? 1 : style === 'sport' && other === 'formal' ? 0.3 : 0.65;
  if (occasion === 'office' && style === 'sport') value = Math.min(value, 0.4);
  if (temperature < 12 && /sanda|klapk|flip.flop/i.test(shoe.subcategory)) value = 0;

  return {
    rule: 'shoes.compatibility',
    garment_ids: [shoe.id, ...(bottom ? [bottom.id] : [])],
    value,
    ...(style && style === other
      ? { reason: 'The footwear and bottom garment share a recognized style.' }
      : {}),
  };
}
