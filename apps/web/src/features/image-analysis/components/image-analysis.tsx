import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  aiAnalysisSchema,
  aiValueLabel,
  type GarmentImage,
  garmentSchema,
  localizeAnalysis,
} from '@wardrobe/shared';

import { ErrorNotice, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { request } from '../../../lib/api/client';

const labelKeys: Record<string, string> = {
  name: 'name',
  pattern: 'pattern',
  category: 'category',
  subcategory: 'subcategory',
  primary_color: 'color',
  secondary_color: 'secondaryColors',
  brand: 'brand',
  size: 'size',
  material: 'material',
  material_source: 'materialSource',
  seasons: 'seasons',
  style: 'style',
  occasions: 'occasions',
  thickness: 'thickness',
  warmth: 'warmth',
};

export function ImageAnalysis({
  image,
  garmentId,
  runId = 'initial',
}: {
  image: GarmentImage;
  garmentId: string;
  runId?: string;
}) {
  const { t } = useTranslation('imageAnalysis');
  const { t: common } = useTranslation('common');

  function localizedValue(field: string, value: unknown): string {
    if (Array.isArray(value)) return value.map((item) => localizedValue(field, item)).join(', ');

    const domains: Record<string, string> = {
      category: 'categories',
      seasons: 'seasons',
      occasions: 'occasions',
      thickness: 'thickness',
      material_source: 'materialSource',
    };

    return domains[field]
      ? common(`vocabulary.${domains[field]}.${String(value)}`, {
          defaultValue: aiValueLabel(field, value),
        })
      : aiValueLabel(field, value);
  }

  const parsed = aiAnalysisSchema.safeParse(image.analysis);
  const result = parsed.success ? localizeAnalysis(parsed.data) : undefined;
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const cache = useQueryClient();
  const { notify } = useWardrobe();
  const reviewKey = result
    ? `sw-ai-review:${image.id}:${runId}:${fingerprint(JSON.stringify(result.suggestions))}`
    : '';
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(reviewKey) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDismissed(() => {
      try {
        return JSON.parse(sessionStorage.getItem(reviewKey) ?? '[]') as string[];
      } catch {
        return [];
      }
    });
    setExpanded(false);
  }, [reviewKey]);

  const pending = result
    ? Object.entries(result.suggestions).filter(([field]) => !dismissed.includes(field))
    : [];

  if (!result || result.auto_applied || !Object.keys(result.suggestions).length || !pending.length)
    return null;

  function remember(fields: string[]) {
    const next = [...new Set([...dismissed, ...fields])];

    try {
      sessionStorage.setItem(reviewKey, JSON.stringify(next));
    } catch {
      // The dismissal still applies for the current view when storage is unavailable.
    }

    setDismissed(next);
    setSelected((current) => current.filter((field) => !fields.includes(field)));
  }

  return (
    <details
      className="ai-suggestions"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        {result.source === 'label' ? t('page.labelReading') : t('page.suggestions')} ·{' '}
        {t('page.reviewCount', { count: pending.length })}
      </summary>
      <div className="ai-suggestions-content">
        <p className="source-note">
          {result.classifier
            ? t('page.classifierInfo')
            : t('page.confidence', { percent: Math.round(result.confidence * 100) })}{' '}
          {t('page.selectedWillReplace')}
        </p>
        {result.uncertainties.map((text, i) => (
          <p key={i} className="source-note">
            {t('page.verify', { text })}
          </p>
        ))}
        {pending.map(([field, value]) => (
          <label key={field} className="ai-suggestion-row">
            <input
              type="checkbox"
              checked={selected.includes(field)}
              onChange={(e) =>
                setSelected((current) =>
                  e.target.checked ? [...current, field] : current.filter((k) => k !== field),
                )
              }
              className="checkbox"
            />
            <span>
              {t(`page.${labelKeys[field] ?? field}`, { defaultValue: field })}:{' '}
              {localizedValue(field, value)}
            </span>
          </label>
        ))}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            size="sm"
            disabled={busy || !selected.length}
            onClick={async () => {
              setBusy(true);

              try {
                await request(`/api/images/${image.id}/suggestions/apply`, garmentSchema, 'POST', {
                  fields: selected,
                });
                await cache.invalidateQueries({ queryKey: ['garment', garmentId] });
                await cache.invalidateQueries({ queryKey: ['garments'] });
                remember(selected);
                notify(t('page.applied'));
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('page.apply')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !selected.length}
            onClick={() => remember(selected)}
          >
            {t('page.rejectSelected')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => remember(pending.map(([field]) => field))}
          >
            {t('page.rejectRest')}
          </Button>
        </div>
        {!!error && <ErrorNotice error={error} />}
      </div>
    </details>
  );
}

export { ImageAnalysisDetails } from './image-analysis-details';

function fingerprint(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);

  return (hash >>> 0).toString(36);
}
