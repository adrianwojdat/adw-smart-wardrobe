import { createContext, type ReactNode, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Check, CloudOff, Shirt, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Wardrobe } from '@wardrobe/shared';

import {
  AppSidebar,
  BottomNavigation,
  MobileMenuButton,
} from '../../components/layout/app-navigation';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { DropdownSelect } from '../../components/ui/dropdown-select';
import { api, ApiError } from '../../lib/api/client';

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
  const { t } = useTranslation('common');

  return (
    <div className="skeleton-grid" aria-label={t('state.loading')} role="status">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
      <span className="sr-only">{t('shell.loadingWardrobe')}</span>
    </div>
  );
}

export function ErrorNotice({ error }: { error: unknown }) {
  const { t } = useTranslation('common');
  const message =
    error instanceof ApiError
      ? error.status === 401
        ? t('errors.unauthorized')
        : error.status === 403
          ? t('errors.forbidden')
          : error.status === 404
            ? t('errors.notFound')
            : error.status === 429
              ? t('errors.rateLimited')
              : error.status >= 500
                ? t('errors.server')
                : t('errors.request')
      : error instanceof TypeError
        ? t('errors.network')
        : t('state.unexpectedError');

  return (
    <div role="alert" className="error-notice alert alert-error">
      <CloudOff size={20} />
      <span>{message}</span>
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
    <div className="empty-state card w-full">
      <div className="empty-icon">
        <Shirt size={34} strokeWidth={1} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation('common');
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
        <Button onClick={() => void me.refetch()}>{t('state.tryAgain')}</Button>
      </div>
    );

  async function logout() {
    try {
      await api.logout();
      cache.clear();
      if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      await navigate({ to: '/login' });
    } catch {
      notify(t('shell.logoutFailed'));
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
        <AppSidebar
          wardrobe={wardrobe}
          wardrobes={wardrobes.data ?? []}
          userName={me.data?.name}
          mobileOpen={mobileOpen}
          onChooseWardrobe={setSelected}
          onCreateWardrobe={() => setCreateOpen(true)}
          onCloseMobile={() => setMobileOpen(false)}
          onLogout={() => void logout()}
        />
        <div className="workspace">
          <header className="topbar">
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
            <span className="topbar-label">{t('shell.yourWardrobeReimagined')}</span>
            <span className="private-label">
              <span /> {t('shell.privateLabel')}
            </span>
            <span className="topbar-date">
              {new Intl.DateTimeFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
                day: 'numeric',
                month: 'long',
              }).format(new Date())}
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
            Smart Wardrobe <span>{t('shell.madeForWhatYouOwn')}</span>
            <ArrowUpRight size={15} />
          </footer>
        </div>
        <BottomNavigation />
      </div>
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('shell.newWardrobe')}
        description={t('shell.makeRoom')}
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
              notify(t('shell.wardrobeReady'));
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t('shell.wardrobeName')}
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('shell.wardrobeNamePlaceholder')}
              className="input input-bordered h-[45px] px-[14px]"
            />
          </label>
          <label>
            {t('shell.visibility')}
            <DropdownSelect
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="select select-bordered h-[45px] px-[14px]"
            >
              <option value="private">{t('shell.private')}</option>
              <option value="family">{t('shell.family')}</option>
            </DropdownSelect>
          </label>
          {!!error && <ErrorNotice error={error} />}
          <Button disabled={busy} className="w-full mt-4">
            {busy ? t('shell.creating') : t('shell.createWardrobe')}
          </Button>
        </form>
      </Dialog>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label={t('shell.dismissNotification')}>
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
