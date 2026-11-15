export const appLocale = {
  code: 'pl-PL',
  language: 'Polish',
  temporaryName: 'Ubranie',
  languageReview: 'Wynik wymaga weryfikacji językowej.',
} as const;
export const aiLanguageInstruction = `Active content locale: ${appLocale.code}. Generate garment names, colors, descriptions, styles, rationales, notes and instructions in ${appLocale.language}. Keep internal JSON keys and enum values unchanged. Do not translate brands, identifiers or verbatim care-label text.`;

// Controlled nouns/adjectives avoid copying an English model name into the catalog.
const nouns: Record<string, [string, number]> = {
  'koszulka polo': ['Koszulka polo', 1],
  'bluza bez kaptura': ['Bluza bez kaptura', 1],
  'bluza z kapturem': ['Bluza z kapturem', 1],
  kardigan: ['Kardigan', 0],
  szorty: ['Szorty', 3],
  pasek: ['Pasek', 0],
  kamizelka: ['Kamizelka', 1],
  szalik: ['Szalik', 0],
  czapka: ['Czapka', 1],
  blazer: ['Marynarka', 1],
  marynarka: ['Marynarka', 1],
  shirt: ['Koszula', 1],
  koszula: ['Koszula', 1],
  trousers: ['Spodnie', 3],
  pants: ['Spodnie', 3],
  chinos: ['Spodnie', 3],
  spodnie: ['Spodnie', 3],
  dress: ['Sukienka', 1],
  sukienka: ['Sukienka', 1],
  jacket: ['Kurtka', 1],
  kurtka: ['Kurtka', 1],
  sweater: ['Sweter', 0],
  sweter: ['Sweter', 0],
  skirt: ['Spódnica', 1],
  spódnica: ['Spódnica', 1],
  coat: ['Płaszcz', 0],
  płaszcz: ['Płaszcz', 0],
  tshirt: ['Koszulka', 1],
  't-shirt': ['Koszulka', 1],
  koszulka: ['Koszulka', 1],
  shoes: ['Buty', 3],
  buty: ['Buty', 3],
  sneakers: ['Buty', 3],
  jeans: ['Jeansy', 3],
  jeansy: ['Jeansy', 3],
};
const fallbacks: Record<string, [string, number]> = {
  tops: ['Ubranie', 2],
  bottoms: ['Spodnie', 3],
  dresses: ['Sukienka', 1],
  outerwear: ['Okrycie wierzchnie', 2],
  shoes: ['Buty', 3],
  accessories: ['Dodatek', 0],
};
const colors: Record<string, string[]> = {
  'light blue': ['jasnoniebieski', 'jasnoniebieska', 'jasnoniebieskie', 'jasnoniebieskie'],
  taupe: ['szarobrązowy', 'szarobrązowa', 'szarobrązowe', 'szarobrązowe'],
  'olive green': ['oliwkowy', 'oliwkowa', 'oliwkowe', 'oliwkowe'],
  'dark green': ['ciemnozielony', 'ciemnozielona', 'ciemnozielone', 'ciemnozielone'],
  burgundy: ['bordowy', 'bordowa', 'bordowe', 'bordowe'],
  multicolored: ['wielokolorowy', 'wielokolorowa', 'wielokolorowe', 'wielokolorowe'],
  white: ['biały', 'biała', 'białe', 'białe'],
  black: ['czarny', 'czarna', 'czarne', 'czarne'],
  navy: ['granatowy', 'granatowa', 'granatowe', 'granatowe'],
  blue: ['niebieski', 'niebieska', 'niebieskie', 'niebieskie'],
  beige: ['beżowy', 'beżowa', 'beżowe', 'beżowe'],
  grey: ['szary', 'szara', 'szare', 'szare'],
  red: ['czerwony', 'czerwona', 'czerwone', 'czerwone'],
  green: ['zielony', 'zielona', 'zielone', 'zielone'],
  brown: ['brązowy', 'brązowa', 'brązowe', 'brązowe'],
  pink: ['różowy', 'różowa', 'różowe', 'różowe'],
  yellow: ['żółty', 'żółta', 'żółte', 'żółte'],
  purple: ['fioletowy', 'fioletowa', 'fioletowe', 'fioletowe'],
  orange: ['pomarańczowy', 'pomarańczowa', 'pomarańczowe', 'pomarańczowe'],
  cream: ['kremowy', 'kremowa', 'kremowe', 'kremowe'],
};
const key = (s: string) => s.trim().toLocaleLowerCase(appLocale.code);

function colorForms(value: string) {
  const v = key(value);

  return (
    colors[v === 'gray' ? 'grey' : v === 'navy blue' ? 'navy' : v] ??
    Object.values(colors).find((forms) => forms.includes(v))
  );
}

export function polishColor(value: string): string | undefined {
  return colorForms(value)?.[0];
}

export function polishGarmentName(s: {
  name?: string;
  category?: string;
  subcategory?: string;
  primary_color?: string;
}): string {
  const tokens = key(s.subcategory || s.name || '').split(/[^\p{L}-]+/u);
  const detected = nouns[key(s.subcategory ?? '')] ?? tokens.map((t) => nouns[t]).find(Boolean);
  const [noun, gender] = detected ?? fallbacks[s.category ?? ''] ?? ['Ubranie', 2];
  const adjective = colorForms(s.primary_color ?? '')?.[gender];

  return adjective
    ? adjective.charAt(0).toLocaleUpperCase(appLocale.code) +
        adjective.slice(1) +
        ' ' +
        noun.toLocaleLowerCase(appLocale.code)
    : noun;
}

export function polishSubcategory(value: string): string | undefined {
  return nouns[key(value)]?.[0];
}

const styles: Record<string, string> = {
  casual: 'Na co dzień',
  'smart casual': 'Swobodna elegancja',
  formal: 'Formalny',
  business: 'Biznesowy',
  sporty: 'Sportowy',
  sport: 'Sportowy',
  elegant: 'Elegancki',
  elegancki: 'Elegancki',
  sportowy: 'Sportowy',
  biznesowy: 'Biznesowy',
  formalny: 'Formalny',
  'na co dzień': 'Na co dzień',
  'swobodna elegancja': 'Swobodna elegancja',
};

export const polishStyle = (value: string) => styles[key(value)];

// Reject obvious English prose rather than present untranslated generated observations.
export function localizedAiText(value: string): string {
  return /\b(the|this|with|without|uncertain|exact|fabric|composition|specific|identification|visible|unknown|cannot|wash|washing|iron|dry|color|colour|brand|garment|size|material|label|readable|unreadable|check|verify|not|and|or|is|are)\b/i.test(
    value,
  )
    ? appLocale.languageReview
    : /[ąćęłńóśźż]|\b(jest|nie|na|do|brak|kolor|rozmiar|marka|materiał|sprawdź|zdjęcie|może|czytelne|prać)\b/i.test(
          value,
        )
      ? value
      : appLocale.languageReview;
}
