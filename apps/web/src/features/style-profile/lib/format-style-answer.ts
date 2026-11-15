import type { TFunction } from 'i18next';

import { type StyleAnswerKey, styleQuestionSections } from '@wardrobe/shared';

export function formatStyleAnswer(
  t: TFunction<'styleProfile'>,
  key: StyleAnswerKey,
  value: unknown,
): string {
  if (value === undefined || value === null || (Array.isArray(value) && !value.length))
    return t('summary.unknown');

  if (key === 'q34_preference_strength' && typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .map(
        ([dimension, strength]) =>
          `${t(`dimensions.${dimension}`)}: ${t(`strengths.${String(strength)}`)}`,
      )
      .join(' · ');
  }

  const question = styleQuestionSections
    .flatMap((section) => [...section.questions])
    .find((item) => item.key === key);
  const label = (entry: unknown) => {
    const option = String(entry);
    const fallback = question?.options.find(([id]) => id === option)?.[1] ?? option;

    return t(`questionOptions.${key}.${option}`, {
      defaultValue: t(`options.${option}`, { defaultValue: fallback }),
    });
  };

  return Array.isArray(value) ? value.map(label).join(', ') : label(value);
}
