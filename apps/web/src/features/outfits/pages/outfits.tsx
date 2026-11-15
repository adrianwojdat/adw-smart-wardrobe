import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Heart, LoaderCircle, Sparkles, Thermometer, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  type Garment,
  type GeminiOutfit,
  occasionLabels,
  occasions,
  type OutfitInput,
} from '@wardrobe/shared';

import { Empty, ErrorNotice, Loading, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { api, request } from '../../../lib/api/client';

import { GarmentPhoto, PageHeading, useGarments } from '../../catalog';

export function OutfitPage({ saved = false }: { saved?: boolean }) {
  const { t, i18n } = useTranslation('outfits');
  const { t: tc } = useTranslation('common');
  const { wardrobe, notify } = useWardrobe();
  const garments = useGarments();
  const cache = useQueryClient();
  const [occasion, setOccasion] = useState<OutfitInput['occasion']>('everyday');
  const [temperature, setTemperature] = useState(18);
  const [weather, setWeather] = useState('');
  const [requirements, setRequirements] = useState('');
  const [count, setCount] = useState(4);
  const [taskId, setTaskId] = useState<string>();
  const [acknowledgedMissing, setAcknowledgedMissing] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const savedQuery = useQuery({ queryKey: ['outfits'], queryFn: api.outfits, enabled: saved });
  const taskQuery = useQuery({
    queryKey: ['gemini-outfit-task', taskId],
    queryFn: () => api.geminiTask(taskId!),
    enabled: !saved && !!taskId,
    refetchInterval: (query) =>
      ['queued', 'running', 'retrying'].includes(query.state.data?.status ?? '') ? 1200 : false,
  });
  const running = ['queued', 'running', 'retrying'].includes(taskQuery.data?.status ?? '');
  const taskActive = running || (!!taskId && taskQuery.isPending);
  const generated: GeminiOutfit[] =
    taskQuery.data?.status === 'completed' ? (taskQuery.data.result?.outfits ?? []) : [];

  async function generate() {
    if (!wardrobe) return;
    if (busy || running) return;
    setBusy(true);
    setError(undefined);
    setTaskId(undefined);
    setAcknowledgedMissing({});

    try {
      const task = await api.recommendations({
        wardrobe_id: wardrobe.id,
        occasion,
        temperature,
        weather: weather || undefined,
        requirements: requirements || undefined,
        count,
        language: i18n.resolvedLanguage === 'pl' ? 'pl' : 'en',
      });

      setTaskId(task.id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const displayOutfits = generated.map((outfit) => ({
    ...outfit,
    occasion,
    garments: outfit.garment_ids
      .map((id) => garments.data?.find((g) => g.id === id))
      .filter((g): g is Garment => !!g),
  }));
  const outfits = saved
    ? (savedQuery.data ?? [])
        .filter((o) => o.wardrobe_id === wardrobe?.id)
        .map((o) => ({
          id: o.id,
          name: o.name,
          occasion: o.occasion,
          garment_ids: o.garment_ids,
          rationale: o.rationale,
          wearing_tips: o.wearing_tips,
          missing_items: o.missing_items,
          garments: o.garment_ids
            .map((id) => garments.data?.find((g) => g.id === id))
            .filter((g): g is Garment => !!g),
        }))
    : displayOutfits.filter(
        (o) =>
          o.garments.length === o.garment_ids.length &&
          o.garments.every((g) => g.wardrobe_id === wardrobe?.id),
      );

  return (
    <>
      <PageHeading
        eyebrow={saved ? t('page.savedEyebrow') : t('page.eyebrow')}
        title={saved ? t('page.savedTitle') : t('page.title')}
        description={saved ? t('page.savedDescription') : t('page.description')}
        action={
          saved ? (
            <Button asChild>
              <Link to="/outfits">
                <Sparkles size={17} />
                {t('page.findNew')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!saved && (
        <section className="outfit-controls">
          <span className="eyebrow">{t('page.plans')}</span>
          <div className="filter-tabs">
            {occasions.map((o) => (
              <button
                key={o}
                className={o === occasion ? 'selected' : ''}
                disabled={busy || taskActive}
                onClick={() => {
                  setOccasion(o);
                  setTaskId(undefined);
                }}
              >
                {tc(`vocabulary.occasions.${o}`, { defaultValue: occasionLabels[o] })}
              </button>
            ))}
          </div>
          <div className="outfit-input-grid">
            <label className="temperature-label">
              <span>
                <Thermometer size={16} />
                {t('page.temperature')}
              </span>
              <input
                type="number"
                min={-40}
                max={55}
                disabled={busy || taskActive}
                value={temperature}
                onChange={(e) => {
                  setTemperature(Number(e.target.value));
                  setTaskId(undefined);
                }}
                className="input input-bordered h-[45px] px-[14px]"
              />
            </label>
            <label className="temperature-label">
              <span>{t('page.weather')}</span>
              <input
                disabled={busy || taskActive}
                maxLength={140}
                value={weather}
                placeholder={t('page.weatherPlaceholder')}
                onChange={(e) => {
                  setWeather(e.target.value);
                  setTaskId(undefined);
                }}
                className="input input-bordered h-[45px] px-[14px]"
              />
            </label>
            <label className="temperature-label">
              <span>{t('page.count')}</span>
              <DropdownSelect
                disabled={busy || taskActive}
                value={count}
                onChange={(e) => {
                  setCount(Number(e.target.value));
                  setTaskId(undefined);
                }}
                className="select select-bordered h-[45px] px-[14px]"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </DropdownSelect>
            </label>
          </div>
          <label className="temperature-label outfit-requirements">
            <span>{t('page.requirements')}</span>
            <textarea
              disabled={busy || taskActive}
              maxLength={500}
              rows={2}
              value={requirements}
              placeholder={t('page.requirementsPlaceholder')}
              onChange={(e) => {
                setRequirements(e.target.value);
                setTaskId(undefined);
              }}
              className="textarea textarea-bordered"
            />
          </label>
          <div className="outfit-generate-actions">
            <Button disabled={!wardrobe || busy || taskActive} onClick={() => void generate()}>
              <Sparkles size={17} />
              {busy || running ? t('page.generating') : t('page.generate')}
            </Button>
            {running && taskId && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await api.cancelGeminiTask(taskId);
                    await taskQuery.refetch();
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                {t('page.cancel')}
              </Button>
            )}
          </div>
          {taskId && running && (
            <p role="status" className="source-note">
              <LoaderCircle size={15} className="inline animate-spin" />{' '}
              {taskQuery.data?.status === 'queued'
                ? t('page.queued')
                : taskQuery.data?.status === 'retrying'
                  ? t('page.retrying')
                  : t('page.running')}
            </p>
          )}
          {taskQuery.data?.status === 'failed' && (
            <p role="alert" className="source-note">
              {t('page.failed')}
            </p>
          )}
          {taskQuery.data?.status === 'cancelled' && (
            <p role="status" className="source-note">
              {t('page.cancelled')}
            </p>
          )}
          <p className="source-note">{t('page.availability')}</p>
        </section>
      )}
      {!!error && <ErrorNotice error={error} />}{' '}
      {taskQuery.error && <ErrorNotice error={taskQuery.error} />}{' '}
      {savedQuery.error && saved && <ErrorNotice error={savedQuery.error} />}{' '}
      {busy || running || (saved && savedQuery.isPending) ? (
        <Loading />
      ) : outfits.length ? (
        <div className="outfit-grid">
          {outfits.map((o) => (
            <article className="outfit-card card w-full" key={o.id}>
              <div className="outfit-collage">
                {o.garments.map((g) => (
                  <Link to="/garments/$id" params={{ id: g.id }} key={g.id}>
                    <GarmentPhoto garment={g} />
                  </Link>
                ))}
              </div>
              <div className="p-5">
                <span className="eyebrow">
                  {tc(`vocabulary.occasions.${o.occasion}`, {
                    defaultValue: occasionLabels[o.occasion],
                  })}
                </span>
                <h2>{o.name}</h2>
                {!o.garments.some((g) => g.category === 'shoes') && <p>{t('page.partial')}</p>}
                <p>{o.garments.map((g) => g.name).join(' + ') || t('page.removedGarments')}</p>
                {o.rationale && <p>{o.rationale}</p>}
                {o.wearing_tips && <p className="text-muted">{o.wearing_tips}</p>}
                {o.missing_items.length > 0 && (
                  <div className="rounded-xl border border-dashed p-4 mt-4">
                    <h3 className="font-medium">{t('page.missingTitle')}</h3>
                    {o.missing_items.map((missing, index) => (
                      <div key={`${missing.category}-${index}`} className="py-2">
                        <p>{missing.description}</p>
                        {!acknowledgedMissing[`${o.id}-${index}`] ? (
                          <>
                            <p>
                              {missing.category === 'shoes'
                                ? t('page.missingQuestionShoes')
                                : t('page.missingQuestionGarments')}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link to="/garments/new">
                                  {missing.category === 'shoes'
                                    ? t('page.addShoes')
                                    : t('page.addGarment')}
                                </Link>
                              </Button>
                              {(['similar', 'dontHave', 'skip'] as const).map((choice) => (
                                <Button
                                  key={choice}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setAcknowledgedMissing((current) => ({
                                      ...current,
                                      [`${o.id}-${index}`]: t(`page.${choice}`),
                                    }))
                                  }
                                >
                                  {choice}
                                </Button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-muted">
                            {t('page.answer', { value: acknowledgedMissing[`${o.id}-${index}`] })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  className="outfit-card-action"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      if (saved) {
                        await request(
                          '/api/outfits/' + o.id,
                          z.object({ ok: z.boolean() }),
                          'DELETE',
                        );
                        notify(t('page.savedRemoved'));
                      } else {
                        await api.saveOutfit({
                          wardrobe_id: wardrobe!.id,
                          name: o.name,
                          occasion: o.occasion,
                          temperature,
                          garment_ids: o.garments.map((g) => g.id),
                          rationale: o.rationale ?? undefined,
                          wearing_tips: o.wearing_tips ?? undefined,
                          missing_items: o.missing_items,
                        });
                        notify(t('page.outfitSaved'));
                      }

                      await cache.invalidateQueries({ queryKey: ['outfits'] });
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  {saved ? <Trash2 size={16} /> : <Heart size={16} />}{' '}
                  {saved ? t('page.removeOutfit') : t('page.saveOutfit')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : saved || taskQuery.data?.status === 'completed' ? (
        <Empty
          title={saved ? t('page.savedEmptyTitle') : t('page.noMatchTitle')}
          description={saved ? t('page.savedEmptyDescription') : t('page.noMatchDescription')}
          action={
            saved ? (
              <Button variant="outline" asChild>
                <Link to="/outfits">
                  {t('page.discover')} <ArrowUpRight size={16} />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/wardrobe">{t('page.checkCategories')}</Link>
              </Button>
            )
          }
        />
      ) : null}
    </>
  );
}
