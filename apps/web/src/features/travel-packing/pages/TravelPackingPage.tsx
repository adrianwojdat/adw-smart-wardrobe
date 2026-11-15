import { useState } from 'react';
import { FolderHeart, Plane, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { packingProgress } from '@wardrobe/shared';

import { ErrorNotice, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';

import { PageHeading } from '../../catalog';

import { PackingChecklist } from '../components/PackingChecklist';
import { SavedPackingLists } from '../components/SavedPackingLists';
import { TripForm } from '../components/TripForm';
import { usePackingList } from '../hooks/usePackingList';
import { changePackingReuse, createCustomPackingItem } from '../lib/packing-utils';

export function TravelPackingPage() {
  const { t } = useTranslation('travelPacking');
  const { wardrobe } = useWardrobe();
  const state = usePackingList();
  const [view, setView] = useState<'plan' | 'saved'>('plan');
  const [custom, setCustom] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const { list, setList } = state;
  const progress = packingProgress(list?.items ?? []);
  const error =
    state.generate.error ||
    state.poll.error ||
    state.save.error ||
    state.remove.error ||
    state.recommendations.error ||
    state.cancel.error;

  return (
    <div className="grid gap-6 pb-8 [&>.page-heading]:mb-0">
      <PageHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        action={
          <Button
            variant="outline"
            disabled={!!state.task}
            onClick={() => {
              state.startNew();
              setView('plan');
            }}
          >
            <Plus size={16} />
            {t('newTrip')}
          </Button>
        }
      />
      <div className="filter-tabs !my-0" role="group" aria-label={t('title')}>
        <button
          className={(view === 'plan' ? 'selected ' : '') + '!inline-flex items-center gap-2'}
          aria-pressed={view === 'plan'}
          onClick={() => setView('plan')}
        >
          <Plane size={16} />
          {t('plan')}
        </button>
        <button
          className={(view === 'saved' ? 'selected ' : '') + '!inline-flex items-center gap-2'}
          aria-pressed={view === 'saved'}
          onClick={() => setView('saved')}
        >
          <FolderHeart size={16} />
          {t('saved')}
          {!!state.lists.data?.length && (
            <span className="badge badge-sm">{state.lists.data.length}</span>
          )}
        </button>
      </div>
      {!!error && <ErrorNotice error={error} />}
      {view === 'plan' &&
        !list &&
        (wardrobe ? (
          <TripForm
            key={wardrobe.id}
            wardrobeId={wardrobe.id}
            busy={!!state.task || state.generate.isPending}
            onGenerate={(v) => state.generate.mutate(v)}
          />
        ) : (
          <p>{t('noWardrobe')}</p>
        ))}
      {state.task && (
        <div role="status">
          {t(`status.${state.status ?? 'queued'}`)}
          <button
            className="btn"
            disabled={state.cancel.isPending}
            onClick={() => state.cancel.mutate()}
          >
            {t('cancel')}
          </button>
        </div>
      )}
      {!state.task && (state.status === 'failed' || state.status === 'cancelled') && (
        <p role="alert">
          {t(`status.${state.status}`)} {t('retry')}
        </p>
      )}
      {view === 'saved' && (
        <SavedPackingLists
          lists={state.lists.data ?? []}
          loading={state.lists.isPending}
          error={state.lists.error}
          onRetry={() => void state.lists.refetch()}
          onOpen={(next) => {
            setList(next);
            setView('plan');
          }}
          onDelete={setDeleteId}
        />
      )}
      {deleteId && (
        <div className="alert flex flex-wrap" role="alert">
          <p>{t('confirmDelete')}</p>
          <button
            className="btn btn-error"
            onClick={() => {
              state.remove.mutate(deleteId);
              setDeleteId('');
            }}
          >
            {t('delete')}
          </button>
          <button className="btn" onClick={() => setDeleteId('')}>
            {t('cancel')}
          </button>
        </div>
      )}
      {view === 'plan' && list && (
        <section className="grid gap-5 rounded-xl border border-base-300 bg-base-100 p-4 sm:p-7">
          <label className="grid gap-2 text-xs font-medium">
            {t('listName')}
            <input
              className="input input-bordered w-full"
              maxLength={160}
              value={list.name}
              onChange={(e) => setList({ ...list, name: e.target.value })}
            />
          </label>
          <p>{t('progress', { packed: progress.packed, total: progress.total })}</p>
          <progress
            className="progress progress-primary w-full"
            aria-label={t('progressLabel')}
            value={progress.packed}
            max={progress.total || 1}
          />
          <label className="flex gap-2">
            <input
              className="checkbox"
              type="checkbox"
              checked={list.allow_reuse}
              onChange={(e) => setList(changePackingReuse(list, e.target.checked))}
            />
            {t('allowReuse')}
          </label>
          {state.recommendations.isFetching && <p role="status">{t('loading')}</p>}
          {state.recommendations.data?.wardrobe_count === 0 && <p>{t('noGarments')}</p>}
          {list.items.some((item) => item.generation_source === 'fallback') && (
            <p role="status" className="alert">
              {t('fallbackNotice')}
            </p>
          )}
          <PackingChecklist
            list={list}
            recommendations={state.recommendations.data?.items ?? {}}
            onChange={setList}
          />
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!custom.trim()) return;
              setList({ ...list, items: [...list.items, createCustomPackingItem(custom)] });
              setCustom('');
            }}
          >
            <label>
              {t('custom')}
              <input
                className="input input-bordered"
                value={custom}
                maxLength={120}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
            <button className="btn" disabled={list.items.length >= 80}>
              {t('add')}
            </button>
          </form>
          <Button
            disabled={state.save.isPending || !list.name.trim() || !list.items.length}
            onClick={() => state.save.mutate(list)}
          >
            {state.save.isPending ? t('saving') : t('save')}
          </Button>
          {state.save.isSuccess && <p role="status">{t('savedNotice')}</p>}
        </section>
      )}
    </div>
  );
}
