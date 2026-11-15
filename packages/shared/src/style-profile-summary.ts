import {
  deriveStyleHardConstraints,
  type StyleAnswerKey,
  styleAnswerKeys,
  type StyleAnswers,
  styleAnswersSchema,
} from './style-profile-schemas.js';

/** Pure interpretation of explicit answers; null means unknown, never a guessed preference. */
export function interpretStyleProfile(input: StyleAnswers) {
  const a = styleAnswersSchema.parse(input);
  const hardConstraints = deriveStyleHardConstraints(a);
  const conflicts: string[] = [];
  const fits = (a.q06_favorite_fits ?? []).filter((f) => {
    if (hardConstraints.avoid_fits.includes(f)) {
      conflicts.push('fits');

      return false;
    }

    return true;
  });
  const colors = (a.q32_colors ?? []).filter((c) => {
    if ((c === 'black' || c === 'white') && hardConstraints.avoid_visuals.includes(c)) {
      conflicts.push('colors');

      return false;
    }

    return true;
  });
  const answered = (keys: readonly StyleAnswerKey[]) =>
    keys.filter((k) => {
      const v = a[k];

      return Array.isArray(v) ? v.length > 0 : v !== undefined;
    }).length;

  return {
    stylePreferences: {
      dominantStyle: a.q31_dominant_style ?? null,
      supportingStyles: (a.q21_aesthetics ?? []).filter((s) => s !== a.q31_dominant_style),
      colors,
      palettes: a.q24_palettes ?? [],
      fits,
      trousers: a.q08_trouser_types ?? [],
      shoes: a.q09_shoes ?? [],
      patterns: a.q22_patterns ?? null,
      strength: a.q34_preference_strength ?? {},
    },
    hardConstraints,
    contextualPreferences: {
      thermal: a.q01_thermal ?? null,
      at18c: a.q02_at_18c ?? [],
      priority: a.q03_priority ?? null,
      layering: a.q04_layering ?? null,
      shortsTemperature: a.q05_shorts_temperature ?? null,
      dailyFormality: a.q33_daily_formality ?? null,
      officeStyle: a.q16_office_style ?? [],
      dateStyle: a.q18_date_style ?? [],
      socialStyle: a.q20_social_style ?? null,
      mixing: a.q13_style_mixing ?? null,
      experimentation: a.q14_experimentation ?? null,
      beltMatch: a.q15_belt_shoe_match ?? null,
      accessories: a.q25_accessories ?? null,
      beltUse: a.q26_belt_use ?? [],
    },
    recommendationPreferences: {
      variety: a.q27_variety ?? null,
      remindRarelyWorn: a.q28_remind_rarely_worn ?? null,
      includeForgotten: a.q29_include_forgotten ?? null,
      suggestMissing: a.q30_suggest_missing_items ?? null,
    },
    progress: {
      baseAnswered: answered(styleAnswerKeys.slice(0, 30)),
      baseTotal: 30,
      extensionAnswered: answered(styleAnswerKeys.slice(30)),
      extensionTotal: 4,
    },
    conflicts: [...new Set(conflicts)],
  };
}

export type StyleProfileSummary = ReturnType<typeof interpretStyleProfile>;

export function resolveStyleContext(
  summary: StyleProfileSummary,
  context: { occasion: string; temperature: number; weather?: string },
) {
  const p = summary.contextualPreferences;

  return {
    occasion: context.occasion,
    temperature: context.temperature,
    weather: context.weather ?? null,
    occasionPreferences:
      context.occasion === 'office'
        ? p.officeStyle
        : context.occasion === 'date'
          ? p.dateStyle
          : [],
    dailyFormality: p.dailyFormality,
    occasionBans:
      context.occasion === 'office'
        ? summary.hardConstraints.office_avoid
        : context.occasion === 'date'
          ? summary.hardConstraints.date_avoid
          : [],
    thermalPreference: p.thermal,
    layering: p.layering,
    shortsTemperature: p.shortsTemperature,
    adverseWeather: /rain|snow|deszcz|śnieg/i.test(context.weather ?? ''),
  };
}
