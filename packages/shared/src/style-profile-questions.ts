import { styleColorIds } from './style-profile-catalog.js';
import {
  type StyleAnswerKey,
  styleAnswerKeys,
  type StyleAnswers,
} from './style-profile-schemas.js';

const originalSections = [
  {
    id: 'thermal',
    title: 'Thermal comfort and layering',
    questions: [
      {
        key: 'q01_thermal',
        text: 'Do you tend to feel cold, or do you get warm easily?',
        options: [
          ['cold', 'I tend to feel cold'],
          ['balanced', 'I usually feel comfortable'],
          ['warm', 'I get warm easily'],
        ],
      },
      {
        key: 'q02_at_18c',
        text: 'What do you usually wear at around 18°C?',
        multiple: true,
        options: [
          ['tshirt', 'T-shirt'],
          ['long_sleeve', 'Long-sleeved top'],
          ['shirt', 'Shirt'],
          ['light_sweater', 'Light sweater'],
          ['hoodie', 'Hoodie'],
          ['light_jacket', 'Light jacket'],
          ['depends', 'It depends on weather and activity'],
        ],
      },
      {
        key: 'q03_priority',
        text: 'Which matters more: thermal comfort or appearance?',
        options: [
          ['comfort', 'Comfort'],
          ['balanced', 'A balance of both'],
          ['appearance', 'Appearance'],
        ],
      },
      {
        key: 'q04_layering',
        text: 'How often do you like to dress in layers?',
        options: [
          ['rarely', 'Rarely'],
          ['sometimes', 'Sometimes'],
          ['often', 'Often'],
          ['always', 'Almost always'],
        ],
      },
      {
        key: 'q05_shorts_temperature',
        text: 'At what temperature do you like to wear shorts?',
        options: [
          ['above_25', 'Above 25°C'],
          ['above_22', 'Above 22°C'],
          ['above_20', 'Above 20°C'],
          ['above_18', 'Above 18°C'],
          ['anytime', 'Even on cooler days'],
        ],
      },
    ],
  },
  {
    id: 'fits',
    title: 'Fits and garment types',
    questions: [
      {
        key: 'q06_favorite_fits',
        text: 'Which fits do you like?',
        multiple: true,
        options: [
          ['slim', 'Slim'],
          ['regular', 'Regular'],
          ['relaxed', 'Relaxed'],
          ['oversized', 'Oversized'],
          ['straight', 'Straight-leg'],
          ['wide', 'Wide-leg'],
          ['tailored', 'Tailored'],
        ],
      },
      {
        key: 'q07_avoided_fits',
        text: 'Which fits do you avoid? Selected options are firm restrictions.',
        multiple: true,
        hard: true,
        options: [
          ['slim', 'Slim'],
          ['regular', 'Regular'],
          ['relaxed', 'Relaxed'],
          ['oversized', 'Oversized'],
          ['straight', 'Straight-leg'],
          ['wide', 'Wide-leg'],
          ['tailored', 'Tailored'],
        ],
      },
      {
        key: 'q08_trouser_types',
        text: 'What types of trousers do you like to wear?',
        multiple: true,
        options: [
          ['jeans', 'Jeans'],
          ['chinos', 'Chinos'],
          ['tailored', 'Tailored trousers'],
          ['wide', 'Wide-leg'],
          ['straight', 'Straight-leg trousers'],
          ['cargo', 'Cargo trousers'],
          ['joggers', 'Joggers'],
          ['shorts', 'Shorts'],
        ],
      },
      {
        key: 'q09_shoes',
        text: 'What types of footwear do you prefer?',
        multiple: true,
        options: [
          ['sneakers', 'Sneakers'],
          ['formal', 'Formal shoes'],
          ['boots', 'Boots and ankle boots'],
          ['loafers', 'Loafers'],
          ['sandals', 'Sandals'],
        ],
      },
    ],
  },
  {
    id: 'pairing',
    title: 'Combining clothes',
    questions: [
      {
        key: 'q10_sneakers_with_suit',
        text: 'Are you comfortable wearing sneakers with a suit?',
        options: [
          ['yes', 'Yes'],
          ['sometimes', 'It depends on the outfit'],
          ['no', 'No — do not suggest this combination'],
        ],
        hard: true,
      },
      {
        key: 'q11_blazer_with_tshirt',
        text: 'Do you like a blazer with a T-shirt?',
        options: [
          ['yes', 'Yes'],
          ['sometimes', 'Sometimes'],
          ['no', 'No — I avoid this combination'],
        ],
        hard: true,
      },
      {
        key: 'q12_hoodie_under_blazer',
        text: 'Are you comfortable wearing a hoodie under a blazer?',
        options: [
          ['yes', 'Yes'],
          ['sometimes', 'Sometimes'],
          ['no', 'No — do not suggest this combination'],
        ],
        hard: true,
      },
      {
        key: 'q13_style_mixing',
        text: 'How often do you like mixing styles?',
        options: [
          ['never', 'I do not mix styles'],
          ['rarely', 'Rarely'],
          ['sometimes', 'Sometimes'],
          ['often', 'Often'],
        ],
      },
      {
        key: 'q14_experimentation',
        text: 'How much do you experiment with clothing?',
        options: [
          ['conservative', 'I prefer familiar outfits'],
          ['moderate', 'I sometimes try something new'],
          ['bold', 'I like experimenting'],
          ['very_bold', 'I enjoy bold combinations'],
        ],
      },
      {
        key: 'q15_belt_shoe_match',
        text: 'Do you care about matching your belt colour to your shoes?',
        options: [
          ['always', 'Yes, matching matters to me'],
          ['prefer', 'I prefer it, but not always'],
          ['not_important', 'It is not important'],
        ],
      },
    ],
  },
  {
    id: 'occasions',
    title: 'Occasions',
    questions: [
      {
        key: 'q16_office_style',
        text: 'How do you dress for work or the office?',
        multiple: true,
        options: [
          ['formal', 'Formal'],
          ['business_casual', 'Business casual'],
          ['smart_casual', 'Smart casual'],
          ['casual', 'Casual'],
          ['uniform', 'I have a dress code'],
        ],
      },
      {
        key: 'q17_office_avoid',
        text: 'What would you not wear to the office? These are firm restrictions.',
        multiple: true,
        hard: true,
        options: [
          ['tracksuits', 'Tracksuits'],
          ['ripped_clothes', 'Ripped clothes'],
          ['slogans', 'Clothes with large slogans'],
          ['shorts', 'Shorts'],
          ['sneakers', 'Sneakers'],
          ['bright_colors', 'Bright colours'],
          ['none', 'None'],
        ],
      },
      {
        key: 'q18_date_style',
        text: 'What style do you prefer for a date?',
        multiple: true,
        options: [
          ['elegant', 'Elegant'],
          ['smart_casual', 'Smart casual'],
          ['casual', 'Casual'],
          ['romantic', 'Romantic'],
          ['creative', 'Creative'],
        ],
      },
      {
        key: 'q19_date_avoid',
        text: 'What would you not wear on a date? These are firm restrictions.',
        multiple: true,
        hard: true,
        options: [
          ['tracksuits', 'Tracksuits'],
          ['ripped_clothes', 'Ripped clothes'],
          ['slogans', 'Clothes with large slogans'],
          ['formalwear', 'Very formal clothing'],
          ['bright_colors', 'Bright colours'],
          ['none', 'None'],
        ],
      },
      {
        key: 'q20_social_style',
        text: 'Do you dress more stylishly for social occasions than for everyday wear?',
        options: [
          ['more_stylish', 'Usually more stylish'],
          ['similar', 'About the same'],
          ['more_casual', 'More casual'],
        ],
      },
    ],
  },
  {
    id: 'aesthetics',
    title: 'Aesthetics, patterns and colours',
    questions: [
      {
        key: 'q21_aesthetics',
        text: 'Which aesthetics appeal to you most?',
        multiple: true,
        options: [
          ['minimalist', 'Minimalist'],
          ['classic', 'Classic'],
          ['streetwear', 'Streetwear'],
          ['preppy', 'Preppy'],
          ['scandinavian', 'Scandinavian'],
          ['boho', 'Boho'],
          ['workwear', 'Workwear'],
          ['sporty', 'Sporty'],
          ['romantic', 'Romantic'],
          ['avant_garde', 'Avant-garde'],
        ],
      },
      {
        key: 'q22_patterns',
        text: 'How do you feel about patterns?',
        options: [
          ['plain', 'I prefer solid colours'],
          ['subtle', 'I like subtle patterns'],
          ['mixed', 'It depends on the outfit'],
          ['bold', 'I like bold patterns'],
        ],
      },
      {
        key: 'q23_avoid_visuals',
        text: 'Which colours or visual elements do you avoid? These are firm restrictions.',
        multiple: true,
        hard: true,
        options: [
          ['neon', 'Neon colours'],
          ['large_logos', 'Large logos'],
          ['animal_print', 'Animal prints'],
          ['florals', 'Floral prints'],
          ['stripes', 'Stripes'],
          ['checks', 'Checks'],
          ['pastels', 'Pastels'],
          ['black', 'Black'],
          ['white', 'White'],
          ['none', 'None'],
        ],
      },
      {
        key: 'q24_palettes',
        text: 'Which colour palettes do you prefer?',
        multiple: true,
        options: [
          ['neutrals', 'Neutrals'],
          ['earth', 'Earth tones'],
          ['monochrome', 'Monochrome'],
          ['cool', 'Cool tones'],
          ['warm', 'Warm tones'],
          ['pastel', 'Pastels'],
          ['jewel', 'Rich jewel tones'],
          ['bold', 'Bold colours'],
        ],
      },
    ],
  },
  {
    id: 'accessories',
    title: 'Accessories',
    questions: [
      {
        key: 'q25_accessories',
        text: 'How often do you wear accessories?',
        options: [
          ['never', 'Never'],
          ['rarely', 'Rarely'],
          ['sometimes', 'Sometimes'],
          ['often', 'Often'],
        ],
      },
      {
        key: 'q26_belt_use',
        text: 'When do you wear a belt?',
        multiple: true,
        options: [
          ['with_loops', 'When trousers have belt loops'],
          ['jeans_chinos', 'With jeans or chinos'],
          ['tailored_trousers', 'With tailored trousers'],
          ['shorts', 'With shorts'],
          ['never', 'I do not wear belts'],
        ],
      },
    ],
  },
  {
    id: 'variety',
    title: 'Variety and wardrobe',
    questions: [
      {
        key: 'q27_variety',
        text: 'Do you prefer familiar outfits or variety?',
        options: [
          ['reliable', 'Familiar outfits'],
          ['balanced', 'A balance of familiarity and variety'],
          ['varied', 'Variety and new combinations'],
        ],
      },
      {
        key: 'q28_remind_rarely_worn',
        text: 'Would you like reminders about rarely worn garments?',
        options: [
          ['true', 'Yes'],
          ['false', 'No'],
        ],
        boolean: true,
      },
      {
        key: 'q29_include_forgotten',
        text: 'Would you like outfit ideas featuring forgotten garments?',
        options: [
          ['true', 'Yes'],
          ['false', 'No'],
        ],
        boolean: true,
      },
      {
        key: 'q30_suggest_missing_items',
        text: 'Would you like suggestions to fill wardrobe gaps?',
        options: [
          ['true', 'Yes'],
          ['false', 'No'],
        ],
        boolean: true,
      },
    ],
  },
] as const;

