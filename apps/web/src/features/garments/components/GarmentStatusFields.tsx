import { useTranslation } from 'react-i18next';

import { cleanliness, cleanlinessLabels } from '@wardrobe/shared';

import { DropdownSelect } from '../../../components/ui/dropdown-select';

import type { GarmentFormMethods } from '../lib/garment-form-types';

export function GarmentStatusFields({ form }: { form: GarmentFormMethods }) {
  const { t } = useTranslation('garments');
  const { t: tc } = useTranslation('common');

  return (
    <>
      <label>
        {t('form.cleanliness')}
        <DropdownSelect
          {...form.register('cleanliness')}
          className="select select-bordered h-[45px] px-[14px]"
        >
          {cleanliness.map((s) => (
            <option value={s} key={s}>
              {tc(`vocabulary.cleanliness.${s}`, { defaultValue: cleanlinessLabels[s] })}
            </option>
          ))}
        </DropdownSelect>
      </label>
      <label>
        {t('metadata.notes')}
        <textarea
          {...form.register('notes')}
          rows={3}
          placeholder={t('form.notesPlaceholder')}
          className="textarea textarea-bordered"
        />
      </label>
    </>
  );
}
