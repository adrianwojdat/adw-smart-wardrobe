import { useTranslation } from 'react-i18next';

import {
  categories,
  categoryLabels,
  type CustomPropertyDefinition,
  type CustomPropertyValue,
  type Garment,
  type GarmentInput,
  occasionLabels,
  occasions,
  seasonLabels,
  seasons,
} from '@wardrobe/shared';

import { CustomPropertySection } from '../custom-properties/custom-property-fields';
import { InlineProperty } from '../custom-properties/inline-property';

type SuggestionKey =
  'brand' | 'primary_color' | 'secondary_color' | 'material' | 'pattern' | 'style' | 'subcategory';

const materialSources: Garment['material_source'][] = ['label', 'user', 'unknown'];
const thicknesses: Garment['thickness'][] = ['thin', 'medium', 'thick'];

function matchOption<T extends string>(options: readonly T[], value: string) {
  return options.find((option) => option === value);
}

function matchOptions<T extends string>(options: readonly T[], values: string | string[]) {
  if (!Array.isArray(values)) return undefined;

  const matched: T[] = [];

  for (const value of values) {
    const option = matchOption(options, value);

    if (!option) return undefined;
    matched.push(option);
  }

  return matched;
}

export function GarmentMetadata({
  garment,
  suggestionsFor,
  update,
  customProperties,
  customValues,
  customPropertiesReady,
  canEditCustomProperties,
  onCustomPropertiesChanged,
}: {
  garment: Garment;
  suggestionsFor: (key: SuggestionKey) => string[];
  update: (data: Partial<GarmentInput>) => Promise<boolean>;
  customProperties: CustomPropertyDefinition[];
  customValues: CustomPropertyValue[];
  customPropertiesReady: boolean;
  canEditCustomProperties: boolean;
  onCustomPropertiesChanged: () => Promise<void>;
}) {
  const { t } = useTranslation('garments');
  const { t: tc } = useTranslation('common');

  return (
    <>
      <dl className="metadata">
        <InlineProperty
          label={t('metadata.category')}
          value={garment.category}
          display={tc(`vocabulary.categories.${garment.category}`, {
            defaultValue: categoryLabels[garment.category],
          })}
          kind="select"
          options={categories.map((category) => ({
            value: category,
            label: tc(`vocabulary.categories.${category}`, {
              defaultValue: categoryLabels[category],
            }),
          }))}
          onSave={(value) => {
            const category = typeof value === 'string' ? matchOption(categories, value) : undefined;

            return category ? update({ category }) : false;
          }}
        />
        <InlineProperty
          label={t('metadata.subcategory')}
          value={garment.subcategory}
          display={garment.subcategory || t('metadata.unspecified')}
          kind="autocomplete"
          suggestions={suggestionsFor('subcategory')}
          onSave={(value) => update({ subcategory: String(value) })}
        />
        <InlineProperty
          label={t('metadata.primaryColor')}
          value={garment.primary_color}
          display={garment.primary_color || t('metadata.unspecified')}
          kind="autocomplete"
          suggestions={suggestionsFor('primary_color')}
          onSave={(value) => update({ primary_color: String(value) })}
        />
        <InlineProperty
          label={t('metadata.secondaryColor')}
          value={garment.secondary_color}
          display={garment.secondary_color || t('metadata.unspecified')}
          kind="autocomplete"
          suggestions={suggestionsFor('secondary_color')}
          onSave={(value) => update({ secondary_color: String(value) })}
        />
        <InlineProperty
          label={t('metadata.size')}
          value={garment.size}
          display={garment.size || t('metadata.unspecified')}
          onSave={(value) => update({ size: String(value) })}
        />
        <InlineProperty
          label={t('metadata.brand')}
          value={garment.brand}
          display={garment.brand || t('metadata.unspecified')}
          kind="autocomplete"
          suggestions={suggestionsFor('brand')}
          onSave={(value) => update({ brand: String(value) })}
        />
        <InlineProperty
          label={t('metadata.material')}
          value={garment.material}
          display={garment.material || t('metadata.unknownComposition')}
          kind="autocomplete"
          suggestions={suggestionsFor('material')}
          onSave={(value) => update({ material: String(value) })}
        />
        <InlineProperty
          label={t('metadata.pattern')}
          value={garment.pattern}
          display={garment.pattern || t('metadata.unspecified')}
          kind="autocomplete"
          suggestions={suggestionsFor('pattern')}
          onSave={(value) => update({ pattern: String(value) })}
        />
        <InlineProperty
          label={t('metadata.materialSource')}
          value={garment.material_source}
          display={tc(`vocabulary.materialSource.${garment.material_source}`)}
          kind="select"
          options={[
            { value: 'label', label: tc('vocabulary.materialSource.label') },
            { value: 'user', label: tc('vocabulary.materialSource.user') },
            { value: 'unknown', label: tc('vocabulary.materialSource.unknown') },
          ]}
          onSave={(value) => {
            const source =
              typeof value === 'string' ? matchOption(materialSources, value) : undefined;

            return source ? update({ material_source: source }) : false;
          }}
        />
        <InlineProperty
          label={t('metadata.thickness')}
          value={garment.thickness}
          display={tc(`vocabulary.thickness.${garment.thickness}`)}
          kind="select"
          options={[
            { value: 'thin', label: tc('vocabulary.thickness.thin') },
            { value: 'medium', label: tc('vocabulary.thickness.medium') },
            { value: 'thick', label: tc('vocabulary.thickness.thick') },
          ]}
          onSave={(value) => {
            const thickness =
              typeof value === 'string' ? matchOption(thicknesses, value) : undefined;

            return thickness ? update({ thickness }) : false;
          }}
        />
        {garment.category !== 'accessories' && (
          <InlineProperty
            label={t('metadata.warmth')}
            value={String(garment.warmth)}
            display={`${garment.warmth}/5`}
            kind="select"
            options={[1, 2, 3, 4, 5].map((value) => ({
              value: String(value),
              label: `${value}/5`,
            }))}
            onSave={(value) => update({ warmth: Number(value), warmth_manual: true })}
          />
        )}
        <InlineProperty
          label={t('metadata.seasons')}
          value={[...garment.seasons]}
          display={
            garment.seasons
              .map((season) =>
                tc(`vocabulary.seasons.${season}`, { defaultValue: seasonLabels[season] }),
              )
              .join(', ') || t('metadata.unspecified')
          }
          kind="multi"
          options={seasons.map((season) => ({
            value: season,
            label: tc(`vocabulary.seasons.${season}`, { defaultValue: seasonLabels[season] }),
          }))}
          onSave={(value) => {
            const selected = matchOptions(seasons, value);

            return selected ? update({ seasons: selected }) : false;
          }}
        />
        <InlineProperty
          label={t('metadata.style')}
          value={garment.style}
          display={garment.style || t('metadata.unspecified')}
          kind="autocomplete"
          suggestions={suggestionsFor('style')}
          onSave={(value) => update({ style: String(value) })}
        />
        <InlineProperty
          label={t('metadata.occasions')}
          value={[...garment.occasions]}
          display={
            garment.occasions
              .map((occasion) =>
                tc(`vocabulary.occasions.${occasion}`, { defaultValue: occasionLabels[occasion] }),
              )
              .join(', ') || t('metadata.any')
          }
          kind="multi"
          options={occasions.map((occasion) => ({
            value: occasion,
            label: tc(`vocabulary.occasions.${occasion}`, {
              defaultValue: occasionLabels[occasion],
            }),
          }))}
          onSave={(value) => {
            const selected = matchOptions(occasions, value);

            return selected ? update({ occasions: selected }) : false;
          }}
        />
        <InlineProperty
          label={t('metadata.notes')}
          value={garment.notes}
          display={garment.notes || t('metadata.addNote')}
          onSave={(value) => update({ notes: String(value) })}
        />
      </dl>
      <p className="source-note">
        {t('metadata.materialDisclaimer')}{' '}
        {garment.material_source === 'label'
          ? t('metadata.labelSource')
          : garment.material_source === 'user'
            ? t('metadata.userSource')
            : t('metadata.unknownSource')}
        .
      </p>
      {customPropertiesReady && (
        <CustomPropertySection
          wardrobeId={garment.wardrobe_id}
          garmentId={garment.id}
          definitions={customProperties}
          values={customValues}
          canEdit={canEditCustomProperties}
          onChanged={onCustomPropertiesChanged}
        />
      )}
      <div className="tags">
        {garment.style && <span>{garment.style}</span>}
        {garment.occasions.map((occasion) => (
          <span key={occasion}>{occasionLabels[occasion]}</span>
        ))}
      </div>
    </>
  );
}
