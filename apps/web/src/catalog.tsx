import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Heart,
  Search,
  SlidersHorizontal,
  Shirt,
  Leaf,
  WashingMachine,
  Sparkles,
  Archive,
} from 'lucide-react';
import { categories, categoryLabels, cleanlinessLabels, type Garment } from '@wardrobe/shared';
import { api } from './api';
import { useWardrobe, useMe, Empty, Loading, ErrorNotice } from './context';
import { Button } from './components/ui/button';
export function useGarments(archived = false) {
  const { wardrobe } = useWardrobe();
  return useQuery({
    queryKey: ['garments', wardrobe?.id, archived],
    queryFn: () => api.garments(wardrobe?.id, archived),
    enabled: !!wardrobe,
  });
}
export function GarmentPhoto({
  garment,
  className = '',
}: {
  garment: Garment;
  className?: string;
}) {
  const img = garment.garment_images.find((i) => i.kind === 'garment');
  return img ? (
    <img
      className={'garment-photo ' + className}
      src={'/api/images/' + img.id}
      alt={garment.name}
      loading="lazy"
    />
  ) : (
    <div className={'photo-placeholder ' + className}>
      <Shirt size={50} strokeWidth={0.7} />
      <span>Dodaj zdjęcie</span>
    </div>
  );
}
export function GarmentCard({ garment }: { garment: Garment }) {
  const cache = useQueryClient();
  const { notify } = useWardrobe();
  const [busy, setBusy] = useState(false);
  return (
    <article className="garment-card">
      <Link to="/garments/$id" params={{ id: garment.id }} className="garment-image-link">
        <GarmentPhoto garment={garment} />
        <span className={'status-badge status-' + garment.cleanliness}>
          {cleanlinessLabels[garment.cleanliness]}
        </span>
      </Link>
      <button
        disabled={busy}
        className={'favorite-button ' + (garment.favorite ? 'is-favorite' : '')}
        aria-label={garment.favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        onClick={async () => {
          setBusy(true);
          try {
            await api.updateGarment(garment.id, { favorite: !garment.favorite });
            await cache.invalidateQueries({ queryKey: ['garments'] });
          } catch (e) {
            notify(e instanceof Error ? e.message : 'Nie udało się zapisać.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Heart size={18} fill={garment.favorite ? 'currentColor' : 'none'} />
      </button>
      <div className="garment-card-info">
        <div>
          <span>{categoryLabels[garment.category]}</span>
          <Link to="/garments/$id" params={{ id: garment.id }}>
            <h3>{garment.name}</h3>
          </Link>
          <p>
            {garment.brand || 'Twoja kolekcja'}
            {garment.size ? ' · ' + garment.size : ''}
          </p>
        </div>
        <ArrowUpRight size={18} />
      </div>
    </article>
  );
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
  const { wardrobe, create } = useWardrobe();
  return wardrobe ? (
    <Button asChild>
      <Link to="/garments/new">
        <Plus size={18} /> Dodaj ubranie
      </Link>
    </Button>
  ) : (
    <Button onClick={create}>
      <Plus size={18} /> Utwórz garderobę
    </Button>
  );
}
export function Dashboard() {
  const me = useMe();
  const { wardrobe, create } = useWardrobe();
  const query = useGarments();
  const garments = query.data ?? [];
  return (
    <>
      <PageHeading
        eyebrow="TWOJA CODZIENNA DAWKA INSPIRACJI"
        title={`Cześć${me.data?.name ? ', ' + me.data.name : ''}.`}
        description="Dobry dzień zaczyna się od dobrego wyboru."
        action={<AddButton />}
      />
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">MNIEJ CHAOSU. WIĘCEJ MOŻLIWOŚCI.</span>
          <h2>
            Odkryj potencjał
            <br />
            <em>swojej garderoby.</em>
          </h2>
          <p>
            Ulubione ubrania, nowe połączenia.
            <br />
            Twój styl jest bliżej, niż myślisz.
          </p>
          <Button variant="outline" asChild>
            <Link to="/outfits">
              Znajdź swój zestaw <ArrowUpRight size={18} />
            </Link>
          </Button>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <span>
            THE ART OF
            <br />
            GETTING DRESSED
          </span>
          <Shirt strokeWidth={0.5} />
          <small>CODZIENNIE. PO SWOJEMU.</small>
        </div>
      </section>
      <section className="stats-grid">
        {[
          {
            icon: Shirt,
            label: 'Ubrania w garderobie',
            value: garments.length,
            note: 'Twoja osobista kolekcja',
          },
          {
            icon: Heart,
            label: 'Ulubione rzeczy',
            value: garments.filter((g) => g.favorite).length,
            note: 'Sprawdzone wybory',
          },
          {
            icon: Leaf,
            label: 'Gotowe do założenia',
            value: garments.filter((g) => g.cleanliness === 'clean').length,
            note: 'Czekają na swój moment',
          },
          {
            icon: WashingMachine,
            label: 'Potrzebują pielęgnacji',
            value: garments.filter((g) => g.cleanliness !== 'clean' && g.cleanliness !== 'worn')
              .length,
            note: 'Zadbaj o nie na dłużej',
          },
        ].map((s) => (
          <article className="stat" key={s.label}>
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
          <span className="eyebrow">TWOJA KOLEKCJA</span>
          <h2>Ostatnio w garderobie</h2>
        </div>
        <Link to="/wardrobe">
          Zobacz wszystko <ArrowRight size={16} />
        </Link>
      </div>
      {!wardrobe ? (
        <Empty
          title="Twoja nowa przestrzeń na styl"
          description="Utwórz pierwszą garderobę. Potem dodaj zdjęcia rzeczy, które lubisz nosić."
          action={
            <Button onClick={create}>
              <Plus size={17} />
              Utwórz garderobę
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
          title="Każda kolekcja zaczyna się od jednej rzeczy"
          description="Dodaj pierwsze ubranie i zobacz swoją garderobę z nowej perspektywy."
          action={<AddButton />}
        />
      )}
      <div className="editorial-note">
        <Sparkles size={21} strokeWidth={1.3} />
        <p>
          <strong>Mała zmiana, duża różnica.</strong> Zdjęcie metki pomoże Ci zachować informacje o
          składzie i pielęgnacji.
        </p>
        <Link to="/wardrobe">
          Zajrzyj do szafy <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
export function Catalog() {
  const { wardrobe, create } = useWardrobe();
  const [archived, setArchived] = useState(false);
  const query = useGarments(archived);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [favorite, setFavorite] = useState(false);
  const [sort, setSort] = useState('newest');
  const filtered = (query.data ?? [])
    .filter(
      (g) =>
        (category === 'all' || g.category === category) &&
        (!favorite || g.favorite) &&
        `${g.name} ${g.brand} ${g.primary_color}`
          .toLocaleLowerCase('pl')
          .includes(search.toLocaleLowerCase('pl')),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'pl')
        : b.created_at.localeCompare(a.created_at),
    );
  return (
    <>
      <PageHeading
        eyebrow="PRZEMYŚLANA KOLEKCJA"
        title="Moja garderoba"
        description={
          wardrobe
            ? `${wardrobe.name} · ${query.data?.length ?? 0} rzeczy, wiele możliwości.`
            : 'Miejsce na rzeczy, które są Twoje.'
        }
        action={<AddButton />}
      />
      <div className="catalog-toolbar">
        <div className="search-input">
          <Search size={19} />
          <input
            aria-label="Szukaj ubrań"
            placeholder="Szukaj po nazwie, marce, kolorze…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={favorite ? 'default' : 'outline'}
          onClick={() => setFavorite(!favorite)}
          aria-pressed={favorite}
        >
          <Heart size={17} />
          Ulubione
        </Button>
        <Button
          variant={archived ? 'default' : 'outline'}
          onClick={() => setArchived(!archived)}
          aria-pressed={archived}
        >
          <Archive size={17} />
          Archiwum
        </Button>
        <label className="sort-select">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Sortowanie ubrań"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Najnowsze</option>
            <option value="name">Nazwa A–Z</option>
          </select>
        </label>
      </div>
      <div className="filter-tabs" aria-label="Kategorie">
        <button className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>
          Wszystkie <span>{query.data?.length ?? 0}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={category === c ? 'selected' : ''}
            onClick={() => setCategory(c)}
          >
            {categoryLabels[c]}
          </button>
        ))}
      </div>
      {!wardrobe ? (
        <Empty
          title="Zacznij od własnej garderoby"
          description="Możesz mieć osobną szafę dla siebie i współdzieloną dla rodziny."
          action={<Button onClick={create}>Utwórz garderobę</Button>}
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : !filtered.length ? (
        <Empty
          title={query.data?.length ? 'Nie znaleziono ubrań' : 'Jeszcze tu spokojnie'}
          description={
            query.data?.length
              ? 'Zmień kategorię lub wpisz inną nazwę.'
              : 'Dodaj pierwsze zdjęcie. Twoja szafa zacznie nabierać kształtu.'
          }
          action={
            query.data?.length ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCategory('all');
                  setFavorite(false);
                }}
              >
                Wyczyść filtry
              </Button>
            ) : (
              <AddButton />
            )
          }
        />
      ) : (
        <div className="garment-grid">
          {filtered.map((g) => (
            <GarmentCard key={g.id} garment={g} />
          ))}
        </div>
      )}
    </>
  );
}
