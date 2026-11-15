import { describe, expect, it } from 'vitest';

import {
  evaluateStyleOutfit,
  interpretStyleProfile,
  resolveStyleContext,
  styleAnswersSchema,
  styleProfileStoredSchema,
  styleProfileUpdateSchema,
} from '../packages/shared/src/index.ts';

const legacy = {
  q01_thermal: 'cold',
  q02_at_18c: ['shirt'],
  q03_priority: 'comfort',
  q04_layering: 'often',
  q05_shorts_temperature: 'above_25',
  q06_favorite_fits: ['regular'],
  q07_avoided_fits: ['slim'],
  q08_trouser_types: ['jeans'],
  q09_shoes: ['sneakers'],
  q10_sneakers_with_suit: 'no',
  q11_blazer_with_tshirt: 'yes',
  q12_hoodie_under_blazer: 'no',
  q13_style_mixing: 'sometimes',
  q14_experimentation: 'moderate',
  q15_belt_shoe_match: 'prefer',
  q16_office_style: ['business_casual'],
  q17_office_avoid: ['shorts'],
  q18_date_style: ['elegant'],
  q19_date_avoid: ['tracksuits'],
  q20_social_style: 'more_stylish',
  q21_aesthetics: ['classic', 'minimalist'],
  q22_patterns: 'subtle',
  q23_avoid_visuals: ['neon'],
  q24_palettes: ['earth'],
  q25_accessories: 'sometimes',
  q26_belt_use: ['jeans_chinos'],
  q27_variety: 'balanced',
  q28_remind_rarely_worn: false,
  q29_include_forgotten: true,
  q30_suggest_missing_items: false,
};
const context = { occasion: 'everyday', temperature: 18 };

