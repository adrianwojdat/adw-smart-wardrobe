import { useTranslation } from 'react-i18next';

import { aiAnalysisSchema, type GarmentImage, localizeAnalysis } from '@wardrobe/shared';

export function ImageAnalysisDetails({ image }: { image: GarmentImage }) {
  const { t } = useTranslation('imageAnalysis');
  const parsed = aiAnalysisSchema.safeParse(image.analysis);

  if (!parsed.success) return null;

  const result = localizeAnalysis(parsed.data);

  return (
    <div className="analysis-processing-info">
      {result.classifier && (
        <>
          <p className="source-note">
            {t('page.model')}: {result.classifier.model} · CPU ·{' '}
            {(result.classifier.elapsed_ms / 1000).toFixed(1)} s
          </p>
          {result.classifier.category.map((c) => (
            <p key={c.label} className="source-note">
              {t('page.categoryResult', { label: c.label_pl, score: c.score.toFixed(3) })}
            </p>
          ))}
        </>
      )}
      {result.text && (
        <p className="source-note whitespace-pre-wrap">
          {t('page.labelText', { text: result.text })}
        </p>
      )}
      {result.care?.map((care, i) => (
        <p key={i} className="source-note">
          {t('page.care', { text: care })}
        </p>
      ))}
    </div>
  );
}
