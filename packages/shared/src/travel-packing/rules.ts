import type { PackingItem, Trip } from '../travel-packing.js';
import { packingCatalog, type PackingKey, packingKeys } from './catalog.js';
import packingEn from './locales/en.json' with { type: 'json' };
import packingPl from './locales/pl.json' with { type: 'json' };

export function packingContext(trip: Trip) {
  const notes = trip.notes.toLowerCase();
  let climate: 'unknown' | 'warm' | 'cool' | 'cold' = 'unknown';

  if (/winter|snow|ski|zimow|śnieg|nart/.test(notes)) climate = 'cold';
  else if (/hot|tropical|upał|tropik/.test(notes)) climate = 'warm';
  else if (trip.departure) {
    const month = Number(trip.departure.slice(5, 7));
    const north =
      /japan|japoni|tokyo|tokio|osaka|kyoto|europ|polsk|poland|france|francj|germany|niemc|london|londyn|canada|kanad/i.test(
        trip.destination,
      );
    const south = /australia|australi|new zealand|nowa zeland/i.test(trip.destination);
    const tropical = /singapor|singapur|thailand|tajlandi/i.test(trip.destination);

    if (tropical) climate = 'warm';
    else if (north || south) {
      const seasonal = south ? ((month + 5) % 12) + 1 : month;

      climate = [12, 1, 2].includes(seasonal)
        ? 'cold'
        : [6, 7, 8].includes(seasonal)
          ? 'warm'
          : 'cool';
    }
  }

  return {
    climate,
    swimming: /pool|swim|beach|basen|pływan|plaż/.test(notes) || trip.activity === 'relaxation',
    sharedShower: /shared shower|hostel|wspóln.*prysznic/.test(notes),
    notes,
  };
}

export function packingExcluded(key: PackingKey, trip: Trip) {
  const pattern = packingCatalog[key].pattern;

  return new RegExp(
    '(?:\\bno |\\bwithout |bez |nie potrzebuj[ęe] )(?:(?:any|żadnych) )?(?:' + pattern + ')',
    'iu',
  ).test(trip.notes);
}

export function buildBasePackingList(trip: Trip): PackingItem[] {
  const { climate, swimming, sharedShower, notes } = packingContext(trip);
  const cycle = trip.laundry ? Math.min(trip.days, 4) : trip.days;
  const reserve = trip.light ? 1 : Math.max(1, Math.ceil(cycle / 7));
  const daily = Math.min(365, cycle + reserve);
  const long =
    climate === 'warm'
      ? 0
      : climate === 'cold'
        ? Math.max(1, daily - 2)
        : Math.min(daily - 1, Math.max(1, Math.ceil(daily / 3)));
  const specs: Partial<
    Record<PackingKey, { quantity: number; optional?: boolean; weather?: boolean }>
  > = {};
  const add = (key: PackingKey, quantity = 1, optional = false, weather = false) => {
    if (quantity > 0 && !packingExcluded(key, trip))
      specs[key] = { quantity: Math.min(365, quantity), optional, weather };
  };

  add('briefs', daily);
  add(
    'short_socks',
    packingExcluded('long_socks', trip) ? daily : daily - long,
    false,
    climate === 'unknown',
  );
  add(
    'long_socks',
    packingExcluded('short_socks', trip) ? daily : long,
    false,
    climate === 'unknown',
  );
  add('tshirt', Math.ceil(cycle / (trip.activity === 'active' ? 1 : trip.light ? 2 : 1.5)));
  add(
    'shirt',
    trip.activity === 'business'
      ? Math.max(1, Math.ceil(cycle / 2))
      : trip.light
        ? 1
        : Math.max(1, Math.ceil(cycle / 5)),
    trip.activity !== 'business',
  );
  add('trousers', Math.max(1, Math.ceil(cycle / (trip.light ? 5 : 4))));
  add(
    'hoodie',
    climate === 'warm' ? 1 : trip.light ? 1 : Math.min(3, Math.ceil(cycle / 5)),
    false,
    climate === 'unknown' || climate === 'warm',
  );
  if (climate !== 'warm' && !trip.light)
    add('sweater', climate === 'cold' ? 2 : 1, true, climate === 'unknown');
  add('walking_shoes');
  if (trip.days >= 5 && !trip.light) add('spare_shoes', 1, true);
  add('jacket', 1, false, true);
  add('belt', 1, true);
  add('pyjamas', trip.laundry ? 1 : Math.min(2, Math.ceil(trip.days / 7)));

  if (climate === 'warm') {
    add('shorts', Math.min(3, Math.ceil(cycle / 4)), true, true);
    add('sandals', 1, true, true);
    add('hat', 1, true, true);
  }

  if (climate === 'cold') {
    add('coat', 1, true, true);
    add('hat', 1, false, true);
    add('scarf', 1, false, true);
    add('gloves', 1, false, true);
  }

  if (swimming) {
    add('swimsuit', 1, true);
    add('flip_flops', 1, true);
  } else if (sharedShower) add('flip_flops', 1, true);
  for (const key of ['bra', 'undershirt', 'blouse', 'skirt', 'dress', 'shaving'] as const)
    if (new RegExp(packingCatalog[key].pattern, 'iu').test(notes))
      add(key, key === 'bra' ? Math.max(1, Math.ceil(cycle / 3)) : 1, true);
  for (const key of [
    'toothbrush',
    'toothpaste',
    'deodorant',
    'shampoo',
    'body_wash',
    'comb',
    'phone',
    'charger',
    'cable',
    'identity',
    'tickets',
    'payment',
    'dressings',
  ] as const)
    add(key);
  for (const key of ['medication', 'insurance'] as const) add(key, 1, true);
  if (!trip.light || trip.activity === 'active') add('powerbank', 1, true);
  if (
    /japan|japoni|uk\b|united kingdom|wielk.*brytan|usa|united states|australi/i.test(
      trip.destination,
    )
  )
    add('adapter', 1, true);

  const description =
    trip.language === 'pl' ? packingPl.baselineDescription : packingEn.baselineDescription;
  const conditional =
    trip.language === 'pl' ? packingPl.weatherDescription : packingEn.weatherDescription;
  const personal =
    trip.language === 'pl' ? packingPl.personalDescription : packingEn.personalDescription;

  return packingKeys.flatMap((key) => {
    const spec = specs[key];

    if (!spec) return [];

    const entry = packingCatalog[key];

    return [
      {
        id: crypto.randomUUID(),
        packing_key: key,
        packing_group: entry.group,
        optional: spec.optional ?? false,
        generation_source: 'baseline' as const,
        category: entry.category,
        name: entry[trip.language],
        quantity: spec.quantity,
        description:
          description +
          (spec.weather ? conditional : '') +
          (['medication', 'personal_health', 'personal_hygiene', 'adapter'].includes(key)
            ? personal
            : ''),
        weather_dependent: spec.weather ?? false,
        match_wardrobe: [
          'tops',
          'bottoms',
          'outerwear',
          'shoes',
          'accessories',
          'underwear',
          'dresses',
        ].includes(entry.category),
        subcategory: key,
        seasons:
          climate === 'unknown'
            ? []
            : climate === 'cold'
              ? ['winter']
              : climate === 'warm'
                ? ['summer']
                : ['autumn', 'spring'],
        warmth: climate === 'cold' ? 4 : climate === 'warm' ? 1 : null,
        material: '',
        style: trip.activity === 'business' ? 'formal' : '',
        occasion: trip.activity === 'business' ? 'office' : 'travel',
        assigned: [],
        packed: 0,
      },
    ];
  });
}
