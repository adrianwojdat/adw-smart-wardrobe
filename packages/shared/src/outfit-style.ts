const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');

export function styleFamily(value: string): string | undefined {
  const text = normalize(value);

  if (/smart/.test(text)) return 'smart';
  if (/formal|elegan|business|biznes/.test(text)) return 'formal';
  if (/sport|athlet/.test(text)) return 'sport';
  if (/casual|codzien|swobod/.test(text)) return 'casual';

  return undefined;
}
