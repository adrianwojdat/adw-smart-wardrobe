import { packingAiItemSchema, type PackingItem, type PackingList } from '@wardrobe/shared';

export function createCustomPackingItem(name: string): PackingItem {
  const item = packingAiItemSchema.parse({
    category: 'other',
    name,
    quantity: 1,
    description: '',
    weather_dependent: false,
    match_wardrobe: false,
    subcategory: '',
    seasons: [],
    warmth: null,
    material: '',
    style: '',
    occasion: '',
  });

  return { ...item, id: crypto.randomUUID(), assigned: [], packed: 0 };
}

export function changePackingReuse(list: PackingList, allowReuse: boolean): PackingList {
  const seen = new Set<string>();

  return {
    ...list,
    allow_reuse: allowReuse,
    items: list.items.map((item) => ({
      ...item,
      assigned: item.assigned.filter((id) => {
        if (allowReuse) return true;
        if (seen.has(id)) return false;
        seen.add(id);

        return true;
      }),
    })),
  };
}