export const styleQuestionSections = (() => {
  const old = originalSections.flatMap((s) => [...s.questions]);
  const get = (keys: readonly StyleAnswerKey[]) =>
    keys.map((key) => {
      const q = old.find((q) => q.key === key);

      if (!q) throw new Error('Missing legacy question');

      return q;
    });
  const primary = {
    key: 'q31_dominant_style',
    text: 'Which style best describes you?',
    options: originalSections[4].questions[0].options,
    presentation: 'styleCards',
  } as const;
  const colors = {
    key: 'q32_colors',
    text: 'Which specific colours do you like to wear?',
    options: styleColorIds.map((id) => [id, id] as const),
    multiple: true,
    presentation: 'colors',
  } as const;
  const formality = {
    key: 'q33_daily_formality',
    text: 'How formal do you like your everyday outfits?',
    options: [
      ['relaxed', 'Very relaxed'],
      ['casual', 'Casual'],
      ['smart_casual', 'Smart casual'],
      ['business_casual', 'Business casual'],
      ['formal', 'Formal'],
    ],
    presentation: 'scale',
  } as const;
  const strength = {
    key: 'q34_preference_strength',
    text: 'How strongly should your preferences influence recommendations?',
    options: [],
    presentation: 'strength',
  } as const;

  return [
    {
      id: 'identity',
      title: 'Your style and aesthetics',
      questions: [primary, ...get(['q21_aesthetics']), formality, strength],
    },
    {
      id: 'colors',
      title: 'Colours and patterns',
      questions: [colors, ...get(['q24_palettes', 'q22_patterns', 'q23_avoid_visuals'])],
    },
    {
      id: 'fits',
      title: 'Fits and clothes',
      questions: get(['q06_favorite_fits', 'q07_avoided_fits', 'q08_trouser_types', 'q09_shoes']),
    },
    {
      id: 'thermal',
      title: 'Comfort and weather',
      questions: get([
        'q01_thermal',
        'q02_at_18c',
        'q03_priority',
        'q04_layering',
        'q05_shorts_temperature',
      ]),
    },
    {
      id: 'pairing',
      title: 'Combining clothes',
      questions: get([
        'q10_sneakers_with_suit',
        'q11_blazer_with_tshirt',
        'q12_hoodie_under_blazer',
        'q13_style_mixing',
        'q14_experimentation',
        'q15_belt_shoe_match',
      ]),
    },
    {
      id: 'occasions',
      title: 'Occasions and accessories',
      questions: get([
        'q16_office_style',
        'q17_office_avoid',
        'q18_date_style',
        'q19_date_avoid',
        'q20_social_style',
        'q25_accessories',
        'q26_belt_use',
      ]),
    },
    {
      id: 'variety',
      title: 'Wardrobe and recommendations',
      questions: get([
        'q27_variety',
        'q28_remind_rarely_worn',
        'q29_include_forgotten',
        'q30_suggest_missing_items',
      ]),
    },
  ] as const;
})();

export const styleQuestionCount = styleQuestionSections.reduce(
  (total, section) => total + section.questions.length,
  0,
);

export function answeredStyleQuestionCount(answers: StyleAnswers) {
  return styleAnswerKeys.filter((key) => {
    const value = answers[key];

    return Array.isArray(value) ? value.length > 0 : value !== undefined;
  }).length;
}

export function styleValueLabel(key: StyleAnswerKey, value: unknown): string {
  let optionsForQuestion: readonly (readonly [string, string])[] | undefined;

  for (const section of styleQuestionSections) {
    for (const item of section.questions) {
      if (item.key === key) optionsForQuestion = item.options;
    }
  }

  if (!optionsForQuestion || value === undefined || value === null)
    return 'Preference not established';

  const label = (entry: unknown) =>
    optionsForQuestion.find(([option]) => option === String(entry))?.[1] ?? String(entry);

  return Array.isArray(value)
    ? value.map(label).join(', ') || 'Preference not established'
    : label(value);
}
