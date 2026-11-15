import { z } from 'zod';

import { preferenceStrengths, styleColorIds, styleIdentities } from './style-profile-catalog.js';

export const preferenceStrengthSchema = z
  .object({
    styles: z.enum(preferenceStrengths).optional(),
    colors: z.enum(preferenceStrengths).optional(),
    fits: z.enum(preferenceStrengths).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);

const options = <T extends string>(values: readonly T[]) => z.enum(values);
const multi = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).max(values.length);

export const styleAnswerKeys = [
  'q01_thermal',
  'q02_at_18c',
  'q03_priority',
  'q04_layering',
  'q05_shorts_temperature',
  'q06_favorite_fits',
  'q07_avoided_fits',
  'q08_trouser_types',
  'q09_shoes',
  'q10_sneakers_with_suit',
  'q11_blazer_with_tshirt',
  'q12_hoodie_under_blazer',
  'q13_style_mixing',
  'q14_experimentation',
  'q15_belt_shoe_match',
  'q16_office_style',
  'q17_office_avoid',
  'q18_date_style',
  'q19_date_avoid',
  'q20_social_style',
  'q21_aesthetics',
  'q22_patterns',
  'q23_avoid_visuals',
  'q24_palettes',
  'q25_accessories',
  'q26_belt_use',
  'q27_variety',
  'q28_remind_rarely_worn',
  'q29_include_forgotten',
  'q30_suggest_missing_items',
  'q31_dominant_style',
  'q32_colors',
  'q33_daily_formality',
  'q34_preference_strength',
] as const;
export type StyleAnswerKey = (typeof styleAnswerKeys)[number];

export const styleAnswersSchema = z
  .object({
    q01_thermal: options(['cold', 'balanced', 'warm']),
    q02_at_18c: multi([
      'tshirt',
      'long_sleeve',
      'shirt',
      'light_sweater',
      'hoodie',
      'light_jacket',
      'depends',
    ]),
    q03_priority: options(['comfort', 'balanced', 'appearance']),
    q04_layering: options(['rarely', 'sometimes', 'often', 'always']),
    q05_shorts_temperature: options(['above_25', 'above_22', 'above_20', 'above_18', 'anytime']),
    q06_favorite_fits: multi([
      'slim',
      'regular',
      'relaxed',
      'oversized',
      'straight',
      'wide',
      'tailored',
    ]),
    q07_avoided_fits: multi([
      'slim',
      'regular',
      'relaxed',
      'oversized',
      'straight',
      'wide',
      'tailored',
    ]),
    q08_trouser_types: multi([
      'jeans',
      'chinos',
      'tailored',
      'wide',
      'straight',
      'cargo',
      'joggers',
      'shorts',
    ]),
    q09_shoes: multi(['sneakers', 'formal', 'boots', 'loafers', 'sandals']),
    q10_sneakers_with_suit: options(['yes', 'sometimes', 'no']),
    q11_blazer_with_tshirt: options(['yes', 'sometimes', 'no']),
    q12_hoodie_under_blazer: options(['yes', 'sometimes', 'no']),
    q13_style_mixing: options(['never', 'rarely', 'sometimes', 'often']),
    q14_experimentation: options(['conservative', 'moderate', 'bold', 'very_bold']),
    q15_belt_shoe_match: options(['always', 'prefer', 'not_important']),
    q16_office_style: multi(['formal', 'business_casual', 'smart_casual', 'casual', 'uniform']),
    q17_office_avoid: multi([
      'tracksuits',
      'ripped_clothes',
      'slogans',
      'shorts',
      'sneakers',
      'bright_colors',
      'none',
    ]),
    q18_date_style: multi(['elegant', 'smart_casual', 'casual', 'romantic', 'creative']),
    q19_date_avoid: multi([
      'tracksuits',
      'ripped_clothes',
      'slogans',
      'formalwear',
      'bright_colors',
      'none',
    ]),
    q20_social_style: options(['more_stylish', 'similar', 'more_casual']),
    q21_aesthetics: multi([
      'minimalist',
      'classic',
      'streetwear',
      'preppy',
      'scandinavian',
      'boho',
      'workwear',
      'sporty',
      'romantic',
      'avant_garde',
    ]),
    q22_patterns: options(['plain', 'subtle', 'mixed', 'bold']),
    q23_avoid_visuals: multi([
      'neon',
      'large_logos',
      'animal_print',
      'florals',
      'stripes',
      'checks',
      'pastels',
      'black',
      'white',
      'none',
    ]),
    q24_palettes: multi([
      'neutrals',
      'earth',
      'monochrome',
      'cool',
      'warm',
      'pastel',
      'jewel',
      'bold',
    ]),
    q25_accessories: options(['never', 'rarely', 'sometimes', 'often']),
    q26_belt_use: multi(['with_loops', 'jeans_chinos', 'tailored_trousers', 'shorts', 'never']),
    q27_variety: options(['reliable', 'balanced', 'varied']),
    q28_remind_rarely_worn: z.boolean(),
    q29_include_forgotten: z.boolean(),
    q30_suggest_missing_items: z.boolean(),
    q31_dominant_style: z.enum(styleIdentities),
    q32_colors: multi(styleColorIds),
    q33_daily_formality: z.enum(['relaxed', 'casual', 'smart_casual', 'business_casual', 'formal']),
    q34_preference_strength: preferenceStrengthSchema,
  })
  .partial()
  .strict()
  .superRefine((answers, context) => {
    for (const [key, value] of Object.entries(answers)) {
      if (!Array.isArray(value)) continue;
      if (new Set(value).size !== value.length)
        context.addIssue({ code: 'custom', path: [key], message: 'Remove duplicate answers.' });
      if (value.some((entry) => entry === 'none') && value.length > 1)
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'The none option cannot be combined with other choices.',
        });
    }
  });

