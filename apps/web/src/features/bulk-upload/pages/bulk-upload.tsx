import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { GarmentImage } from '@wardrobe/shared';

import { useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api/client';

import { PageHeading } from '../../catalog';

import { type Entry, useBatch } from '../hooks/bulk-upload-context';
import { BATCH_LIMIT, fileError } from '../lib/bulk-queue';

export { BulkUploadProvider } from '../hooks/bulk-upload-context';

export function BulkUploadPage() {
  const { t } = useTranslation('bulkUpload');
  const batch = useBatch();
  const { wardrobe, create } = useWardrobe();
  const [error, setError] = useState('');
  const uploaded = batch.entries.filter((e) => e.state === 'uploaded');
  // One paginated catalog query, rather than 200 individual polling requests.
  const status = useQuery({
    queryKey: ['bulk-images', uploaded.map((e) => e.id).join(',')],
    queryFn: async () => {
      const wardrobeIds = [...new Set(uploaded.map((e) => e.wardrobeId))];
      const result = await Promise.all(wardrobeIds.map((id) => api.garments(id)));

      return new Map(result.flat().map((g) => [g.id, g.garment_images]));
    },
    enabled: uploaded.length > 0,
    refetchInterval: 10000,
  });
  const image = (entry: Entry): GarmentImage | undefined =>
    status.data?.get(entry.id)?.find((i) => i.id === entry.imageId);
  const completed = uploaded.filter((e) => image(e)?.process_status === 'completed').length;
  const failedProcessing = uploaded.filter((e) =>
    ['failed', 'cancelled'].includes(image(e)?.process_status ?? ''),
  ).length;

  function select(files: File[]) {
    if (!wardrobe) return;

    if (batch.entries.length + files.length > BATCH_LIMIT) {
      setError(t('page.maxLimit'));

      return;
    }

    setError('');
    batch.add(files, wardrobe.id);
  }

  return (
    <>
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={t('page.description')}
      />
      {!wardrobe ? (
        <Button onClick={create}>{t('page.createWardrobe')}</Button>
      ) : (
        <section className="form-panel card bg-base-100">
          <p>
            {t('page.wardrobe')}: <strong>{wardrobe.name}</strong>. {t('page.limits')}
          </p>
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!batch.busy) select(Array.from(e.dataTransfer.files));
            }}
          >
            <Upload size={30} />
            <strong>{t('page.drop')}</strong>
            <span>{t('page.concurrency')}</span>
            <input
              type="file"
              multiple
              disabled={batch.busy}
              accept="image/jpeg,image/png,image/webp"
              aria-label={t('page.inputLabel')}
              onChange={(e) => {
                select(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </label>
          <p>{t('page.keepOpen')}</p>
        </section>
      )}
      {error && (
        <p role="alert" className="error-notice">
          {error}
        </p>
      )}
      {batch.entries.length > 0 && (
        <section className="form-panel card bg-base-100">
          <h2>{t('page.progress')}</h2>
          <p role="status" aria-live="polite">
            {t('page.progressSummary', {
              total: batch.entries.length,
              uploaded: uploaded.length,
              processing: uploaded.length - completed - failedProcessing,
              completed,
              failed: batch.entries.filter((e) => e.state === 'failed').length + failedProcessing,
            })}
          </p>
          <progress
            className="bulk-progress"
            max={batch.entries.length}
            value={uploaded.length}
            aria-label={t('page.progressLabel')}
          />
          <p>{t('page.readyMeaning')}</p>
          {status.error && <p role="alert">{t('page.statusUnavailable')}</p>}
          <ul className="bulk-list">
            {batch.entries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.file.name}</strong>
                  <p>
                    {entry.state === 'uploaded'
                      ? image(entry)?.process_status === 'completed'
                        ? t('page.stateCompleted')
                        : image(entry)?.process_status === 'failed'
                          ? t('page.stateProcessingFailed')
                          : t('page.stateProcessing')
                      : t(`page.state${entry.state[0]?.toUpperCase()}${entry.state.slice(1)}`)}
                  </p>
                  {entry.error && <p role="alert">{t(`page.${entry.error}`)}</p>}
                  {image(entry)?.processing_error && <p>{t('page.stateProcessingFailed')}</p>}
                </div>
                {entry.state === 'uploaded' && (
                  <Link to="/garments/$id" params={{ id: entry.id }}>
                    {t('page.openGarment')}
                  </Link>
                )}
                {entry.state === 'failed' && !fileError(entry.file) && (
                  <Button disabled={batch.busy} onClick={() => batch.retry(entry.id)}>
                    {t('page.retry')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button variant="outline" disabled={batch.busy} onClick={batch.clear}>
            {t('page.clear')}
          </Button>
          <p>{t('page.clearDescription')}</p>
        </section>
      )}
    </>
  );
}
