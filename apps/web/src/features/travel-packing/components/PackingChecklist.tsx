import { useTranslation } from 'react-i18next';

import {
  type Garment,
  identifyPackingKey,
  packingCatalog,
  type PackingItem,
  type PackingList,
} from '@wardrobe/shared';

import { PackingListItem } from './PackingListItem';

const sections = [
  'underwear',
  'clothes',
  'footwear',
  'accessories',
  'hygiene',
  'electronics',
  'documents',
  'health',
  'travel',
] as const;

function sectionFor(item: PackingItem) {
  const key = item.packing_key ?? identifyPackingKey(item.name);
  const group = item.packing_group ?? (key ? packingCatalog[key].group : undefined);

  if (group === 'socks' || group === 'underwear') return 'underwear';
  if (group && ['tops', 'bottoms', 'layers', 'sleepwear'].includes(group)) return 'clothes';
  if (group) return group;

  return (
    {
      tops: 'clothes',
      bottoms: 'clothes',
      dresses: 'clothes',
      outerwear: 'clothes',
      shoes: 'footwear',
      accessories: 'accessories',
      underwear: 'underwear',
      toiletries: 'hygiene',
      documents: 'documents',
      electronics: 'electronics',
      other: 'travel',
    } as const
  )[item.category];
}

export function PackingChecklist({
  list,
  recommendations,
  onChange,
}: {
  list: PackingList;
  recommendations: Record<string, Garment[]>;
  onChange: (list: PackingList) => void;
}) {
  const { t } = useTranslation('travelPacking');

  return (
    <div className="grid gap-8">
      {sections.map((section) => {
        const items = list.items.filter((item) => sectionFor(item) === section);

        if (!items.length) return null;

        return (
          <section key={section} className="grid gap-3" aria-label={t(`sections.${section}`)}>
            <h2 className="text-lg font-semibold border-b border-base-300 pb-2">
              {t(`sections.${section}`)}
            </h2>
            {items.map((item) => (
              <PackingListItem
                key={item.id}
                item={item}
                candidates={recommendations[item.id] ?? []}
                used={
                  new Set(list.items.filter((i) => i.id !== item.id).flatMap((i) => i.assigned))
                }
                allowReuse={list.allow_reuse}
                onChange={(next) =>
                  onChange({ ...list, items: list.items.map((i) => (i.id === next.id ? next : i)) })
                }
                onRemove={() =>
                  onChange({ ...list, items: list.items.filter((i) => i.id !== item.id) })
                }
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
