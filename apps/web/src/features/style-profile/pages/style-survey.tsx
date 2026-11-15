import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  answeredStyleQuestionCount,
  interpretStyleProfile,
  type StyleAnswerKey,
  styleAnswerKeys,
  type StyleAnswers,
  styleAnswersSchema,
  type StyleProfileUpdate,
  styleProfileUpdateSchema,
  styleQuestionCount,
  styleQuestionSections,
} from '@wardrobe/shared';

import { ErrorNotice, Loading, useMe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api/client';

import { PageHeading } from '../../catalog';

import { StyleQuestion } from '../components/style-question';

type LocalProgress = {
  survey_version: 2;
  step: number;
  pendingAnswers: Partial<StyleAnswers>;
  pendingSkipped: StyleAnswerKey[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function progressKey(userId: string) {
  return `smart-wardrobe-style-progress:${userId}`;
}

function readProgress(userId: string): LocalProgress | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(progressKey(userId)) ?? 'null') as unknown;

    if (!isRecord(parsed)) return undefined;

    const record = parsed;
    const answers = styleAnswersSchema.safeParse(record.pendingAnswers ?? {});

    if (!answers.success || !Array.isArray(record.pendingSkipped)) return undefined;

    const previousStep =
      typeof record.step === 'number' ? Math.max(0, Math.min(6, Math.floor(record.step))) : 0;

    return {
      survey_version: 2,
      step: record.survey_version === 2 ? previousStep : [3, 2, 4, 5, 0, 5, 6][previousStep]!,
      pendingAnswers: answers.data,
      pendingSkipped: record.pendingSkipped.filter(
        (key): key is StyleAnswerKey =>
          typeof key === 'string' && styleAnswerKeys.some((validKey) => validKey === key),
      ),
    };
  } catch {
    return undefined;
  }
}

