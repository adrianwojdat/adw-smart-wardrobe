import { LoaderCircle, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type GarmentImage, imageSchema, type Job, jobSchema } from '@wardrobe/shared';

import { ErrorNotice } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { api, request } from '../../../lib/api/client';

import { ImageAnalysisDetails } from './image-analysis';

function orientationReason(value: unknown) {
  if (typeof value !== 'object' || value === null || !('reason' in value)) return '';

  return typeof value.reason === 'string' ? value.reason : '';
}

export function GarmentProcessing({
  image,
  jobs,
  manualAnalysis,
  aiActive,
  activityError,
  activityPending,
  busy,
  setBusy,
  refetchImage,
  refetchJobs,
  refetchActivity,
  onError,
  notify,
}: {
  image: GarmentImage;
  jobs: Job[];
  manualAnalysis: boolean;
  aiActive: boolean;
  activityError: unknown;
  activityPending: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  refetchImage: () => Promise<unknown>;
  refetchJobs: () => Promise<unknown>;
  refetchActivity: () => Promise<unknown>;
  onError: (error: unknown) => void;
  notify: (message: string) => void;
}) {
  const { t } = useTranslation('imageAnalysis');

  async function reprocessImage() {
    setBusy(true);

    try {
      await request(`/api/images/${image.id}/reprocess`, imageSchema, 'POST', {});
      await refetchImage();
      await refetchJobs();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function analyzeImage() {
    setBusy(true);

    try {
      await request(`/api/images/${image.id}/analyze`, jobSchema, 'POST', {});
      await Promise.all([refetchJobs(), refetchActivity()]);
      notify(t('page.aiRunning'));
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(jobId: string) {
    try {
      await api.retry(jobId);
      await refetchJobs();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <details className="processing-details">
      <summary>{t('page.processingDetails')}</summary>
      <div className="processing-details-content">
        <p role="status" className="source-note">
          {image.process_status === 'completed'
            ? t('page.completed')
            : image.process_status === 'failed'
              ? t('page.failed')
              : image.process_status === 'queued'
                ? t('page.queued')
                : t('page.pending')}
          {image.pipeline_version ? ' · ' + image.pipeline_version : ''}
        </p>
        {!!image.processing_error && (
          <p role="alert" className="source-note">
            {t('page.processingFailed')}
          </p>
        )}
        {!image.catalog_path && image.kind === 'garment' && (
          <p className="source-note">{t('page.originalUntilReady')}</p>
        )}
        {image.process_status === 'completed' && Boolean(image.orientation) && (
          <p className="source-note">{orientationReason(image.orientation)}</p>
        )}
        {aiActive && (
          <p role="status" className="source-note">
            <LoaderCircle size={14} className="inline animate-spin mr-2" />
            {t('page.aiRunning')}
          </p>
        )}
        {Boolean(activityError) && <ErrorNotice error={activityError} />}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || ['queued', 'processing'].includes(image.process_status)}
            onClick={() => void reprocessImage()}
          >
            {['queued', 'processing'].includes(image.process_status) ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> {t('page.processingPhoto')}
              </>
            ) : (
              t('page.reprocess')
            )}
          </Button>
          {manualAnalysis && (
            <Button
              variant="outline"
              size="sm"
              disabled={
                busy ||
                aiActive ||
                activityPending ||
                !!activityError ||
                jobs.some(
                  (job) =>
                    job.image_id === image.id &&
                    job.type !== 'process_image' &&
                    ['queued', 'processing'].includes(job.status),
                )
              }
              onClick={() => void analyzeImage()}
            >
              {aiActive ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" /> {t('page.aiWorking')}
                </>
              ) : (
                t('page.reanalyze')
              )}
            </Button>
          )}
        </div>
        {jobs.length > 0 && (
          <div className="jobs-panel">
            <h3>{t('page.jobsTitle')}</h3>
            {jobs.map((job) => (
              <div key={job.id}>
                <span>
                  {['queued', 'processing'].includes(job.status) && (
                    <LoaderCircle size={14} className="inline animate-spin mr-2" />
                  )}
                  {job.type === 'process_image'
                    ? t('page.imageProcessing')
                    : job.type === 'analyze_label'
                      ? t('page.labelOcr')
                      : t('page.analysis')}{' '}
                  ·{' '}
                  {
                    {
                      queued: t('page.queued'),
                      processing: t('page.processing'),
                      completed: t('page.completed'),
                      failed: t('page.failed'),
                      cancelled: t('page.cancelled'),
                    }[job.status]
                  }{' '}
                  · {job.progress}%
                </span>
                {job.error && <span className="source-note">{t('page.jobFailed')}</span>}
                {job.status === 'failed' && (
                  <button
                    type="button"
                    aria-label={t('page.retryJob')}
                    onClick={() => void retryJob(job.id)}
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <ImageAnalysisDetails image={image} />
      </div>
    </details>
  );
}
