import { useTranslation } from 'react-i18next';

import { type StyleAnswerKey, styleColors, type StyleProfileSummary } from '@wardrobe/shared';

import { formatStyleAnswer } from '../lib/format-style-answer';

type SummaryProps = { summary: StyleProfileSummary };

export function StyleSummary({ summary }: SummaryProps) {
  const { t } = useTranslation('styleProfile');
  const p = summary.stylePreferences,
    c = summary.contextualPreferences,
    r = summary.recommendationPreferences;
  const value = (key: StyleAnswerKey, answer: unknown) => formatStyleAnswer(t, key, answer);
  const characteristics: { label: string; key: StyleAnswerKey; answer: unknown }[] = [
    { label: 'fits', key: 'q06_favorite_fits', answer: p.fits },
    { label: 'trousers', key: 'q08_trouser_types', answer: p.trousers },
    { label: 'shoes', key: 'q09_shoes', answer: p.shoes },
    { label: 'formality', key: 'q33_daily_formality', answer: c.dailyFormality },
    { label: 'patterns', key: 'q22_patterns', answer: p.patterns },
    { label: 'palettes', key: 'q24_palettes', answer: p.palettes },
    { label: 'mixing', key: 'q13_style_mixing', answer: c.mixing },
    { label: 'strength', key: 'q34_preference_strength', answer: p.strength },
  ];
  const rules: { label: string; key: StyleAnswerKey; answer: unknown }[] = [
    { label: 'thermal', key: 'q01_thermal', answer: c.thermal },
    { label: 'at18c', key: 'q02_at_18c', answer: c.at18c },
    { label: 'priority', key: 'q03_priority', answer: c.priority },
    { label: 'layering', key: 'q04_layering', answer: c.layering },
    { label: 'shorts', key: 'q05_shorts_temperature', answer: c.shortsTemperature },
    { label: 'office', key: 'q16_office_style', answer: c.officeStyle },
    { label: 'date', key: 'q18_date_style', answer: c.dateStyle },
    { label: 'social', key: 'q20_social_style', answer: c.socialStyle },
    { label: 'accessories', key: 'q25_accessories', answer: c.accessories },
    { label: 'variety', key: 'q27_variety', answer: r.variety },
    { label: 'remind', key: 'q28_remind_rarely_worn', answer: r.remindRarelyWorn },
    { label: 'forgotten', key: 'q29_include_forgotten', answer: r.includeForgotten },
    { label: 'missing', key: 'q30_suggest_missing_items', answer: r.suggestMissing },
  ];

  return (
    <>
      <section className="style-identity-hero" aria-label={t('summary.dominant')}>
        <span className="eyebrow">{t('summary.dominant')}</span>
        <h2>
          {p.dominantStyle ? value('q31_dominant_style', p.dominantStyle) : t('summary.unknown')}
        </h2>
        <p>
          {p.dominantStyle
            ? t(`styleDescriptions.${p.dominantStyle}`)
            : t('summary.chooseDominant')}
        </p>
        <h3>{t('summary.supporting')}</h3>
        <div className="style-summary-chips">
          {p.supportingStyles.length ? (
            p.supportingStyles.map((style) => (
              <span className="badge badge-outline" key={style}>
                {value('q21_aesthetics', style)}
              </span>
            ))
          ) : (
            <span>{t('summary.unknown')}</span>
          )}
        </div>
      </section>
      <section className="style-palette-card" aria-label={t('summary.colors')}>
        <h2>{t('summary.colors')}</h2>
        {p.colors.length ? (
          <div className="style-palette">
            {p.colors.map((color) => (
              <div key={color}>
                <span
                  className="style-color-swatch"
                  style={{ backgroundColor: styleColors[color] }}
                  aria-hidden="true"
                />
                <span>{value('q32_colors', color)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>{t('summary.colorsEmpty')}</p>
        )}
      </section>
      <section className="style-summary-grid" aria-label={t('page.profileSummary')}>
        {characteristics.map(({ label, key, answer }) => (
          <article className="style-summary-card" key={label}>
            <span>{t(`summary.${label}`)}</span>
            <strong>
              {key === 'q34_preference_strength' && !Object.keys(p.strength).length
                ? t('summary.unknown')
                : value(key, answer)}
            </strong>
          </article>
        ))}
      </section>
      <section className="style-generator-rules">
        <div className="style-section-heading">
          <span className="eyebrow">{t('summary.rulesEyebrow')}</span>
          <h2>{t('summary.rules')}</h2>
        </div>
        <p>{t('summary.softExplanation')}</p>
        <p>{t('summary.contextExplanation')}</p>
        <dl className="style-rules-grid">
          {rules.map(({ label, key, answer }) => (
            <div key={label}>
              <dt>{t(`summary.${label}`)}</dt>
              <dd>{value(key, answer)}</dd>
            </div>
          ))}
        </dl>
      </section>
      {summary.conflicts.length > 0 && (
        <p className="style-local-warning" role="status">
          {t('summary.conflict')}
        </p>
      )}
    </>
  );
}
