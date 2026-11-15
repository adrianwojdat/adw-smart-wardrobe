import { beltCompatible } from './accessories.js';
import type { Garment } from './garment.js';
import { colorFamily } from './outfit-colors.js';
import type { Decision } from './outfit-decision.js';
import { styleFamily } from './outfit-style.js';
import { fold } from './outfit-text.js';

export function beltEvidence(core: Garment[], belt: Garment): Decision {
  const pants = core.find((g) => g.category === 'bottoms');
  const no = { rule: 'accessory.belt', garment_ids: [belt.id], value: 0 };

  if (!pants || belt.wardrobe_id !== pants.wardrobe_id || !beltCompatible(pants)) return no;

  const construction = fold(`${pants.subcategory} ${pants.name} ${pants.notes}`);
  const loops =
    /szlufk|belt loops/.test(construction) &&
    !/bez szluf|brak szluf|nie ma szluf|no belt loops/.test(construction);
  const shorts = /szort|short|krotkie/.test(construction);

  if ((shorts && !loops) || (!loops && !/chino|jeans|dzins/.test(construction))) return no;

  const shoe = core.find((g) => g.category === 'shoes'),
    c = colorFamily(belt.primary_color);
  const sameShoe =
    !!c &&
    c === colorFamily(shoe?.primary_color ?? '') &&
    styleFamily(shoe?.style ?? '') !== 'sport';
  const samePants = !!c && c === colorFamily(pants.primary_color);
  const style = styleFamily(belt.style),
    context = styleFamily(pants.style);
  const benefit =
    (sameShoe ? 4 : 0) +
    (samePants ? 2 : 0) +
    (style && style === context ? 1 : 0) -
    (context === 'formal' && style === 'sport' ? 6 : 0);

  return {
    ...no,
    garment_ids: [pants.id, belt.id, ...(sameShoe && shoe ? [shoe.id] : [])],
    value: benefit >= 2 ? Math.min(1, benefit / 5) : 0,
    ...(benefit >= 2
      ? {
          reason: sameShoe
            ? 'The belt coordinates with the footwear color.'
            : 'The belt matches the bottom garment color.',
        }
      : {}),
  };
}

export function beltCandidates(core: Garment[], available: Garment[]) {
  return available.filter(
    (g) =>
      g.category === 'accessories' &&
      !g.archived &&
      g.cleanliness === 'clean' &&
      /\bpasek\b|\bbelt\b/.test(fold(`${g.name} ${g.subcategory}`)) &&
      !/zegark|watch/.test(fold(`${g.name} ${g.subcategory}`)) &&
      beltEvidence(core, g).value > 0,
  );
}