export const styleAnswersPatchSchema = styleAnswersSchema.refine(
  (answers) => Object.keys(answers).length > 0,
  'Provide at least one answer.',
);

export type StyleAnswers = z.infer<typeof styleAnswersSchema>;
export const styleProfileUpdateSchema = z
  .object({
    answers: styleAnswersSchema.default({}),
    skipped: z.array(z.enum(styleAnswerKeys)).max(styleAnswerKeys.length).default([]),
  })
  .strict()
  .refine((patch) => Object.keys(patch.answers).length > 0 || patch.skipped.length > 0);
export type StyleProfileUpdate = z.infer<typeof styleProfileUpdateSchema>;
export type StyleHardConstraints = {
  avoid_fits: NonNullable<StyleAnswers['q07_avoided_fits']>;
  office_avoid: NonNullable<StyleAnswers['q17_office_avoid']>;
  date_avoid: NonNullable<StyleAnswers['q19_date_avoid']>;
  avoid_visuals: NonNullable<StyleAnswers['q23_avoid_visuals']>;
  bans: {
    sneakers_with_suit: boolean;
    blazer_with_tshirt: boolean;
    hoodie_under_blazer: boolean;
  };
};

export function deriveStyleHardConstraints(answers: StyleAnswers): StyleHardConstraints {
  return {
    avoid_fits: answers.q07_avoided_fits ?? [],
    office_avoid: answers.q17_office_avoid?.includes('none')
      ? []
      : (answers.q17_office_avoid ?? []),
    date_avoid: answers.q19_date_avoid?.includes('none') ? [] : (answers.q19_date_avoid ?? []),
    avoid_visuals: answers.q23_avoid_visuals?.includes('none')
      ? []
      : (answers.q23_avoid_visuals ?? []),
    bans: {
      sneakers_with_suit: answers.q10_sneakers_with_suit === 'no',
      blazer_with_tshirt: answers.q11_blazer_with_tshirt === 'no',
      hoodie_under_blazer: answers.q12_hoodie_under_blazer === 'no',
    },
  };
}

export const styleProfileSchema = z.object({
  schema_version: z.literal(1),
  answers: styleAnswersSchema,
  skipped: z.array(z.enum(styleAnswerKeys)),
  hard_constraints: z.object({
    avoid_fits: z.array(z.string()),
    office_avoid: z.array(z.string()),
    date_avoid: z.array(z.string()),
    avoid_visuals: z.array(z.string()),
    bans: z.object({
      sneakers_with_suit: z.boolean(),
      blazer_with_tshirt: z.boolean(),
      hoodie_under_blazer: z.boolean(),
    }),
  }),
});

export const styleProfileStoredSchema = z.object({
  schema_version: z.literal(1),
  answers: styleAnswersSchema,
  skipped: z.array(z.enum(styleAnswerKeys)).default([]),
});

export type StyleProfile = z.infer<typeof styleProfileSchema>;
