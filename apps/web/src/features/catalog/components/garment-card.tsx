import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Heart, Shirt } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  categoryLabels,
  cleanlinessLabels,
  type Garment,
  getStylingReadiness,
} from '@wardrobe/shared';

import { useWardrobe } from '../../../app/providers/context';
import { api, imageUrl } from '../../../lib/api/client';
import { userErrorMessage } from '../../../lib/api/user-error';

export function GarmentPhoto({
  garment,
  className = '',
}: {
  garment: Garment;
  className?: string;
}) {
  const { t } = useTranslation('catalog');
  const img = garment.garment_images.find((image) => image.kind === 'garment');

  return img ? (
    <img
      className={'garment-photo ' + className}
      src={imageUrl(img)}
      alt={garment.name}
      loading="lazy"
    />
  ) : (
    <div className={'photo-placeholder ' + className}>
      <Shirt size={50} strokeWidth={0.7} />
      <span>{t('page.addPhoto')}</span>
    </div>
  );
}

type CatalogNavigation = {
  ids: string[];
  search: {
    q?: string;
    category?: string;
    favorite?: 'true' | 'false';
    archived?: 'true' | 'false';
    sort?: 'newest' | 'name';
  };
};

export function GarmentCard({
  garment,
  navigation,
}: {
  garment: Garment;
  navigation?: CatalogNavigation;
}) {
  const { t } = useTranslation(['catalog', 'common']);
  const cache = useQueryClient();
  const { notify } = useWardrobe();
  const [busy, setBusy] = useState(false);
  const readiness = getStylingReadiness(garment);
  const detailSearch = navigation ? { ...navigation.search, ids: navigation.ids } : undefined;

  async function toggleFavorite() {
    setBusy(true);

    try {
      await api.updateGarment(garment.id, { favorite: !garment.favorite });
      await cache.invalidateQueries({ queryKey: ['garments'] });
    } catch (error) {
      notify(userErrorMessage(error, (key) => t(key, { ns: 'common' })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="garment-card card">
      <Link
        to="/garments/$id"
        params={{ id: garment.id }}
        search={detailSearch}
        className="garment-card-link"
        aria-label={t('page.openGarment', { name: garment.name })}
      >
        <div className="garment-image-link">
          <GarmentPhoto garment={garment} />
          <span className="garment-image-badges">
            <span
              className={
                'status-badge badge ' +
                (garment.archived ? 'status-archived' : 'status-' + garment.cleanliness)
              }
            >
              {garment.archived
                ? t('vocabulary.archived', { ns: 'common' })
                : t(`vocabulary.cleanliness.${garment.cleanliness}`, {
                    ns: 'common',
                    defaultValue: cleanlinessLabels[garment.cleanliness],
                  })}
            </span>
            <span
              className={
                'readiness-badge badge ' + (readiness.ready ? 'badge-success' : 'badge-warning')
              }
              data-ready={readiness.ready}
            >
              {readiness.ready
                ? t('page.ready')
                : t('page.missingDetails', {
                    fields: readiness.missing
                      .map((field) => t(`vocabulary.readinessFields.${field}`, { ns: 'common' }))
                      .join(', '),
                  })}
            </span>
          </span>
        </div>
        <div className="garment-card-info">
          <div>
            <span>
              {t(`vocabulary.categories.${garment.category}`, {
                ns: 'common',
                defaultValue: categoryLabels[garment.category],
              })}
            </span>
            <h3>{garment.name}</h3>
            <p>
              {garment.brand || t('page.collectionFallback')}
              {garment.size ? ' · ' + garment.size : ''}
            </p>
          </div>
          <ArrowUpRight size={18} />
        </div>
      </Link>
      <button
        disabled={busy}
        className={'favorite-button ' + (garment.favorite ? 'is-favorite' : '')}
        aria-label={garment.favorite ? t('page.removeFavorite') : t('page.addFavorite')}
        onClick={() => void toggleFavorite()}
      >
        <Heart size={18} fill={garment.favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
