import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Leaf,
  Plus,
  Shirt,
  Sparkles,
  WashingMachine,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { interpretStyleProfile } from '@wardrobe/shared';

import { Empty, ErrorNotice, Loading, useMe, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api/client';

import { AddButton, GarmentCard, PageHeading, useGarments } from '../../catalog';

export function Dashboard() {
  const { t } = useTranslation('dashboard');
  const me = useMe();
  const { wardrobe, create } = useWardrobe();
  const query = useGarments();
  const styleProfile = useQuery({
    queryKey: ['style-profile', me.data?.id],
    queryFn: api.styleProfile,
    enabled: !!me.data?.id,
    retry: false,
  });
  const garments = query.data ?? [];

  return (
    <>
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.greeting', { name: me.data?.name ? `, ${me.data.name}` : '' })}
        description={t('page.description')}
        action={<AddButton />}
      />
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">{t('page.heroEyebrow')}</span>
          <h2>{t('page.heroTitle')}</h2>
          <p>{t('page.heroText')}</p>
          <Button variant="outline" asChild>
            <Link to="/outfits">
              {t('page.findOutfit')} <ArrowUpRight size={18} />
            </Link>
          </Button>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <span>
            {t('page.artTitle')}
            <br />
          </span>
          <Shirt strokeWidth={0.5} />
          <small>{t('page.artTagline')}</small>
        </div>
      </section>
      {styleProfile.data &&
        interpretStyleProfile(styleProfile.data.answers).progress.baseAnswered < 30 && (
          <section className="dashboard-style-prompt">
            <div>
              <span className="eyebrow">{t('page.personalization')}</span>
              <h2>{t('page.personalizeTitle')}</h2>
              <p>
                {t('page.profileProgress', {
                  answered: interpretStyleProfile(styleProfile.data.answers).progress.baseAnswered,
                  total: 30,
                })}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/style/survey">
                {t('page.completeStyle')} <ArrowRight size={16} />
              </Link>
            </Button>
          </section>
        )}
      <section className="stats-grid">
        {[
          {
            icon: Shirt,
            label: t('page.garments'),
            value: garments.length,
            note: t('page.collectionNote'),
          },
          {
            icon: Heart,
            label: t('page.favorites'),
            value: garments.filter((g) => g.favorite).length,
            note: t('page.favoritesNote'),
          },
          {
            icon: Leaf,
            label: t('page.ready'),
            value: garments.filter((g) => g.cleanliness === 'clean').length,
            note: t('page.readyNote'),
          },
          {
            icon: WashingMachine,
            label: t('page.care'),
            value: garments.filter((g) => g.cleanliness !== 'clean' && g.cleanliness !== 'worn')
              .length,
            note: t('page.careNote'),
          },
        ].map((s) => (
          <article className="stat card" key={s.label}>
            <div>
              <span>{s.label}</span>
              <s.icon size={19} strokeWidth={1.4} />
            </div>
            <strong>{query.isPending && wardrobe ? '—' : s.value}</strong>
            <small>{s.note}</small>
          </article>
        ))}
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t('page.collection')}</span>
          <h2>{t('page.recent')}</h2>
        </div>
        <Link to="/wardrobe">
          {t('page.seeAll')} <ArrowRight size={16} />
        </Link>
      </div>
      {!wardrobe ? (
        <Empty
          title={t('page.createSpaceTitle')}
          description={t('page.createSpaceDescription')}
          action={
            <Button onClick={create}>
              <Plus size={17} />
              {t('page.createWardrobe')}
            </Button>
          }
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : garments.length ? (
        <div className="garment-grid">
          {garments.slice(0, 4).map((g) => (
            <GarmentCard key={g.id} garment={g} />
          ))}
        </div>
      ) : (
        <Empty
          title={t('page.firstCollectionTitle')}
          description={t('page.firstCollectionDescription')}
          action={<AddButton />}
        />
      )}
      <div className="editorial-note">
        <Sparkles size={21} strokeWidth={1.3} />
        <p>
          <strong>{t('page.editorialTitle')}</strong> {t('page.editorialText')}
        </p>
        <Link to="/wardrobe">
          {t('page.visitWardrobe')} <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
