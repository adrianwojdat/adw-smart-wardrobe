import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  type Garment,
  type PackingItem,
  packingShortage,
  resizePackingItem,
} from '@wardrobe/shared';

import { imageUrl } from '../../../lib/api/client';

export function PackingListItem({
  item,
  candidates,
  used,
  allowReuse,
  onChange,
  onRemove,
}: {
  item: PackingItem;
  candidates: Garment[];
  used: Set<string>;
  allowReuse: boolean;
  onChange: (item: PackingItem) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('travelPacking');
  const change = (patch: Partial<PackingItem>) => onChange({ ...item, ...patch });

  return (
    <article className="card bg-base-100 p-4 gap-3 border border-base-300">
      <div className="grid gap-4">
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            className="checkbox"
            checked={item.packed === item.quantity}
            onChange={(e) => change({ packed: e.target.checked ? item.quantity : 0 })}
          />
          <strong>{item.name}</strong>
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-3 items-end">
          <button
            type="button"
            className="btn btn-sm"
            aria-label={t('decrease', { name: item.name })}
            onClick={() => onChange(resizePackingItem(item, item.quantity - 1))}
          >
            −
          </button>
          <label className="grid gap-1 text-sm font-medium">
            {t('quantity')}
            <input
              className="input input-bordered w-20"
              type="number"
              min={1}
              max={365}
              value={item.quantity}
              onChange={(e) => onChange(resizePackingItem(item, Number(e.target.value)))}
            />
          </label>
          <button
            type="button"
            className="btn btn-sm"
            aria-label={t('increase', { name: item.name })}
            onClick={() => onChange(resizePackingItem(item, item.quantity + 1))}
          >
            +
          </button>
          <label className="grid gap-1 text-sm font-medium">
            {t('packed')}
            <input
              className="input input-bordered w-20"
              type="number"
              min={0}
              max={item.quantity}
              value={item.packed}
              onChange={(e) =>
                change({
                  packed: Math.max(
                    0,
                    Math.min(item.quantity, Math.trunc(Number(e.target.value)) || 0),
                  ),
                })
              }
            />
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>
            {t('remove')}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.packing_group && (
          <span className="badge badge-ghost">{t(`categories.${item.packing_group}`)}</span>
        )}
        {item.optional && <span className="badge badge-outline">{t('optional')}</span>}
      </div>
      <p>{item.description}</p>
      {item.weather_dependent && (
        <p className="badge badge-outline h-auto min-h-6 whitespace-normal">{t('conditional')}</p>
      )}
      {item.match_wardrobe && (
        <>
          <p>
            {t('assigned', { count: item.assigned.length })} ·{' '}
            {t('missing', { count: packingShortage(item) })}
          </p>
          <details>
            <summary className="cursor-pointer">{t('recommendations')}</summary>
            {candidates.length === 0 && <p>{t('noMatches')}</p>}
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {candidates.map((g) => {
                const selected = item.assigned.includes(g.id);
                const blocked =
                  !selected &&
                  (item.assigned.length >= item.quantity || (!allowReuse && used.has(g.id)));
                const img = g.garment_images.find((i) => i.kind === 'garment');

                return (
                  <div
                    key={g.id}
                    className="flex gap-3 items-center p-2 border border-base-300 rounded-box"
                  >
                    {img && (
                      <img
                        src={imageUrl(img, 'thumbnail')}
                        alt={g.name}
                        className="w-14 h-16 object-contain"
                        loading="lazy"
                      />
                    )}
                    <label className="flex gap-2 items-center">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selected}
                        disabled={blocked}
                        onChange={() =>
                          change({
                            assigned: selected
                              ? item.assigned.filter((id) => id !== g.id)
                              : [...item.assigned, g.id],
                          })
                        }
                      />
                      {g.name}
                    </label>
                    <span>{t(`cleanliness.${g.cleanliness}`)}</span>
                    <Link to="/garments/$id" params={{ id: g.id }}>
                      {t('details')}
                    </Link>
                  </div>
                );
              })}
            </div>
          </details>
          {item.assigned
            .filter((id) => !candidates.some((g) => g.id === id))
            .map((id) => (
              <div key={id}>
                {t('unavailable')}{' '}
                <button
                  className="btn btn-sm"
                  onClick={() => change({ assigned: item.assigned.filter((v) => v !== id) })}
                >
                  {t('unassign')}
                </button>
              </div>
            ))}
        </>
      )}
    </article>
  );
}
