import { Link } from '@tanstack/react-router';
import { CalendarDays, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type Garment, occasionLabels, type Outfit } from '@wardrobe/shared';

import { Loading } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';

import { GarmentPhoto } from '../../catalog';

type GarmentOutfitsProps = {
  pending: boolean;
  outfits: Outfit[];
  garments: Garment[];
  onOpenGarment: (id: string) => void;
};

export function GarmentOutfits({ pending, outfits, garments, onOpenGarment }: GarmentOutfitsProps) {
  const { t } = useTranslation('garments');
  const { t: tc } = useTranslation('common');

  return (
    <section className="detail-outfits">
      <span className="eyebrow">{t('outfits.eyebrow')}</span>
      <h2>{t('outfits.title')}</h2>
      <p className="text-muted mb-6">{t('outfits.description')}</p>
      {pending ? (
        <Loading />
      ) : outfits.length ? (
        <div className="outfit-suggestions">
          {outfits.map((outfit) => (
            <article className="outfit-card card w-full" key={outfit.id}>
              <div className="outfit-collage">
                {outfit.garment_ids
                  .map((garmentId) => garments.find((garment) => garment.id === garmentId))
                  .filter((garment): garment is Garment => !!garment)
                  .map((garment) => (
                    <Link
                      key={garment.id}
                      to="/garments/$id"
                      params={{ id: garment.id }}
                      data-inline-edit-action
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenGarment(garment.id);
                      }}
                    >
                      <GarmentPhoto garment={garment} />
                    </Link>
                  ))}
              </div>
              <div className="p-5">
                <h3>{outfit.name}</h3>
                <p>
                  {outfit.garment_ids
                    .map((garmentId) => garments.find((garment) => garment.id === garmentId)?.name)
                    .filter(Boolean)
                    .join(' + ')}
                </p>
                <span className="outfit-meta">
                  <CalendarDays size={15} /> {t('outfits.saved')} ·{' '}
                  {tc(`vocabulary.occasions.${outfit.occasion}`, {
                    defaultValue: occasionLabels[outfit.occasion],
                  })}
                </span>
                <Link to="/saved" className="text-sm underline">
                  {t('outfits.openSaved')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="recommendation-empty">
          <Sparkles size={30} strokeWidth={1} />
          <h3>{t('outfits.emptyTitle')}</h3>
          <p>{t('outfits.emptyDescription')}</p>
          <Button variant="outline" asChild>
            <Link to="/garments/new">
              {t('outfits.addGarment')} <Plus size={15} />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