export function StyleSurveyPage() {
  const { t } = useTranslation('styleProfile');
  const me = useMe();
  const userId = me.data?.id;
  const cache = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ['style-profile', userId];
  const profile = useQuery({
    queryKey,
    queryFn: api.styleProfile,
    enabled: !!userId,
    retry: false,
  });
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<StyleAnswers>({});
  const [skipped, setSkipped] = useState<StyleAnswerKey[]>([]);
  const [savingCount, setSavingCount] = useState(0);
  const [saveError, setSaveError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  const pendingAnswers = useRef<Partial<StyleAnswers>>({});
  const pendingSkipped = useRef<StyleAnswerKey[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const hydratedUser = useRef<string | null>(null);

  const storeProgress = useCallback(
    (nextStep = step) => {
      if (!userId) return;

      try {
        localStorage.setItem(
          progressKey(userId),
          JSON.stringify({
            survey_version: 2,
            step: nextStep,
            pendingAnswers: pendingAnswers.current,
            pendingSkipped: pendingSkipped.current,
          } satisfies LocalProgress),
        );
      } catch {
        setNotice(t('page.localProgressError'));
      }
    },
    [userId, step, t],
  );

  const enqueue = useCallback(
    (patchInput: StyleProfileUpdate): Promise<void> => {
      if (!userId) return Promise.resolve();

      const patch = styleProfileUpdateSchema.parse(patchInput);

      setSavingCount((count) => count + 1);
      setSaveError(undefined);

      const operation = queue.current.then(async () => {
        const saved = await api.saveStyleProfile(patch);

        cache.setQueryData(['style-profile', userId], saved);

        for (const key of styleAnswerKeys) {
          if (
            Object.hasOwn(patch.answers, key) &&
            JSON.stringify(pendingAnswers.current[key]) === JSON.stringify(patch.answers[key])
          )
            delete pendingAnswers.current[key];
        }

        pendingSkipped.current = pendingSkipped.current.filter(
          (key) => !patch.skipped.includes(key),
        );
        storeProgress();
      });

      queue.current = operation.catch(() => undefined);

      return operation
        .catch((error: unknown) => {
          setSaveError(error);
          throw error;
        })
        .finally(() => setSavingCount((count) => Math.max(0, count - 1)));
    },
    [userId, cache, storeProgress],
  );

  useEffect(() => {
    if (!userId || !profile.data || hydratedUser.current === userId) return;
    hydratedUser.current = userId;

    const local = readProgress(userId);
    const localAnswers = local?.pendingAnswers ?? {};
    const localSkipped = local?.pendingSkipped ?? [];

    pendingAnswers.current = localAnswers;
    pendingSkipped.current = localSkipped;
    setStep(local?.step ?? 0);
    setAnswers({ ...profile.data.answers, ...localAnswers });
    setSkipped([...new Set([...profile.data.skipped, ...localSkipped])]);

    if (local && (Object.keys(localAnswers).length || localSkipped.length)) {
      const retry = styleProfileUpdateSchema.parse({
        answers: localAnswers,
        skipped: localSkipped,
      });

      void enqueue(retry).catch(() => undefined);
    }
  }, [userId, profile.data, enqueue]);

  async function setAnswer(key: StyleAnswerKey, value: unknown) {
    const parsed = styleAnswersSchema.safeParse({ ...answers, [key]: value });

    if (!parsed.success) {
      setNotice(t('page.invalidAnswer'));

      return;
    }

    setAnswers(parsed.data);
    setSkipped((current) => current.filter((item) => item !== key));
    pendingAnswers.current = { ...pendingAnswers.current, [key]: value };
    pendingSkipped.current = pendingSkipped.current.filter((item) => item !== key);
    storeProgress();

    try {
      await enqueue({ answers: { [key]: value }, skipped: [] });
      setNotice(t('page.answerSaved'));
    } catch {
      setNotice(t('page.answerKept'));
    }
  }

  async function skipQuestion(key: StyleAnswerKey) {
    const next = { ...answers };

    delete next[key];
    setAnswers(next);
    setSkipped((current) => (current.includes(key) ? current : [...current, key]));
    delete pendingAnswers.current[key];
    pendingSkipped.current = [...new Set([...pendingSkipped.current, key])];
    storeProgress();

    try {
      await enqueue({ answers: {}, skipped: [key] });
      setNotice(t('page.skipSaved'));
    } catch {
      setNotice(t('page.skipKept'));
    }
  }

  async function flushPending() {
    await queue.current;

    const patch = styleProfileUpdateSchema.parse({
      answers: pendingAnswers.current,
      skipped: pendingSkipped.current,
    });

    await enqueue(patch);
  }

  function moveTo(nextStep: number) {
    storeProgress(nextStep);
    setStep(nextStep);
    setNotice('');
  }

  if (me.isPending || profile.isPending) return <Loading />;
  if (profile.error) return <ErrorNotice error={profile.error} />;
  if (!userId || !profile.data) return null;

  const section = styleQuestionSections[step]!;
  const answered = answeredStyleQuestionCount(answers);
  const sectionStart = styleQuestionSections
    .slice(0, step)
    .reduce((sum, item) => sum + item.questions.length, 0);

  return (
    <div className="style-survey-page">
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.surveyTitle')}
        description={t('page.surveyDescription')}
        action={
          <Button variant="outline" asChild>
            <Link to="/style">
              <ArrowLeft size={16} /> {t('page.backToProfile')}
            </Link>
          </Button>
        }
      />
      <div className="style-extension-note">
        <p>{t('summary.extensionNote')}</p>
        {interpretStyleProfile(answers).progress.extensionAnswered < 4 && (
          <Button variant="outline" size="sm" onClick={() => moveTo(0)}>
            {t('page.newQuestions')}
          </Button>
        )}
      </div>
      <div className="style-survey-progress">
        <div className="style-progress-copy">
          <span>
            {t('page.step', {
              current: step + 1,
              total: styleQuestionSections.length,
              section: t(`sections.${section.id}`),
            })}
          </span>
          <span>{t('page.answers', { answered, total: styleQuestionCount })}</span>
        </div>
        <progress
          value={step + 1}
          max={styleQuestionSections.length}
          aria-label={t('page.progress')}
        />
      </div>
      <section className="style-survey-section" aria-labelledby="style-section-title">
        <div className="style-section-heading">
          <span className="eyebrow">
            {t('page.questions', {
              start: sectionStart + 1,
              end: sectionStart + section.questions.length,
            })}
          </span>
          <h2 id="style-section-title">{t(`sections.${section.id}`)}</h2>
        </div>
        <div className="style-question-list">
          {section.questions.map((question, index) => {
            const key = question.key;

            return (
              <StyleQuestion
                key={question.key}
                question={question}
                number={sectionStart + index + 1}
                value={answers[key]}
                skipped={skipped.includes(key)}
                onAnswer={(answerKey, value) => void setAnswer(answerKey, value)}
                onSkip={(answerKey) => void skipQuestion(answerKey)}
              />
            );
          })}
        </div>
      </section>
      <div className="style-survey-footer">
        <Button variant="outline" disabled={step === 0} onClick={() => void moveTo(step - 1)}>
          <ArrowLeft size={16} /> {t('page.back')}
        </Button>
        <div className="style-save-state" role="status" aria-live="polite">
          {savingCount > 0
            ? t('page.saving')
            : saveError
              ? t('page.saveFailed')
              : notice || t('page.saved')}
        </div>
        {Boolean(saveError) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void flushPending().catch(() => undefined)}
          >
            {t('page.retry')}
          </Button>
        )}
        {step < styleQuestionSections.length - 1 ? (
          <Button onClick={() => void moveTo(step + 1)}>
            {t('page.next')} <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            onClick={() => {
              void (async () => {
                try {
                  if (Object.keys(pendingAnswers.current).length || pendingSkipped.current.length)
                    await flushPending();
                  else await queue.current;
                  await navigate({ to: '/style' });
                } catch {
                  setNotice(t('page.saveAllFailed'));
                }
              })();
            }}
          >
            <Check size={16} /> {t('page.save')}
          </Button>
        )}
      </div>
      {notice && Boolean(saveError) && (
        <p className="style-local-warning" role="alert">
          {notice}
        </p>
      )}
    </div>
  );
}
