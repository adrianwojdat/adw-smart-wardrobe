import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Heart,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Tag,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  cleanliness,
  cleanlinessLabels,
  type GarmentInput,
  getStylingReadiness,
  wearConditionLabels,
  wearConditions,
} from '@wardrobe/shared';

import { ErrorNotice, Loading, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { api, ApiError, imageUrl, request } from '../../../lib/api/client';

import { GarmentPhoto } from '../../catalog';
import { useAnalysisActivity } from '../../image-analysis';
import { ImageAnalysis } from '../../image-analysis';
import { GarmentProcessing } from '../../image-analysis';

import { GarmentMetadata } from '../components/garment-metadata';
import { GarmentOutfits } from '../components/garment-outfits';
import { InlineProperty, uniquePropertyValues } from '../custom-properties/inline-property';
import { InlineEditContext, useInlineEditCoordinatorState } from '../hooks/inline-edit-coordinator';
import { useGarmentRotation } from '../hooks/use-garment-rotation';

type GarmentNavigationSearch = {
  ids?: string[];
  q?: string;
  category?: string;
  favorite?: 'true' | 'false';
  archived?: 'true' | 'false';
  sort?: 'newest' | 'name';
};

export function GarmentDetail({
  id,
  navigationSearch = {},
}: {
  id: string;
  navigationSearch?: GarmentNavigationSearch;
}) {
  const { t } = useTranslation('garments');
  const { t: tc, i18n } = useTranslation('common');
  const activity = useAnalysisActivity();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false });
  const capabilities = useQuery({
    queryKey: ['analysis-capabilities'],
    queryFn: () => request('/api/config', z.object({ manualAnalysis: z.boolean().optional() })),
  });
  const query = useQuery({
    queryKey: ['garment', id],
    queryFn: () => api.garment(id),
    refetchInterval: 3000,
  });
  const wardrobeGarments = useQuery({
    queryKey: ['garments', query.data?.wardrobe_id, false],
    queryFn: () => api.garments(query.data!.wardrobe_id, false),
    enabled: !!query.data,
  });
  const archivedWardrobeGarments = useQuery({
    queryKey: ['garments', query.data?.wardrobe_id, true],
    queryFn: () => api.garments(query.data!.wardrobe_id, true),
    enabled: !!query.data,
  });
  const customProperties = useQuery({
    queryKey: ['custom-properties', query.data?.wardrobe_id],
    queryFn: () => api.customProperties(query.data!.wardrobe_id),
    enabled: !!query.data,
  });
  const customValues = useQuery({
    queryKey: ['custom-property-values', id],
    queryFn: () => api.customPropertyValues(id),
    enabled: !!query.data,
  });
  const members = useQuery({
    queryKey: ['members', query.data?.wardrobe_id],
    queryFn: () => api.members(query.data!.wardrobe_id),
    enabled: !!query.data,
  });
  const jobs = useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.jobs(id),
    refetchInterval: 3000,
  });
  const history = useQuery({
    queryKey: ['history', id],
    queryFn: () =>
      request(
        `/api/garments/${id}/history`,
        z.array(z.object({ id: z.string(), worn_on: z.string() })),
      ),
  });
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useWardrobe();
  const [activeImage, setActiveImage] = useState('');
  const [variant, setVariant] = useState<'catalog' | 'original' | 'cutout'>('catalog');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const { context: inlineEditContext, commitActive: commitActiveInlineEditor } =
    useInlineEditCoordinatorState();
  const garment = query.data;
  const wardrobeValues = [
    ...(wardrobeGarments.data ?? []),
    ...(archivedWardrobeGarments.data ?? []),
  ];
  const suggestionsFor = (
    key:
      | 'brand'
      | 'primary_color'
      | 'secondary_color'
      | 'material'
      | 'pattern'
      | 'style'
      | 'subcategory',
  ) =>
    uniquePropertyValues(
      wardrobeValues.map((item) => item[key]),
      i18n.language === 'pl' ? 'pl-PL' : 'en-US',
    );
  const canEditCustomProperties = !!members.data?.some(
    (member) =>
      member.user_id === me.data?.id && (member.role === 'owner' || member.role === 'editor'),
  );
  const photo = garment
    ? (garment.garment_images.find((i) => i.id === activeImage) ??
      garment.garment_images.find((i) => i.kind === 'garment') ??
      garment.garment_images[0])
    : undefined;
  const rotation = useGarmentRotation({
    photo,
    garmentId: id,
    cache,
    refetchGarment: query.refetch,
    setError,
  });
  const recommendations = useQuery({
    queryKey: ['detail-outfits', id, garment?.wardrobe_id],
    queryFn: api.outfits,
    enabled: !!garment,
  });

  async function update(data: Partial<GarmentInput>) {
    setBusy(true);
    setError(undefined);

    try {
      await api.updateGarment(id, data);
      await cache.invalidateQueries({ queryKey: ['garment', id] });
      await cache.invalidateQueries({ queryKey: ['garments'] });

      return true;
    } catch (e) {
      setError(e);

      return false;
    } finally {
      setBusy(false);
    }
  }

  if (query.isPending) return <Loading />;

  if (query.error) {
    const deleted = query.error instanceof ApiError && query.error.status === 404;

    return (
      <section className="deleted-garment-state">
        <h1>{deleted ? t('detail.deletedTitle') : t('detail.loadErrorTitle')}</h1>
        <p>{deleted ? t('detail.deletedDescription') : t('detail.loadErrorDescription')}</p>
        {!deleted && <ErrorNotice error={query.error} />}
        <Button asChild variant="outline">
          <Link to="/wardrobe" search={{ ...navigationSearch, ids: undefined }}>
            <ArrowLeft size={16} /> {t('form.back')}
          </Link>
        </Button>
      </section>
    );
  }

  if (!garment) return null;

  const wardrobeOrder = [
    ...(wardrobeGarments.data ?? []),
    ...(archivedWardrobeGarments.data ?? []),
  ];
  const navigationIds = navigationSearch.ids?.length
    ? navigationSearch.ids
    : wardrobeOrder
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((item) => item.id);
  const currentNavigationIndex = navigationIds.indexOf(id);
  const previousGarmentId =
    currentNavigationIndex > 0 ? navigationIds[currentNavigationIndex - 1] : undefined;
  const nextGarmentId =
    currentNavigationIndex >= 0 && currentNavigationIndex < navigationIds.length - 1
      ? navigationIds[currentNavigationIndex + 1]
      : undefined;
  const navigateToGarment = async (targetId: string, ids = navigationIds) => {
    await navigate({
      to: '/garments/$id',
      params: { id: targetId },
      search: { ...navigationSearch, ids },
      resetScroll: false,
    });
  };

  const readiness = getStylingReadiness(garment);
  const {
    activePreview: activeRotationPreview,
    previewDelta,
    state: rotationState,
    requestRotation,
  } = rotation;
  const aiActive = (activity.data ?? []).some(
    (a) => a.image_id === photo?.id && a.queued + a.processing > 0,
  );
  const suggestions =
    recommendations.data
      ?.filter((o) => o.wardrobe_id === garment?.wardrobe_id && o.garment_ids.includes(id))
      .slice(0, 3) ?? [];

  return (
    <InlineEditContext.Provider value={inlineEditContext}>
      <>
        <div className="detail-top">
          <Link
            to="/wardrobe"
            search={{ ...navigationSearch, ids: undefined }}
            className="back-link"
            data-inline-edit-action
            onClick={(event) => {
              event.preventDefault();
              void commitActiveInlineEditor().then((saved) => {
                if (saved)
                  void navigate({
                    to: '/wardrobe',
                    search: { ...navigationSearch, ids: undefined },
                    resetScroll: false,
                  });
              });
            }}
          >
            <ArrowLeft size={17} /> {tc('shell.yourWardrobe')}
          </Link>
          <div className="detail-heading">
            <span className="eyebrow">{garment.brand || t('detail.collection')}</span>
            <InlineProperty
              heading
              label={t('detail.name')}
              value={garment.name}
              display={garment.name}
              onSave={(v) => update({ name: String(v) })}
            />
          </div>
          <div className="detail-actions flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/garments/$id/edit"
                params={{ id }}
                data-inline-edit-action
                onClick={(event) => {
                  event.preventDefault();
                  void commitActiveInlineEditor().then((saved) => {
                    if (saved) void navigate({ to: '/garments/$id/edit', params: { id } });
                  });
                }}
              >
                <Pencil size={15} />
                {tc('actions.edit')}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={t('detail.favorite')}
              data-inline-edit-action
              onClick={() => {
                void commitActiveInlineEditor().then((saved) => {
                  if (saved) void update({ favorite: !garment.favorite });
                });
              }}
            >
              <Heart size={20} fill={garment.favorite ? 'currentColor' : 'none'} />
            </Button>
          </div>
        </div>
        <nav className="garment-neighbor-nav" aria-label={t('detail.navigation')}>
          <Button
            variant="outline"
            disabled={!previousGarmentId}
            data-inline-edit-action
            onClick={() => {
              if (!previousGarmentId) return;
              void commitActiveInlineEditor().then((saved) => {
                if (saved) void navigateToGarment(previousGarmentId);
              });
            }}
          >
            <ArrowLeft size={16} /> {t('detail.previous')}
          </Button>
          <span>
            {currentNavigationIndex >= 0
              ? `${currentNavigationIndex + 1} z ${navigationIds.length}`
              : ''}
          </span>
          <Button
            variant="outline"
            disabled={!nextGarmentId}
            data-inline-edit-action
            onClick={() => {
              if (!nextGarmentId) return;
              void commitActiveInlineEditor().then((saved) => {
                if (saved) void navigateToGarment(nextGarmentId);
              });
            }}
          >
            {t('detail.next')} <ArrowRight size={16} />
          </Button>
        </nav>
        <div className="detail-layout">
          <section className="detail-photo-column">
            <div className={'detail-photo ' + (variant === 'cutout' ? 'transparent-preview' : '')}>
              {photo ? (
                <img
                  src={imageUrl(photo, variant)}
                  alt={photo.kind === 'label' ? t('form.labelAlt') : garment.name}
                  style={previewDelta ? { transform: `rotate(${previewDelta}deg)` } : undefined}
                />
              ) : (
                <GarmentPhoto garment={garment} />
              )}
              <span className="garment-image-badges">
                <span
                  className={
                    'status-badge badge ' +
                    (garment.archived ? 'status-archived' : 'status-' + garment.cleanliness)
                  }
                >
                  {garment.archived
                    ? tc('vocabulary.archived')
                    : tc(`vocabulary.cleanliness.${garment.cleanliness}`, {
                        defaultValue: cleanlinessLabels[garment.cleanliness],
                      })}
                </span>
                <span
                  className={
                    'readiness-badge badge ' + (readiness.ready ? 'badge-success' : 'badge-warning')
                  }
                  data-ready={readiness.ready}
                >
                  {readiness.ready
                    ? t('detail.ready')
                    : t('detail.missingFields', {
                        fields: readiness.missing
                          .map((field) => tc(`vocabulary.readinessFields.${field}`))
                          .join(', '),
                      })}
                </span>
              </span>
            </div>
            {photo?.kind === 'garment' && (
              <div className="rotation-controls" aria-label={t('detail.rotate')}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestRotation('left')}
                  aria-label={t('detail.rotateLeft')}
                >
                  <RotateCcw size={15} /> {t('detail.rotateLeftShort')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestRotation('right')}
                  aria-label={t('detail.rotateRight')}
                >
                  <RotateCw size={15} /> {t('detail.rotateRightShort')}
                </Button>
                <span className="rotation-state" role="status">
                  {rotationState === 'waiting'
                    ? t('detail.rotationPending')
                    : rotationState === 'saving'
                      ? t('detail.rotationSaving')
                      : rotationState === 'processing'
                        ? t('detail.rotationProcessing')
                        : rotationState === 'failed'
                          ? photo.process_status === 'failed'
                            ? t('detail.rotationFailed')
                            : t('detail.rotationFailed')
                          : ''}
                </span>
                {rotationState === 'failed' && activeRotationPreview && (
                  <Button variant="outline" size="sm" onClick={rotation.retry}>
                    {photo.process_status === 'failed' ? tc('actions.retry') : tc('actions.retry')}
                  </Button>
                )}
              </div>
            )}
            {photo && (
              <>
                <div className="filter-tabs" aria-label={t('detail.photoVersion')}>
                  {(['catalog', 'original', 'cutout'] as const).map((v) => (
                    <button
                      key={v}
                      disabled={v === 'cutout' && !photo.cutout_path}
                      className={variant === v ? 'selected' : ''}
                      onClick={() => setVariant(v)}
                    >
                      {v === 'catalog'
                        ? t('detail.catalog')
                        : v === 'original'
                          ? t('detail.original')
                          : t('detail.cutout')}
                    </button>
                  ))}
                </div>
                <GarmentProcessing
                  image={photo}
                  jobs={jobs.data ?? []}
                  manualAnalysis={Boolean(capabilities.data?.manualAnalysis)}
                  aiActive={aiActive}
                  activityError={activity.error}
                  activityPending={activity.isPending}
                  busy={busy}
                  setBusy={setBusy}
                  refetchImage={() => query.refetch()}
                  refetchJobs={() => jobs.refetch()}
                  refetchActivity={() => activity.refetch()}
                  onError={setError}
                  notify={notify}
                />
              </>
            )}
            {photo && !jobs.isPending && (
              <ImageAnalysis
                key={photo.id}
                image={photo}
                garmentId={id}
                runId={
                  jobs.data?.find(
                    (job) =>
                      job.image_id === photo.id &&
                      job.type !== 'process_image' &&
                      job.status === 'completed',
                  )?.id
                }
              />
            )}
            <div className="thumbnail-row">
              {garment.garment_images.map((i) => (
                <button
                  key={i.id}
                  className={i.id === photo?.id ? 'selected' : ''}
                  onClick={() => {
                    setActiveImage(i.id);
                    setVariant(i.kind === 'label' ? 'original' : 'catalog');
                  }}
                  aria-label={
                    i.kind === 'label' ? t('detail.showLabel') : t('detail.showGarmentPhoto')
                  }
                >
                  <img src={imageUrl(i)} alt="" />
                  {i.kind === 'label' && <Tag size={13} />}
                </button>
              ))}
              <Link
                to="/garments/$id/edit"
                params={{ id }}
                className="add-photo"
                aria-label={t('detail.addPhoto')}
              >
                <Plus />
              </Link>
            </div>
          </section>
          <section className="detail-properties">
            <GarmentMetadata
              garment={garment}
              suggestionsFor={suggestionsFor}
              update={update}
              customProperties={customProperties.data ?? []}
              customValues={customValues.data ?? []}
              customPropertiesReady={Boolean(customProperties.data && customValues.data)}
              canEditCustomProperties={canEditCustomProperties}
              onCustomPropertiesChanged={async () => {
                await Promise.all([
                  cache.invalidateQueries({ queryKey: ['custom-properties', garment.wardrobe_id] }),
                  cache.invalidateQueries({ queryKey: ['custom-property-values', garment.id] }),
                ]);
              }}
            />
            <label className="mt-4">
              {t('detail.cleanlinessLabel')}
              <DropdownSelect
                disabled={busy}
                value={garment.cleanliness}
                onChange={(event) => {
                  const value = cleanliness.find((item) => item === event.currentTarget.value);

                  if (value) void update({ cleanliness: value });
                }}
                className="select select-bordered h-[45px] px-[14px]"
              >
                {cleanliness.map((s) => (
                  <option key={s} value={s}>
                    {tc(`vocabulary.cleanliness.${s}`, { defaultValue: cleanlinessLabels[s] })}
                  </option>
                ))}
              </DropdownSelect>
            </label>
            <label className="mt-3">
              {t('detail.wearCondition')}
              <DropdownSelect
                disabled={busy}
                value={garment.wear_condition}
                onChange={(event) => {
                  const value = wearConditions.find((item) => item === event.currentTarget.value);

                  if (value) void update({ wear_condition: value });
                }}
                className="select select-bordered h-[45px] px-[14px]"
              >
                {wearConditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {tc(`vocabulary.wearCondition.${condition}`, {
                      defaultValue: wearConditionLabels[condition],
                    })}
                  </option>
                ))}
              </DropdownSelect>
            </label>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  try {
                    await request(
                      `/api/garments/${id}/wear`,
                      z.object({ ok: z.boolean() }),
                      'POST',
                      {
                        worn_on: new Date().toLocaleDateString('sv-SE'),
                      },
                    );
                    await cache.invalidateQueries({ queryKey: ['history', id] });
                    await cache.invalidateQueries({ queryKey: ['garment', id] });
                    await cache.invalidateQueries({ queryKey: ['garments'] });
                    notify(t('detail.wearSaved'));
                  } catch (e) {
                    setError(e);
                  }
                })();
              }}
            >
              <CalendarDays size={17} />
              {t('detail.wearingToday')}
            </Button>
            {history.data && (
              <p className="source-note">
                {t('detail.wearHistory', { count: history.data.length })}
                {history.data[0]
                  ? ' · ' +
                    t('detail.lastWorn', {
                      date: new Intl.DateTimeFormat(
                        i18n.language === 'pl' ? 'pl-PL' : 'en-US',
                      ).format(new Date(history.data[0].worn_on)),
                    })
                  : ''}
              </p>
            )}
            {!!error && <ErrorNotice error={error} />}
            <div className="detail-tools">
              <Button
                variant="ghost"
                size="sm"
                data-inline-edit-action
                onClick={() => {
                  void commitActiveInlineEditor().then((saved) => {
                    if (saved) void update({ archived: !garment.archived });
                  });
                }}
              >
                <Archive size={15} />
                {garment.archived ? t('detail.restore') : t('detail.archive')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-inline-edit-action
                onClick={() => {
                  void commitActiveInlineEditor().then((saved) => {
                    if (saved) setRemoveOpen(true);
                  });
                }}
              >
                <Trash2 size={15} />
                {tc('actions.deleteGarment')}
              </Button>
            </div>
          </section>
        </div>
        <GarmentOutfits
          pending={recommendations.isPending}
          outfits={suggestions}
          garments={wardrobeGarments.data ?? []}
          onOpenGarment={(targetId) => {
            void commitActiveInlineEditor().then((saved) => {
              if (saved) void navigateToGarment(targetId);
            });
          }}
        />
        <Dialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          title={t('detail.deleteTitle')}
          description={t('detail.deleteDescription')}
        >
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              {tc('actions.keep')}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);

                  try {
                    await api.deleteGarment(id);
                    await cache.invalidateQueries({ queryKey: ['garments'] });

                    const remainingIds = navigationIds.filter((garmentId) => garmentId !== id);
                    const destination = nextGarmentId ?? previousGarmentId;

                    if (destination) await navigateToGarment(destination, remainingIds);
                    else
                      await navigate({
                        to: '/wardrobe',
                        search: { ...navigationSearch, ids: undefined },
                      });
                  } catch (e) {
                    setError(e);
                    setRemoveOpen(false);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {t('detail.deletePermanently')}
            </Button>
          </div>
        </Dialog>
      </>
    </InlineEditContext.Provider>
  );
}
