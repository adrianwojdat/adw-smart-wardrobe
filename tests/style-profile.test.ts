import { describe, expect, it } from 'vitest';

import {
  answeredStyleQuestionCount,
  deriveStyleHardConstraints,
  styleAnswerKeys,
  styleAnswersSchema,
  styleProfileUpdateSchema,
  styleQuestionCount,
  styleQuestionSections,
  styleValueLabel,
} from '../packages/shared/src/index.ts';

describe('stylistic profile questionnaire', () => {
  it('retains the original 30 questions and adds four optional questions in seven sections', () => {
    expect(styleQuestionSections).toHaveLength(7);
    expect(styleQuestionCount).toBe(34);
    expect([...styleAnswerKeys].sort()).toEqual(Object.keys(styleAnswersSchema.shape).sort());
    expect(
      styleQuestionSections.flatMap((section) => section.questions.map((q) => q.key)).sort(),
    ).toEqual([...styleAnswerKeys].sort());
  });

  it('validates partial answers and persists skipped questions independently', () => {
    const answers = styleAnswersSchema.parse({ q01_thermal: 'cold', q28_remind_rarely_worn: true });

    expect(answeredStyleQuestionCount(answers)).toBe(2);
    expect(
      styleProfileUpdateSchema.safeParse({ answers: {}, skipped: ['q02_at_18c'] }).success,
    ).toBe(true);
    expect(
      styleProfileUpdateSchema.safeParse({ answers: { q01_thermal: 'unknown' }, skipped: [] })
        .success,
    ).toBe(false);
  });

  it('keeps hard bans separate from soft preferences', () => {
    const soft = styleAnswersSchema.parse({
      q10_sneakers_with_suit: 'sometimes',
      q13_style_mixing: 'often',
      q17_office_avoid: ['none'],
    });

    expect(deriveStyleHardConstraints(soft)).toMatchObject({
      office_avoid: [],
      bans: { sneakers_with_suit: false },
    });

    const strict = styleAnswersSchema.parse({
      q07_avoided_fits: ['slim'],
      q10_sneakers_with_suit: 'no',
      q23_avoid_visuals: ['neon'],
    });

    expect(deriveStyleHardConstraints(strict)).toMatchObject({
      avoid_fits: ['slim'],
      avoid_visuals: ['neon'],
      bans: { sneakers_with_suit: true },
    });
  });

  it('rejects contradictory multi-selects and returns English source labels for stored choices', () => {
    expect(styleAnswersSchema.safeParse({ q17_office_avoid: ['none', 'shorts'] }).success).toBe(
      false,
    );
    expect(styleAnswersSchema.safeParse({ q06_favorite_fits: ['slim', 'slim'] }).success).toBe(
      false,
    );
    expect(styleValueLabel('q01_thermal', 'cold')).toBe('I tend to feel cold');
    expect(styleValueLabel('q06_favorite_fits', ['regular', 'oversized'])).toBe(
      'Regular, Oversized',
    );
  });
});
