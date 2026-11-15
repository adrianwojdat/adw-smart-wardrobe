import { ArrowUpRight, Luggage, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type PackingList, packingProgress } from '@wardrobe/shared';

import { ErrorNotice } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';

export function SavedPackingLists({
  lists,
  loading,
  error,
  onRetry,
  onOpen,
  onDelete,
}: {
  lists: PackingList[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onOpen: (list: PackingList) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation('travelPacking');

  return (
    <section className="grid gap-5" aria-label={t('saved')}>
      <p className="text-sm text-base-content/60">{t('savedDescription')}</p>
      {loading && <p role="status">{t('loading')}</p>}
      {!!error && (
        <>
          <ErrorNotice error={error} />
          <Button variant="outline" onClick={onRetry}>
            {t('retryLoad')}
          </Button>
        </>
      )}
      {!loading && !error && !lists.length && (
        <div className="empty-state card">
          <Luggage size={36} className="mx-auto text-primary" />
          <h2>{t('noLists')}</h2>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lists.map((list) => {
          const progress = packingProgress(list.items);

          return (
            <article
              key={list.id}
              className="card bg-base-100 border border-base-300 p-6 gap-4 shadow-sm"
            >
              <div className="flex justify-between items-start gap-3">
                <span className="rounded-full bg-base-200 p-3 text-primary">
                  <Luggage size={22} />
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('delete')}
                  onClick={() => onDelete(list.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <button
                className="text-left text-xl font-semibold hover:text-primary break-words"
                onClick={() => onOpen(list)}
              >
                {list.name}
              </button>
              <p className="text-sm text-base-content/60">
                {list.trip.destination} · {t('daysSummary', { count: list.trip.days })} ·{' '}
                {t('itemsSummary', { count: list.items.length })}
              </p>
              <progress
                className="progress progress-primary w-full"
                aria-label={t('progressLabel')}
                value={progress.packed}
                max={progress.total || 1}
              />
              <p className="text-xs text-base-content/60">
                {t('progress', { packed: progress.packed, total: progress.total })}
              </p>
              <Button
                variant="outline"
                onClick={() => onOpen(list)}
                className="w-full justify-between"
              >
                {t('openList')}
                <ArrowUpRight size={16} />
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
