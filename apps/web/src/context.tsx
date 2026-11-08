import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Link, useNavigate } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Shirt,
  Sparkles,
  Heart,
  WashingMachine,
  Users,
  Settings,
  LogOut,
  Plus,
  ArrowUpRight,
  Menu,
  X,
  Check,
  CloudOff,
} from 'lucide-react';
import { api, ApiError } from './api';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';
import type { Wardrobe } from '@wardrobe/shared';
const Context = createContext<{
  wardrobe?: Wardrobe;
  wardrobes: Wardrobe[];
  choose: (id: string) => void;
  notify: (message: string) => void;
  create: () => void;
}>({ wardrobes: [], choose: () => {}, notify: () => {}, create: () => {} });
export const useWardrobe = () => useContext(Context);
export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: api.me, retry: false, staleTime: 60000 });
export function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Ładowanie" role="status">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
      <span className="sr-only">Ładowanie garderoby…</span>
    </div>
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div role="alert" className="error-notice">
      <CloudOff size={20} />
      <span>{error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.'}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Shirt size={34} strokeWidth={1} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
const nav = [
  { to: '/dashboard', label: 'Przegląd', icon: LayoutDashboard },
  { to: '/wardrobe', label: 'Moja garderoba', icon: Shirt },
  { to: '/outfits', label: 'Stylizacje', icon: Sparkles },
  { to: '/saved', label: 'Zapisane zestawy', icon: Heart },
  { to: '/laundry', label: 'Pranie i pielęgnacja', icon: WashingMachine },
  { to: '/family', label: 'Rodzinna szafa', icon: Users },
] as const;
export function Shell({ children }: { children: ReactNode }) {
  const me = useMe();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const wardrobes = useQuery({
    queryKey: ['wardrobes'],
    queryFn: api.wardrobes,
    enabled: !!me.data,
  });
  const [selected, setSelected] = useState('');
  const [toast, setToast] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'private' | 'family'>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const wardrobe = wardrobes.data?.find((w) => w.id === selected) ?? wardrobes.data?.[0];
  function notify(message: string) {
    setToast(message);
  }
  if (me.isPending)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" />;
  if (me.error)
    return (
      <div className="page">
        <ErrorNotice error={me.error} />
        <Button onClick={() => void me.refetch()}>Spróbuj ponownie</Button>
      </div>
    );
  async function logout() {
    try {
      await api.logout();
      cache.clear();
      if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      await navigate({ to: '/login' });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Nie udało się wylogować.');
    }
  }
  return (
    <Context.Provider
      value={{
        wardrobe,
        wardrobes: wardrobes.data ?? [],
        choose: setSelected,
        notify,
        create: () => setCreateOpen(true),
      }}
    >
      <div className="app-shell">
        <aside className={'sidebar ' + (mobileOpen ? 'sidebar-open' : '')}>
          <Link to="/dashboard" className="brand">
            <span className="brand-mark">
              <Shirt size={22} strokeWidth={1.5} />
            </span>
            <span>
              smart<span className="brand-light">wardrobe</span>
              <small>TWÓJ STYL. TWOJA PRZESTRZEŃ.</small>
            </span>
          </Link>
          <button
            className="mobile-close"
            aria-label="Zamknij menu"
            onClick={() => setMobileOpen(false)}
          >
            <X />
          </button>
          <div className="wardrobe-switch">
            <label htmlFor="active-wardrobe">TWOJA PRZESTRZEŃ</label>
            <select
              id="active-wardrobe"
              value={wardrobe?.id ?? ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              {!wardrobes.data?.length && <option value="">Wybierz garderobę</option>}
              {wardrobes.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button aria-label="Utwórz garderobę" onClick={() => setCreateOpen(true)}>
              <Plus size={17} />
            </button>
          </div>
          <nav aria-label="Nawigacja główna">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="nav-item"
                activeProps={{ className: 'nav-item active' }}
                onClick={() => setMobileOpen(false)}
              >
                <n.icon size={19} strokeWidth={1.6} />
                {n.label}
                {n.to === '/outfits' && <span className="tiny-tag">DLA CIEBIE</span>}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="eyebrow">MNIEJ, ALE LEPIEJ</span>
            <p>
              Dobry styl zaczyna się
              <br />
              od tego, co już masz.
            </p>
            <span className="note-line" />
          </div>
          <Link className="nav-item settings-link" to="/settings">
            <Settings size={19} />
            Ustawienia
          </Link>
          <div className="user-block">
            <span className="avatar">{me.data?.name?.[0]?.toUpperCase() || 'S'}</span>
            <div>
              <strong>{me.data?.name || 'Twoje konto'}</strong>
              <small>Prywatna przestrzeń</small>
            </div>
            <button aria-label="Wyloguj" title="Wyloguj" onClick={() => void logout()}>
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <button
              className="mobile-menu"
              aria-label="Otwórz menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </button>
            <span className="topbar-label">Twoja garderoba, przemyślana na nowo.</span>
            <span className="private-label">
              <span /> Tylko dla Ciebie i zaproszonych osób
            </span>
            <span className="topbar-date">
              {new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' }).format(
                new Date(),
              )}
            </span>
          </header>
          <main id="main" className="main-content">
            {wardrobes.isPending ? (
              <Loading />
            ) : wardrobes.error ? (
              <ErrorNotice error={wardrobes.error} />
            ) : (
              children
            )}
          </main>
          <footer className="app-footer">
            Smart Wardrobe <span>Stworzone z myślą o tym, co już masz.</span>
            <ArrowUpRight size={15} />
          </footer>
        </div>
        <nav className="bottom-nav" aria-label="Nawigacja mobilna">
          {nav.slice(0, 3).map((n) => (
            <Link key={n.to} to={n.to} activeProps={{ className: 'active' }}>
              <n.icon size={21} />
              <span>{n.to === '/wardrobe' ? 'Garderoba' : n.label}</span>
            </Link>
          ))}
          <Link to="/laundry">
            <WashingMachine size={21} />
            <span>Pielęgnacja</span>
          </Link>
        </nav>
      </div>
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nowa garderoba"
        description="Zrób miejsce dla ulubionych rzeczy."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              const w = await api.createWardrobe(name, kind);
              await cache.invalidateQueries({ queryKey: ['wardrobes'] });
              setSelected(w.id);
              setCreateOpen(false);
              setName('');
              notify('Garderoba jest gotowa. Dodaj pierwsze ubranie.');
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nazwa garderoby
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Moja garderoba"
            />
          </label>
          <label>
            Widoczność
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="private">Prywatna — tylko dla mnie</option>
              <option value="family">Rodzinna — dla zaproszonych osób</option>
            </select>
          </label>
          {!!error && <ErrorNotice error={error} />}
          <Button disabled={busy} className="w-full mt-4">
            {busy ? 'Tworzenie…' : 'Utwórz garderobę'}
          </Button>
        </form>
      </Dialog>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Zamknij powiadomienie">
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
