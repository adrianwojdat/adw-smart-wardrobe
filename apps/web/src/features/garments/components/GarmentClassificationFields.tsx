import { useTranslation } from 'react-i18next';

import { occasionLabels, occasions, seasonLabels, seasons } from '@wardrobe/shared';

import type { GarmentFormMethods } from '../lib/garment-form-types';

export function GarmentClassificationFields({ form }: { form: GarmentFormMethods }) {
  const { t } = useTranslation('garments');
  const { t: tc } = useTranslation('common');

  return (
    <>
      <fieldset>
        <legend>{t('form.seasons')}</legend>
        <div className="check-chips">
          {seasons.map((s) => (
            <label key={s}>
              <input type="checkbox" value={s} {...form.register('seasons')} className="checkbox" />
              <span>{tc(`vocabulary.seasons.${s}`, { defaultValue: seasonLabels[s] })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        {t('form.style')}
        <input
          {...form.register('style')}
          placeholder={t('form.stylePlaceholder')}
          className="input input-bordered h-[45px] px-[14px]"
        />
      </label>
      <fieldset>
        <legend>{t('form.occasions')}</legend>
        <div className="check-chips">
          {occasions.map((o) => (
            <label key={o}>
              <input
                type="checkbox"
                value={o}
                {...form.register('occasions')}
                className="checkbox"
              />
              <span>{tc(`vocabulary.occasions.${o}`, { defaultValue: occasionLabels[o] })}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
