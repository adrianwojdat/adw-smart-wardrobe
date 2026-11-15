import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Archive, ArrowDownWideNarrow, Heart, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { categories } from '@wardrobe/shared';

import { Empty, ErrorNotice, Loading, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { api } from '../../../lib/api/client';

import { GarmentCard } from '../components/garment-card';

export function useGarments(archived = false) {
  const { wardrobe } = useWardrobe();

  return useQuery({
    queryKey: ['garments', wardrobe?.id, archived],
    queryFn: () => api.garments(wardrobe?.id, archived),
    enabled: !!wardrobe,
  });
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AddButton() {
  const { t } = useTranslation('catalog');
  const { wardrobe, create } = useWardrobe();

  return wardrobe ? (
    <div className="bulk-actions">
      <Button asChild>
        <Link to="/garments/new">
          <Plus size={18} /> {t('page.addGarment')}
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link to="/garments/import">
          <Plus size={18} />
          {t('page.bulkAdd')}
        </Link>
      </Button>
    </div>
  ) : (
    <Button onClick={create}>
      <Plus size={18} /> {t('page.createWardrobe')}
    </Button>
  );
}

export function Catalog() {
  const { t, i18n } = useTranslation(['catalog', 'common']);
  const { wardrobe, create } = useWardrobe();
  const searchParams = useSearch({ from: '/authenticated/wardrobe' });
  const navigate = useNavigate({ from: '/wardrobe' });
  const archived = searchParams.archived === 'true';
  const query = useGarments(archived);
  const search = searchParams.q ?? '';
  const category = searchParams.category ?? 'all';
  const favorite = searchParams.favorite === 'true';
  const sort = searchParams.sort ?? 'newest';
  const setFilters = (patch: Partial<typeof searchParams>) => {
    void navigate({
      search: (previous) => ({ ...previous, ...patch }),
      replace: true,
    });
  };

  const filtered = (query.data ?? [])
    .filter(
      (g) =>
        (category === 'all' || g.category === category) &&
        (!favorite || g.favorite) &&
        `${g.name} ${g.brand} ${g.primary_color}`
          .toLocaleLowerCase(i18n.language === 'pl' ? 'pl-PL' : 'en-US')
          .includes(search.toLocaleLowerCase(i18n.language === 'pl' ? 'pl-PL' : 'en-US')),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, i18n.language === 'pl' ? 'pl-PL' : 'en-US')
        : b.created_at.localeCompare(a.created_at),
    );

  return (
    <>
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={
          wardrobe
            ? t('page.wardrobeDescription', {
                name: wardrobe.name,
                count: query.data?.length ?? 0,
              })
            : t('page.emptyDescription')
        }
        action={<AddButton />}
      />
      <div className="catalog-toolbar">
        <div className="search-input">
          <Search size={19} />
          <input
            aria-label={t('page.search')}
            placeholder={t('page.searchPlaceholder')}
            value={search}
            onChange={(e) => setFilters({ q: e.target.value || undefined })}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </div>
        <Button
          variant={favorite ? 'default' : 'outline'}
          onClick={() => setFilters({ favorite: favorite ? 'false' : 'true' })}
          aria-pressed={favorite}
        >
          <Heart size={17} />
          {t('page.favorites')}
        </Button>
        <Button
          variant={archived ? 'default' : 'outline'}
          onClick={() => setFilters({ archived: archived ? 'false' : 'true' })}
          aria-pressed={archived}
        >
          <Archive size={17} />
          {t('page.archive')}
        </Button>
        <label className="sort-select">
          <ArrowDownWideNarrow size={16} aria-hidden="true" />
          <span>{t('page.sort')}</span>
          <DropdownSelect
            aria-label={t('page.sortLabel')}
            value={sort}
            onChange={(e) => setFilters({ sort: e.target.value as 'newest' | 'name' })}
            className="select"
          >
            <option value="newest">{t('page.newest')}</option>
            <option value="name">{t('page.nameSort')}</option>
          </DropdownSelect>
        </label>
      </div>
      <div className="filter-tabs" aria-label={t('page.categories')}>
        <button
          className={category === 'all' ? 'selected' : ''}
          onClick={() => setFilters({ category: 'all' })}
        >
          {t('page.all')} <span>{query.data?.length ?? 0}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={category === c ? 'selected' : ''}
            onClick={() => setFilters({ category: c })}
          >
            {t(`vocabulary.categories.${c}`, { ns: 'common' })}
          </button>
        ))}
      </div>
      {!wardrobe ? (
        <Empty
          title={t('page.noWardrobeTitle')}
          description={t('page.noWardrobeDescription')}
          action={<Button onClick={create}>{t('page.createWardrobe')}</Button>}
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : !filtered.length ? (
        <Empty
          title={query.data?.length ? t('page.notFoundTitle') : t('page.emptyTitle')}
          description={
            query.data?.length ? t('page.notFoundDescription') : t('page.emptyDescriptionFiltered')
          }
          action={
            query.data?.length ? (
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({ q: undefined, category: 'all', favorite: 'false' });
                }}
              >
                {t('page.clearFilters')}
              </Button>
            ) : (
              <AddButton />
            )
          }
        />
      ) : (
        <div className="garment-grid">
          {filtered.map((g) => (
            <GarmentCard
              key={g.id}
              garment={g}
              navigation={{
                ids: filtered.map((item) => item.id),
                search: {
                  q: search || undefined,
                  category,
                  favorite: favorite ? 'true' : 'false',
                  archived: archived ? 'true' : 'false',
                  sort,
                },
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
