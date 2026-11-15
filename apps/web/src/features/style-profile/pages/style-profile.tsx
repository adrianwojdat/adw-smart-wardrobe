import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pencil, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  answeredStyleQuestionCount,
  interpretStyleProfile,
  styleQuestionCount,
  styleQuestionSections,
} from '@wardrobe/shared';

import { ErrorNotice, Loading, useMe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api/client';

import { PageHeading } from '../../catalog';

import { StyleSummary } from '../components/style-summary';
import { formatStyleAnswer as translatedStyleAnswer } from '../lib/format-style-answer';

export function StyleProfilePage() {
  const { t } = useTranslation('styleProfile');
  const me = useMe();
  const profile = useQuery({
    queryKey: ['style-profile', me.data?.id],
    queryFn: api.styleProfile,
    enabled: !!me.data?.id,
    retry: false,
  });

  if (me.isPending || profile.isPending) return <Loading />;
  if (profile.error) return <ErrorNotice error={profile.error} />;
  if (!profile.data) return null;

  const answers = profile.data.answers;
  const interpretation = interpretStyleProfile(answers);
  const { baseAnswered, baseTotal, extensionAnswered, extensionTotal } = interpretation.progress;
  const answered = answeredStyleQuestionCount(answers);
  const constraints = interpretation.hardConstraints;
  const noPairings = [
    constraints.bans.sneakers_with_suit && t('summary.banSneakersSuit'),
    constraints.bans.blazer_with_tshirt && t('summary.banBlazerTshirt'),
    constraints.bans.hoodie_under_blazer && t('summary.banHoodieBlazer'),
  ].filter((item): item is string => Boolean(item));
  const hardRules = [
    ...constraints.avoid_fits.map((value) =>
      t('page.fitPrefix', {
        value: translatedStyleAnswer(t, 'q07_avoided_fits', value),
      }),
    ),
    ...constraints.office_avoid.map((value) =>
      t('page.officePrefix', {
        value: translatedStyleAnswer(t, 'q17_office_avoid', value),
      }),
    ),
    ...constraints.date_avoid.map((value) =>
      t('page.datePrefix', {
        value: translatedStyleAnswer(t, 'q19_date_avoid', value),
      }),
    ),
    ...constraints.avoid_visuals.map((value) =>
      t('page.avoidPrefix', {
        value: translatedStyleAnswer(t, 'q23_avoid_visuals', value),
      }),
    ),
    ...noPairings,
  ];

  return (
    <div className="style-profile-page">
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={t('page.description')}
        action={
          <Button asChild>
            <Link to="/style/survey">
              <Pencil size={16} /> {t('page.edit')}
            </Link>
          </Button>
        }
      />
      <section className="style-profile-progress-card">
        <div>
          <Sparkles size={20} />
          <div>
            <strong>{t('summary.overallProgress', { answered, total: styleQuestionCount })}</strong>
            <p>{t('summary.baseProgress', { answered: baseAnswered, total: baseTotal })}</p>
            <p>{t('page.skipped', { count: profile.data.skipped.length })}</p>
            <p>
              {t('summary.extensionProgress', {
                answered: extensionAnswered,
                total: extensionTotal,
              })}
            </p>
            <p>{t('summary.extensionNote')}</p>
          </div>
        </div>
        <progress
          value={answered}
          max={styleQuestionCount}
          aria-label={t('page.profileProgress')}
        />
      </section>
      <StyleSummary summary={interpretation} />
      <section className="style-hard-rules">
        <div className="style-section-heading">
          <span className="eyebrow">{t('page.hardRulesEyebrow')}</span>
          <h2>{t('page.hardRules')}</h2>
        </div>
        {hardRules.length ? (
          <ul>
            {hardRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : (
          <p>{t('page.noHardRules')}</p>
        )}
      </section>
      <details className="style-full-profile">
        <summary>{t('page.fullProfile')}</summary>
        <div className="style-section-heading">
          <span className="eyebrow">{t('page.allAnswers')}</span>
          <h2>{t('page.fullProfile')}</h2>
        </div>
        {styleQuestionSections.map((section) => (
          <details className="style-profile-section" key={section.id}>
            <summary>
              <span>{t(`sections.${section.id}`)}</span>
              <span>
                {section.questions.filter((item) => answers[item.key] !== undefined).length}/
                {section.questions.length}
              </span>
            </summary>
            <dl>
              {section.questions.map((question) => {
                const key = question.key;
                const value = answers[key];

                return (
                  <div key={question.key}>
                    <dt>{t(`questions.${question.key}`)}</dt>
                    <dd>
                      {value === undefined
                        ? profile.data.skipped.includes(key)
                          ? t('page.skippedLabel')
                          : t('page.unanswered')
                        : translatedStyleAnswer(t, key, value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </details>
        ))}
      </details>
      <div className="style-profile-end-action">
        <Button variant="outline" asChild>
          <Link to="/style/survey">
            <Pencil size={16} /> {t('page.backToSurvey')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
