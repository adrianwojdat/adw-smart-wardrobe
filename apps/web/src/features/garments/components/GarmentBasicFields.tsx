import { useTranslation } from 'react-i18next';

import { categories, categoryLabels, type Garment, type GarmentInput } from '@wardrobe/shared';

import { DropdownSelect } from '../../../components/ui/dropdown-select';

import type { GarmentFormMethods } from '../lib/garment-form-types';

type GarmentBasicFieldsProps = {
  form: GarmentFormMethods;
  existing?: Garment;
  wardrobes: { id: string; name: string }[];
  category: GarmentInput['category'] | undefined;
  onManualWarmth: () => void;
};

export function GarmentBasicFields({
  form,
  existing,
  wardrobes,
  category,
  onManualWarmth,
}: GarmentBasicFieldsProps) {
  const { t: tg } = useTranslation('garments');
  const { t: tc } = useTranslation('common');
  const { setValue } = form;

  return (
    <>
      <h2>{tg('form.about')}</h2>
      <label>
        {tg('form.name')}
        <input
          {...form.register('name')}
          placeholder={tg('form.namePlaceholder')}
          className="input input-bordered h-[45px] px-[14px]"
        />
        {form.formState.errors.name && (
          <span className="field-error">{tg('form.nameRequired')}</span>
        )}
      </label>
      <div className="form-row">
        <label>
          {tg('form.category')}
          <DropdownSelect
            {...form.register('category')}
            className="select select-bordered h-[45px] px-[14px]"
          >
            {categories.map((c) => (
              <option value={c} key={c}>
                {tc(`vocabulary.categories.${c}`, { defaultValue: categoryLabels[c] })}
              </option>
            ))}
          </DropdownSelect>
        </label>
        <label>
          {tg('form.subcategory')}
          <input
            {...form.register('subcategory')}
            placeholder={tg('form.subcategoryPlaceholder')}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </label>
      </div>
      <label>
        {tg('form.wardrobe')}
        <DropdownSelect
          {...form.register('wardrobe_id')}
          disabled={!!existing?.garment_images.length}
          className="select select-bordered h-[45px] px-[14px]"
        >
          {wardrobes.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </DropdownSelect>
        {existing?.garment_images.length ? <small>{tg('form.moveUnavailable')}</small> : null}
      </label>
      <div className="form-row">
        <label>
          {tg('form.brand')}
          <input
            {...form.register('brand')}
            placeholder={tg('form.brandPlaceholder')}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </label>
        <label>
          {tg('form.size')}
          <input
            {...form.register('size')}
            placeholder={tg('form.sizePlaceholder')}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          {tg('form.primaryColor')}
          <input
            {...form.register('primary_color')}
            placeholder={tg('form.primaryColorPlaceholder')}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </label>
        <label>
          {tg('form.secondaryColor')}
          <input
            {...form.register('secondary_color')}
            placeholder={tg('form.secondaryColorPlaceholder')}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </label>
      </div>
      <label>
        {tg('form.pattern')}
        <input
          {...form.register('pattern')}
          placeholder={tg('form.patternPlaceholder')}
          className="input input-bordered h-[45px] px-[14px]"
        />
      </label>
      <label>
        {tg('form.material')}
        <textarea
          {...form.register('material')}
          rows={2}
          placeholder={tg('form.materialPlaceholder')}
          className="textarea textarea-bordered"
        />
      </label>
      <label>
        {tg('form.materialSource')}
        <DropdownSelect
          {...form.register('material_source')}
          className="select select-bordered h-[45px] px-[14px]"
        >
          <option value="unknown">{tc('vocabulary.materialSource.unknown')}</option>
          <option value="user">{tc('vocabulary.materialSource.user')}</option>
          <option value="label">{tc('vocabulary.materialSource.label')}</option>
        </DropdownSelect>
      </label>
      <div className="form-row">
        <label>
          {tg('form.thickness')}
          <DropdownSelect
            {...form.register('thickness')}
            className="select select-bordered h-[45px] px-[14px]"
          >
            <option value="thin">{tc('vocabulary.thickness.thin')}</option>
            <option value="medium">{tc('vocabulary.thickness.medium')}</option>
            <option value="thick">{tc('vocabulary.thickness.thick')}</option>
          </DropdownSelect>
        </label>
        <label>
          {category === 'accessories' ? tg('form.warmthAccessory') : tg('form.warmth')}
          <input
            type="number"
            min={1}
            max={5}
            disabled={category === 'accessories'}
            {...form.register('warmth', {
              valueAsNumber: true,
              onChange: () => {
                onManualWarmth();
                setValue('warmth_manual', true, { shouldDirty: true });
              },
            })}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </label>
      </div>
    </>
  );
}
