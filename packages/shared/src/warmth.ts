/** Existing 1–5 scale. Accessories have no thermal contribution. */
export function deriveWarmth(category: string, subcategory = ''): number | undefined {
  const s = subcategory
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l');

  if (category === 'outerwear') {
    if (/zimow|winter/.test(s)) return 5;
    if (/marynark|blazer/.test(s)) return 3;

    return 4;
  }

  if (category === 'bottoms') return /szort|short|krotkie spoden/.test(s) ? 1 : 2;

  if (category === 'tops') {
    if (/polo|koszul[aey]|button.up|\bshirt\b/.test(s) && !/t-shirt|tshirt/.test(s)) return 2;
    if (/sweter|sweater|bluza|hoodie|sweatshirt|kardigan|cardigan/.test(s)) return 3;

    return 1;
  }

  return undefined;
}
