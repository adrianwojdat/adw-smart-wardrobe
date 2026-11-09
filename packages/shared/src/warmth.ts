/** Existing 1–5 scale. Accessories have no thermal contribution. */
export function deriveWarmth(category: string, subcategory = ''): number | undefined {
  if (category === 'accessories' || category === 'shoes') return undefined;
  const s = subcategory
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l');
  if (/zimow|winter/.test(s) && /kurtk|jacket|coat|plaszcz/.test(s)) return 5;
  if (/marynark|blazer/.test(s)) return 3;
  if (/kurtk|jacket|coat|plaszcz/.test(s)) return 4;
  if (/szort|short|krotkie spoden/.test(s)) return 1;
  if (/polo|koszul[aey]|button.up|\bshirt\b/.test(s) && !/t-shirt|tshirt/.test(s)) return 2;
  if (/sweter|sweater|bluza|hoodie|sweatshirt|kardigan|cardigan/.test(s)) return 3;
  if (/t-shirt|tshirt|koszulk|tank|sleeveless|\btop\b/.test(s)) return 1;
  if (category === 'bottoms') return 2;
  if (category === 'tops') return 1;
  if (category === 'outerwear') return 4;
  return undefined;
}
