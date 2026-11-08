import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  useLegacyTable,
  getCoreRowModel,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy';
import { flexRender } from '@tanstack/react-table';
import { z } from 'zod';
import {
  Heart,
  Sparkles,
  ArrowUpRight,
  Plus,
  Users,
  Copy,
  Trash2,
  Thermometer,
  Check,
  ShieldCheck,
  Shirt,
} from 'lucide-react';
import {
  cleanliness,
  cleanlinessLabels,
  occasions,
  occasionLabels,
  type Garment,
  type OutfitInput,
} from '@wardrobe/shared';
import { api, request } from './api';
import { useWardrobe, useMe, Empty, Loading, ErrorNotice } from './context';
import { useGarments, PageHeading, GarmentPhoto, AddButton } from './catalog';
import { Button } from './components/ui/button';
export function OutfitPage({ saved = false }: { saved?: boolean }) {
  const { wardrobe, notify } = useWardrobe();
  const garments = useGarments();
  const cache = useQueryClient();
  const [occasion, setOccasion] = useState<OutfitInput['occasion']>('everyday');
  const [temperature, setTemperature] = useState(18);
  const [generated, setGenerated] = useState<Garment[][]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const savedQuery = useQuery({ queryKey: ['outfits'], queryFn: api.outfits, enabled: saved });
  async function generate() {
    if (!wardrobe) return;
    setBusy(true);
    setError(undefined);
    try {
      setGenerated((await api.recommendations(wardrobe.id, occasion, temperature)).outfits);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const outfits = saved
    ? (savedQuery.data ?? [])
        .filter((o) => o.wardrobe_id === wardrobe?.id)
        .map((o) => ({
          id: o.id,
          name: o.name,
          occasion: o.occasion,
          garments: o.garment_ids
            .map((id) => garments.data?.find((g) => g.id === id))
            .filter((g): g is Garment => !!g),
        }))
    : generated
        .filter((gs) => gs.every((g) => g.wardrobe_id === wardrobe?.id))
        .map((gs, i) => ({
          id: String(i),
          name: `${occasionLabels[occasion]} · ${i + 1}`,
          occasion,
          garments: gs,
        }));
  return (
    <>
      <PageHeading
        eyebrow={saved ? 'DOBRE WYBORY NA PÓŹNIEJ' : 'TWÓJ STYL, NOWE POŁĄCZENIA'}
        title={saved ? 'Zapisane stylizacje' : 'Co dziś założysz?'}
        description={
          saved
            ? 'Zestawy, do których warto wracać.'
            : 'Zestawy z ubrań, które już masz. Dopasowane do Twojego dnia.'
        }
        action={
          saved ? (
            <Button asChild>
              <Link to="/outfits">
                <Sparkles size={17} />
                Znajdź nowe połączenia
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!saved && (
        <section className="outfit-controls">
          <span className="eyebrow">JAKIE MASZ PLANY?</span>
          <div className="filter-tabs">
            {occasions.map((o) => (
              <button
                key={o}
                className={o === occasion ? 'selected' : ''}
                onClick={() => {
                  setOccasion(o);
                  setGenerated([]);
                }}
              >
                {occasionLabels[o]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="temperature-label">
              <span>
                <Thermometer size={16} />
                Temperatura na zewnątrz (°C)
              </span>
              <input
                type="number"
                min={-40}
                max={55}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </label>
            <Button disabled={!wardrobe || busy} onClick={() => void generate()}>
              <Sparkles size={17} />
              {busy ? 'Szukamy połączeń…' : 'Zaproponuj zestawy'}
            </Button>
          </div>
          <p className="source-note">
            Propozycje według reguł: okazja, temperatura, czyste i niearchiwizowane ubrania. Bez
            pobierania lokalizacji i bez AI.
          </p>
        </section>
      )}
      {!!error && <ErrorNotice error={error} />}{' '}
      {savedQuery.error && saved && <ErrorNotice error={savedQuery.error} />}{' '}
      {busy || (saved && savedQuery.isPending) ? (
        <Loading />
      ) : outfits.length ? (
        <div className="outfit-grid">
          {outfits.map((o) => (
            <article className="outfit-card" key={o.id}>
              <div className="outfit-collage">
                {o.garments.map((g) => (
                  <Link to="/garments/$id" params={{ id: g.id }} key={g.id}>
                    <GarmentPhoto garment={g} />
                  </Link>
                ))}
              </div>
              <div className="p-5">
                <span className="eyebrow">{occasionLabels[o.occasion]}</span>
                <h2>{o.name}</h2>
                <p>
                  {o.garments.map((g) => g.name).join(' + ') ||
                    'Ubrania z tego zestawu zostały usunięte lub zarchiwizowane.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      if (saved) {
                        await request(
                          '/api/outfits/' + o.id,
                          z.object({ ok: z.boolean() }),
                          'DELETE',
                        );
                        notify('Usunięto zapisany zestaw.');
                      } else {
                        await api.saveOutfit({
                          wardrobe_id: wardrobe!.id,
                          name: o.name,
                          occasion: o.occasion,
                          temperature,
                          garment_ids: o.garments.map((g) => g.id),
                        });
                        notify('Zapisano zestaw.');
                      }
                      await cache.invalidateQueries({ queryKey: ['outfits'] });
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  {saved ? <Trash2 size={16} /> : <Heart size={16} />}{' '}
                  {saved ? 'Usuń zestaw' : 'Zapisz zestaw'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            saved ? 'Twoje sprawdzone połączenia zamieszkają tutaj' : 'Czas na dobre połączenie'
          }
          description={
            saved
              ? 'Zapisz propozycję stylizacji, aby mieć ją pod ręką na kolejny dzień.'
              : 'Wybierz okazję i poproś o propozycje. Potrzebujesz czystej góry i dołu lub sukienki w wybranej garderobie.'
          }
          action={
            saved ? (
              <Button variant="outline" asChild>
                <Link to="/outfits">
                  Odkryj stylizacje <ArrowUpRight size={16} />
                </Link>
              </Button>
            ) : (
              <AddButton />
            )
          }
        />
      )}
    </>
  );
}
export function Laundry() {
  const query = useGarments();
  const cache = useQueryClient();
  const { notify } = useWardrobe();
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<unknown>();
  const [updating, setUpdating] = useState('');
  const data = useMemo(
    () => (query.data ?? []).filter((g) => status === 'all' || g.cleanliness === status),
    [query.data, status],
  );
  const columns = useMemo<LegacyColumnDef<Garment>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Ubranie',
        cell: (info) => (
          <Link
            to="/garments/$id"
            params={{ id: info.row.original.id }}
            className="laundry-garment"
          >
            <GarmentPhoto garment={info.row.original} />
            <span>
              <strong>{info.row.original.name}</strong>
              <small>{info.row.original.brand || 'Twoja garderoba'}</small>
            </span>
          </Link>
        ),
      },
      {
        accessorKey: 'cleanliness',
        header: 'Status',
        cell: (info) => (
          <span className={'status-pill status-' + info.row.original.cleanliness}>
            {cleanlinessLabels[info.row.original.cleanliness]}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Zmień status',
        cell: (info) => (
          <select
            aria-label={'Status: ' + info.row.original.name}
            disabled={updating === info.row.original.id}
            value={info.row.original.cleanliness}
            onChange={async (e) => {
              const id = info.row.original.id;
              setUpdating(id);
              try {
                await api.updateGarment(id, {
                  cleanliness: e.target.value as Garment['cleanliness'],
                });
                await cache.invalidateQueries({ queryKey: ['garments'] });
                notify('Status ubrania zaktualizowany.');
              } catch (e) {
                setError(e);
              } finally {
                setUpdating('');
              }
            }}
          >
            {cleanliness.map((s) => (
              <option key={s} value={s}>
                {cleanlinessLabels[s]}
              </option>
            ))}
          </select>
        ),
      },
    ],
    [cache, notify, updating],
  );
  const table = useLegacyTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <>
      <PageHeading
        eyebrow="DBAJ O TO, CO LUBISZ"
        title="Pranie i pielęgnacja"
        description="Małe rytuały, dzięki którym Twoje ubrania zostaną z Tobą na dłużej."
      />
      <div className="filter-tabs">
        <button className={status === 'all' ? 'selected' : ''} onClick={() => setStatus('all')}>
          Wszystkie
        </button>
        {cleanliness.map((s) => (
          <button key={s} className={status === s ? 'selected' : ''} onClick={() => setStatus(s)}>
            {cleanlinessLabels[s]}{' '}
            <span>{query.data?.filter((g) => g.cleanliness === s).length ?? 0}</span>
          </button>
        ))}
      </div>
      {!!error && <ErrorNotice error={error} />}{' '}
      {query.isPending && query.fetchStatus !== 'idle' ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : !data.length ? (
        <Empty
          title="Wszystko pod kontrolą"
          description="Nie ma ubrań w tej kategorii. Ich status możesz zmienić w każdej chwili."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="editorial-note">
        <Shirt size={22} />
        <p>
          Wskazówki pielęgnacji zawsze sprawdzaj na metce producenta. Zdjęcie metki znajdziesz w
          szczegółach ubrania.
        </p>
      </div>
    </>
  );
}
export function Family() {
  const { wardrobe, wardrobes, create, choose, notify } = useWardrobe();
  const me = useMe();
  const cache = useQueryClient();
  const members = useQuery({
    queryKey: ['members', wardrobe?.id],
    queryFn: () => api.members(wardrobe!.id),
    enabled: !!wardrobe,
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [link, setLink] = useState('');
  const [token, setToken] = useState(
    new URLSearchParams(window.location.search).get('invite') ?? '',
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const owner = wardrobe?.owner_id === me.data?.id;
  return (
    <>
      <PageHeading
        eyebrow="DOBRZE MIEĆ WSPÓLNĄ PRZESTRZEŃ"
        title="Rodzinna szafa"
        description="Osobne style, jedna wygodna garderoba. Zapraszaj bliskich na swoich zasadach."
        action={
          <Button onClick={create}>
            <Plus size={17} />
            Nowa garderoba
          </Button>
        }
      />
      <div className="family-layout">
        <section className="form-panel">
          <h2>Twoje garderoby</h2>
          <div className="wardrobe-list">
            {wardrobes.map((w) => (
              <button
                key={w.id}
                className={w.id === wardrobe?.id ? 'selected' : ''}
                onClick={() => {
                  choose(w.id);
                  setLink('');
                }}
              >
                <Users size={21} />
                <span>
                  <strong>{w.name}</strong>
                  <small>{w.kind === 'family' ? 'Wspólna przestrzeń' : 'Prywatna garderoba'}</small>
                </span>
                {w.id === wardrobe?.id && <Check size={18} />}
              </button>
            ))}
          </div>
          {wardrobe && (
            <>
              <h3 className="mt-6 mb-3">Członkowie: {wardrobe.name}</h3>
              {members.data?.map((m) => (
                <div className="member-row" key={m.user_id}>
                  <span className="avatar">{m.user_id === me.data?.id ? 'TY' : 'U'}</span>
                  <div>
                    <strong>
                      {m.user_id === me.data?.id ? me.data?.name : 'Członek garderoby'}
                    </strong>
                    <small>
                      {m.user_id.slice(0, 8)} ·{' '}
                      {m.role === 'owner'
                        ? 'Właściciel'
                        : m.role === 'editor'
                          ? 'Edytor'
                          : 'Przeglądający'}
                    </small>
                  </div>
                  {owner && m.role !== 'owner' && (
                    <>
                      <select
                        aria-label="Rola członka"
                        value={m.role}
                        onChange={async (e) => {
                          try {
                            await request(
                              `/api/wardrobes/${wardrobe.id}/members/${m.user_id}`,
                              z.unknown(),
                              'PATCH',
                              { role: e.target.value },
                            );
                            await members.refetch();
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        <option value="viewer">Przeglądający</option>
                        <option value="editor">Edytor</option>
                      </select>
                      <button
                        aria-label="Usuń członka"
                        onClick={async () => {
                          try {
                            await request(
                              `/api/wardrobes/${wardrobe.id}/members/${m.user_id}`,
                              z.unknown(),
                              'DELETE',
                            );
                            await members.refetch();
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </section>
        <section className="form-panel">
          <h2>Zaproś kogoś bliskiego</h2>
          <p className="text-muted">
            Zaproszenie jest przypisane do adresu email i ważne przez 7 dni.
          </p>
          {owner && wardrobe?.kind === 'family' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const data = await request(
                    `/api/wardrobes/${wardrobe.id}/invitations`,
                    z.object({ url: z.string() }),
                    'POST',
                    { email, role },
                  );
                  setLink(data.url);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Adres email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bliska.osoba@example.com"
                />
              </label>
              <label>
                Uprawnienia
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="viewer">Przeglądający — może oglądać</option>
                  <option value="editor">Edytor — może dodawać i zmieniać ubrania</option>
                </select>
              </label>
              <Button disabled={busy}>
                Utwórz zaproszenie <ArrowUpRight size={16} />
              </Button>
              {link && (
                <div className="invite-result">
                  <label>
                    Link zaproszenia
                    <input readOnly value={link} />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link);
                        notify('Skopiowano zaproszenie.');
                      } catch {
                        notify('Skopiuj link ręcznie z pola powyżej.');
                      }
                    }}
                  >
                    <Copy size={15} />
                    Kopiuj link
                  </Button>
                  <p>Przekaż link tej osobie. Zaproszenie nie jest wysyłane automatycznie.</p>
                </div>
              )}
            </form>
          ) : (
            <div className="privacy-note">
              <ShieldCheck size={22} />
              Tylko właściciel rodzinnej garderoby może zapraszać nowych członków.
            </div>
          )}
          <hr className="my-6" />
          <h3>Masz zaproszenie?</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const raw = token.includes('?invite=')
                  ? new URL(token).searchParams.get('invite')
                  : token;
                await request(
                  '/api/invitations/accept',
                  z.object({ wardrobe_id: z.string() }),
                  'POST',
                  { token: raw },
                );
                await cache.invalidateQueries({ queryKey: ['wardrobes'] });
                await cache.invalidateQueries({ queryKey: ['members'] });
                setToken('');
                window.history.replaceState({}, '', window.location.pathname);
                notify('Dołączono do garderoby.');
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Link lub kod zaproszenia
              <input value={token} onChange={(e) => setToken(e.target.value)} required />
            </label>
            <Button variant="outline" disabled={busy}>
              Dołącz do garderoby
            </Button>
          </form>
          {!!error && <ErrorNotice error={error} />}
        </section>
      </div>
    </>
  );
}
export function Settings() {
  const me = useMe();
  const cache = useQueryClient();
  const { notify } = useWardrobe();
  const [name, setName] = useState(me.data?.name ?? '');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () =>
      request(
        '/api/config',
        z.object({ smtpConfigured: z.boolean(), emailConfirmation: z.boolean() }),
      ),
  });
  return (
    <>
      <PageHeading
        eyebrow="TWOJA PRZESTRZEŃ, TWOJE ZASADY"
        title="Profil i ustawienia"
        description="Zadbaj o swoje konto i wygodę korzystania z garderoby."
      />
      <div className="settings-grid">
        <section className="form-panel">
          <h2>Twój profil</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await request('/api/profile', z.unknown(), 'PATCH', { name });
                await cache.invalidateQueries({ queryKey: ['me'] });
                notify('Profil zaktualizowany.');
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Imię
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Adres email
              <input readOnly value={me.data?.email ?? ''} />
            </label>
            <Button disabled={busy}>Zapisz zmiany</Button>
          </form>
          {!!error && <ErrorNotice error={error} />}
          <hr className="my-6" />
          <h3>Bezpieczeństwo</h3>
          <p className="text-muted my-3">Możesz ustawić nowe hasło dla swojego konta.</p>
          <Button variant="outline" asChild>
            <Link to="/reset-password">Zmień hasło</Link>
          </Button>
        </section>
        <section className="form-panel">
          <ShieldCheck size={27} strokeWidth={1.3} />
          <h2 className="mt-4">Prywatność jest częścią stylu.</h2>
          <p className="text-muted">
            Twoje dane i zdjęcia są przechowywane na serwerze właściciela tej instalacji. Aplikacja
            nie wymaga konta w chmurze.
          </p>
          <div className="setting-status">
            <span>Wysyłka email</span>
            <strong>{config.data?.smtpConfigured ? 'Skonfigurowana' : 'Nieskonfigurowana'}</strong>
          </div>
          <div className="setting-status">
            <span>Analiza AI</span>
            <strong>Kolejny etap</strong>
          </div>
          <div className="setting-status">
            <span>Propozycje zestawów</span>
            <strong>Reguły, Twoje ubrania</strong>
          </div>
          <h3 className="mt-6">Garderoba zawsze pod ręką</h3>
          <p className="text-muted mt-2">
            Na telefonie wybierz „Dodaj do ekranu głównego” w menu przeglądarki. Instalacja wymaga
            HTTPS. Bez sieci wyświetlamy jedynie powłokę aplikacji — prywatne dane nie są zapisywane
            offline.
          </p>
        </section>
      </div>
    </>
  );
}