describe('deterministic shared style interpretation', () => {
  it('preserves all 30 legacy answers without assigning any extension defaults', () => {
    const parsed = styleAnswersSchema.parse(legacy);

    expect(parsed).toEqual(legacy);

    const profile = interpretStyleProfile(parsed);

    expect(profile.progress).toEqual({
      baseAnswered: 30,
      baseTotal: 30,
      extensionAnswered: 0,
      extensionTotal: 4,
    });
    expect(profile.stylePreferences).toMatchObject({
      dominantStyle: null,
      supportingStyles: ['classic', 'minimalist'],
      colors: [],
      palettes: ['earth'],
      strength: {},
    });
    expect(profile.contextualPreferences.dailyFormality).toBeNull();
    expect(legacy.q01_thermal).toBe('cold');
  });
  it('keeps unknown, explicit No and explicit Yes distinct in empty and partial profiles', () => {
    expect(interpretStyleProfile({}).recommendationPreferences.remindRarelyWorn).toBeNull();
    expect(
      interpretStyleProfile({ q28_remind_rarely_worn: false }).recommendationPreferences
        .remindRarelyWorn,
    ).toBe(false);
    expect(
      interpretStyleProfile({ q28_remind_rarely_worn: true }).recommendationPreferences
        .remindRarelyWorn,
    ).toBe(true);
    expect(interpretStyleProfile({}).stylePreferences.dominantStyle).toBeNull();
    expect(interpretStyleProfile({ q28_remind_rarely_worn: false }).progress.baseAnswered).toBe(1);
  });
  it('uses explicit stable style/color identifiers and independent preference strengths', () => {
    const p = interpretStyleProfile({
      q31_dominant_style: 'classic',
      q21_aesthetics: ['classic', 'preppy'],
      q32_colors: ['navy', 'beige'],
      q33_daily_formality: 'smart_casual',
      q34_preference_strength: { styles: 'strong', colors: 'gentle' },
    });

    expect(p.stylePreferences).toMatchObject({
      dominantStyle: 'classic',
      supportingStyles: ['preppy'],
      colors: ['navy', 'beige'],
      strength: { styles: 'strong', colors: 'gentle' },
    });
    expect(p.progress.extensionAnswered).toBe(4);
    expect(styleAnswersSchema.safeParse({ q31_dominant_style: 'Klasyczny' }).success).toBe(false);
    expect(styleAnswersSchema.safeParse({ q32_colors: ['navy', 'navy'] }).success).toBe(false);
    expect(styleAnswersSchema.safeParse({ q34_preference_strength: {} }).success).toBe(false);
  });
  it('gives restrictions precedence without deleting conflicting saved answers', () => {
    const answers = styleAnswersSchema.parse({
      q06_favorite_fits: ['slim', 'regular'],
      q07_avoided_fits: ['slim'],
      q32_colors: ['black', 'navy'],
      q23_avoid_visuals: ['black'],
    });
    const before = JSON.stringify(answers),
      p = interpretStyleProfile(answers);

    expect(p.stylePreferences.fits).toEqual(['regular']);
    expect(p.stylePreferences.colors).toEqual(['navy']);
    expect(p.conflicts).toEqual(['fits', 'colors']);
    expect(JSON.stringify(answers)).toBe(before);
  });
  it('scopes office/date restrictions and exposes explicit thermal/weather context', () => {
    const p = interpretStyleProfile(styleAnswersSchema.parse(legacy));

    expect(
      resolveStyleContext(p, { ...context, occasion: 'office', weather: 'rain' }),
    ).toMatchObject({
      occasionBans: ['shorts'],
      occasionPreferences: ['business_casual'],
      thermalPreference: 'cold',
      adverseWeather: true,
    });
    expect(resolveStyleContext(p, { ...context, occasion: 'date' }).occasionBans).toEqual([
      'tracksuits',
    ]);
    expect(resolveStyleContext(p, context).occasionBans).toEqual([]);
  });
  it('ranks soft preferences without excluding alternatives, while enforcing hard bans', () => {
    const p = interpretStyleProfile({
      q31_dominant_style: 'classic',
      q32_colors: ['navy'],
      q34_preference_strength: { styles: 'strong' },
      q17_office_avoid: ['shorts'],
    });
    const favorite = evaluateStyleOutfit(
      p,
      [{ category: 'tops', name: 'Classic shirt', style: 'classic', primary_color: 'navy' }],
      context,
    );
    const alternative = evaluateStyleOutfit(
      p,
      [{ category: 'bottoms', name: 'Shorts', style: 'sporty', primary_color: 'red' }],
      context,
    );

    expect(favorite.softScore).toBeGreaterThan(alternative.softScore);
    expect(alternative.violations).toEqual([]);
    expect(
      evaluateStyleOutfit(p, [{ category: 'bottoms', name: 'Shorts' }], {
        ...context,
        occasion: 'office',
      }).violations,
    ).toContain('occasion_ban');
  });
  it('matches bilingual restriction metadata without confusing shorts and short sleeves', () => {
    const p = interpretStyleProfile({
      q17_office_avoid: ['shorts'],
      q23_avoid_visuals: ['stripes'],
    });
    const office = { ...context, occasion: 'office' };

    expect(
      evaluateStyleOutfit(
        p,
        [{ category: 'tops', name: 'Short sleeve shirt', style: 'informal' }],
        office,
      ).violations,
    ).toEqual([]);
    expect(
      evaluateStyleOutfit(p, [{ category: 'tops', name: 'Striped shirt' }], office).violations,
    ).toContain('visual_ban');
    expect(
      evaluateStyleOutfit(p, [{ category: 'bottoms', name: 'Szorty' }], office).violations,
    ).toContain('occasion_ban');
  });
  it('round-trips schema version 1 JSON and additive updates without losing old values or skipped answers', () => {
    const stored = styleProfileStoredSchema.parse({
      schema_version: 1,
      answers: legacy,
      skipped: [],
    });
    const patch = styleProfileUpdateSchema.parse({
      answers: { q31_dominant_style: 'classic', q32_colors: ['navy'] },
      skipped: ['q33_daily_formality'],
    });
    const saved = styleProfileStoredSchema.parse(
      JSON.parse(
        JSON.stringify({
          ...stored,
          answers: { ...stored.answers, ...patch.answers },
          skipped: patch.skipped,
        }),
      ),
    );

    for (const [key, value] of Object.entries(legacy))
      expect(saved.answers).toHaveProperty(key, value);
    expect(saved.skipped).toEqual(['q33_daily_formality']);
    expect(saved.answers.q34_preference_strength).toBeUndefined();
  });
});
