import React from 'react';
import { TravelPackingPage } from '../../features/travel-packing';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  Link,
} from '@tanstack/react-router';
import { registerSW } from 'virtual:pwa-register';
import { AuthPage, Landing } from '../../features/auth';
import { Shell, ErrorNotice } from '../providers/context';
import { Dashboard } from '../../features/dashboard';
import { Catalog } from '../../features/catalog';
import { GarmentDetail, GarmentFormPage } from '../../features/garments';
import { Family } from '../../features/family';
import { Laundry } from '../../features/laundry';
import { OutfitPage } from '../../features/outfits';
import { Settings } from '../../features/settings';
import { BulkUploadProvider, BulkUploadPage } from '../../features/bulk-upload';
import { StyleProfilePage, StyleSurveyPage } from '../../features/style-profile';
import '../../styles/app.css';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

const garmentNavigationSearch = z
  .object({
    ids: z.array(z.string()).optional(),
    q: z.string().optional(),
    category: z.string().optional(),
    favorite: z.enum(['true', 'false']).optional(),
    archived: z.enum(['true', 'false']).optional(),
    sort: z.enum(['newest', 'name']).optional(),
  })
  .catch({});
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true } },
});

function RootLayout() {
  const { t } = useTranslation('common');

  return (
    <>
      <a className="skip-link" href="#main">
        {t('state.skipContent')}
      </a>
      <Outlet />
    </>
  );
}

function NotFoundPage() {
  const { t } = useTranslation('common');

  return (
    <div className="page">
      <h1>{t('state.notFound')}</h1>
      <Link to="/dashboard">{t('state.backToWardrobe')}</Link>
    </div>
  );
}

function RouteError({ error }: { error: unknown }) {
  const { t } = useTranslation('common');

  return (
    <div className="page">
      <ErrorNotice error={error} />
      <Link to="/dashboard">{t('state.backToWardrobe')}</Link>
    </div>
  );
}

const root = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
});
const landing = createRoute({ getParentRoute: () => root, path: '/', component: Landing });
const login = createRoute({
  getParentRoute: () => root,
  path: '/login',
  component: () => <AuthPage mode="login" />,
});
const register = createRoute({
  getParentRoute: () => root,
  path: '/register',
  component: () => <AuthPage mode="register" />,
});
const forgot = createRoute({
  getParentRoute: () => root,
  path: '/forgot-password',
  component: () => <AuthPage mode="forgot" />,
});
const reset = createRoute({
  getParentRoute: () => root,
  path: '/reset-password',
  component: () => <AuthPage mode="reset" />,
});
const privateRoute = createRoute({
  getParentRoute: () => root,
  id: 'authenticated',
  component: () => (
    <Shell>
      <BulkUploadProvider>
        <Outlet />
      </BulkUploadProvider>
    </Shell>
  ),
});
const dashboard = createRoute({
  getParentRoute: () => privateRoute,
  path: '/dashboard',
  component: Dashboard,
});
const catalog = createRoute({
  getParentRoute: () => privateRoute,
  path: '/wardrobe',
  validateSearch: garmentNavigationSearch,
  component: Catalog,
});
const bulkImport = createRoute({
  getParentRoute: () => privateRoute,
  path: '/garments/import',
  component: BulkUploadPage,
});
const newGarment = createRoute({
  getParentRoute: () => privateRoute,
  path: '/garments/new',
  component: () => <GarmentFormPage />,
});
const garment = createRoute({
  getParentRoute: () => privateRoute,
  path: '/garments/$id',
  validateSearch: garmentNavigationSearch,
  component: () => (
    <GarmentDetail id={garment.useParams().id} navigationSearch={garment.useSearch()} />
  ),
});
const edit = createRoute({
  getParentRoute: () => privateRoute,
  path: '/garments/$id/edit',
  component: () => <GarmentFormPage id={edit.useParams().id} />,
});
const outfits = createRoute({
  getParentRoute: () => privateRoute,
  path: '/outfits',
  component: () => <OutfitPage />,
});
const travelPacking = createRoute({
  getParentRoute: () => privateRoute,
  path: '/travel-packing',
  component: TravelPackingPage,
});
const style = createRoute({
  getParentRoute: () => privateRoute,
  path: '/style',
  component: StyleProfilePage,
});
const styleSurvey = createRoute({
  getParentRoute: () => privateRoute,
  path: '/style/survey',
  component: StyleSurveyPage,
});
const saved = createRoute({
  getParentRoute: () => privateRoute,
  path: '/saved',
  component: () => <OutfitPage saved />,
});
const laundry = createRoute({
  getParentRoute: () => privateRoute,
  path: '/laundry',
  component: Laundry,
});
const family = createRoute({
  getParentRoute: () => privateRoute,
  path: '/family',
  component: Family,
});
const settings = createRoute({
  getParentRoute: () => privateRoute,
  path: '/settings',
  component: Settings,
});
const router = createRouter({
  routeTree: root.addChildren([
    landing,
    login,
    register,
    forgot,
    reset,
    privateRoute.addChildren([
      dashboard,
      catalog,
      newGarment,
      bulkImport,
      garment,
      edit,
      outfits,
      travelPacking,
      style,
      styleSurvey,
      saved,
      laundry,
      family,
      settings,
    ]),
  ]),
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const update = registerSW({
  onNeedRefresh() {
    const event = new CustomEvent('wardrobe-update');

    window.dispatchEvent(event);
  },
});

function UpdateNotice() {
  const { t } = useTranslation('common');
  const [available, setAvailable] = React.useState(false);

  React.useEffect(() => {
    const listener = () => setAvailable(true);

    window.addEventListener('wardrobe-update', listener);

    return () => window.removeEventListener('wardrobe-update', listener);
  }, []);

  return available ? (
    <div className="update-notice" role="status">
      {t('update.ready')} <button onClick={() => void update(true)}>{t('update.refresh')}</button>
    </div>
  ) : null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <UpdateNotice />
    </QueryClientProvider>
  </React.StrictMode>,
);
