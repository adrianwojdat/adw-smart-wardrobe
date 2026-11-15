import { useTranslation } from 'react-i18next';

import {
  preferenceDimensions,
  preferenceStrengths,
  preferenceStrengthSchema,
  type StyleAnswerKey,
  type StyleAnswers,
  styleColors,
  styleQuestionSections,
} from '@wardrobe/shared';

type StyleQuestionDefinition = (typeof styleQuestionSections)[number]['questions'][number];

type StyleQuestionProps = {
  question: StyleQuestionDefinition;
  number: number;
  value: StyleAnswers[StyleAnswerKey];
  skipped: boolean;
  onAnswer: (key: StyleAnswerKey, value: unknown) => void;
  onSkip: (key: StyleAnswerKey) => void;
};

export function StyleQuestion({
  question,
  number,
  value,
  skipped,
  onAnswer,
  onSkip,
}: StyleQuestionProps) {
  const { t } = useTranslation('styleProfile');
  const key = question.key;
  const multiple = 'multiple' in question && question.multiple;
  const presentation = 'presentation' in question ? question.presentation : undefined;
  const strength = preferenceStrengthSchema.safeParse(value);
  const boolean = 'boolean' in question && question.boolean;

  return (
    <fieldset className="style-question">
      <legend>
        <span className="style-question-number">{number}</span>
        <span>{t(`questions.${question.key}`)}</span>
        {'hard' in question && question.hard && (
          <small className="hard-rule-label">{t('page.hardRule')}</small>
        )}
      </legend>
      {presentation === 'strength' ? (
        <div className="style-strength-grid">
          <p>{t('summary.softExplanation')}</p>
          {preferenceDimensions.map((dimension) => (
            <fieldset key={dimension}>
              <legend>{t(`dimensions.${dimension}`)}</legend>
              <div className="style-options">
                {preferenceStrengths.map((level) => (
                  <label className="style-option" key={level}>
                    <input
                      className="radio"
                      type="radio"
                      name={`${key}-${dimension}`}
                      checked={strength.success && strength.data[dimension] === level}
                      onChange={() =>
                        onAnswer(key, {
                          ...(strength.success ? strength.data : {}),
                          [dimension]: level,
                        })
                      }
                    />
                    <span>{t(`strengths.${level}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : (
        <div
          className={
            'style-options ' +
            (multiple ? 'style-options-multiple ' : '') +
            (presentation === 'styleCards'
              ? 'style-identity-options'
              : presentation === 'colors'
                ? 'style-color-options'
                : presentation === 'scale'
                  ? 'style-formality-options'
                  : '')
          }
        >
          {question.options.map(([option, label], index) => {
            const selected = multiple
              ? Array.isArray(value) && value.some((item) => item === option)
              : boolean
                ? value === (option === 'true')
                : value === option;

            return (
              <label className="style-option" key={option}>
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name={question.key}
                  checked={selected}
                  onChange={() => {
                    if (multiple) {
                      const current = Array.isArray(value) ? value : [];
                      const next = selected
                        ? current.filter((item) => item !== option)
                        : option === 'none'
                          ? [option]
                          : [...current.filter((item) => item !== 'none'), option];

                      onAnswer(key, next);
                    } else if (boolean) onAnswer(key, option === 'true');
                    else onAnswer(key, option);
                  }}
                  className={multiple ? 'checkbox' : 'radio'}
                />
                {presentation === 'colors' && (
                  <span
                    className="style-color-swatch"
                    style={{
                      backgroundColor: Object.entries(styleColors).find(
                        ([id]) => id === option,
                      )?.[1],
                    }}
                    aria-hidden="true"
                  />
                )}
                {presentation === 'scale' && (
                  <span className="style-scale-number" aria-hidden="true">
                    {index + 1}
                  </span>
                )}
                <span>
                  {t(`questionOptions.${key}.${option}`, {
                    defaultValue: t(`options.${option}`, { defaultValue: label }),
                  })}
                  {presentation === 'styleCards' && (
                    <small>{t(`styleDescriptions.${option}`)}</small>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
      <div className="style-question-footer">
        {skipped && <span className="style-skipped-label">{t('page.skippedLabel')}</span>}
        {!skipped && (
          <button type="button" className="style-skip" onClick={() => onSkip(key)}>
            {t('page.skipQuestion')}
          </button>
        )}
      </div>
    </fieldset>
  );
}
