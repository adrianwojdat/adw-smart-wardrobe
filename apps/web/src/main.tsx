import React from 'react';
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
import { Landing, AuthPage } from './auth';
import { Shell, ErrorNotice } from './context';
import { Dashboard, Catalog } from './catalog';
import { GarmentDetail, GarmentFormPage } from './garments';
import { Family, Laundry, OutfitPage, Settings } from './other-pages';
import './styles.css';
import { BulkUploadProvider, BulkUploadPage } from './bulk-upload';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true } },
});
const root = createRootRoute({
  component: () => (
    <>
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <Outlet />
    </>
  ),
  notFoundComponent: () => (
    <div className="page">
      <h1>Nie ma tu tej strony.</h1>
      <Link to="/dashboard">Wróć do garderoby</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="page">
      <ErrorNotice error={error} />
      <Link to="/dashboard">Wróć do garderoby</Link>
    </div>
  ),
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
  component: () => <GarmentDetail id={garment.useParams().id} />,
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
  const [available, setAvailable] = React.useState(false);
  React.useEffect(() => {
    const listener = () => setAvailable(true);
    window.addEventListener('wardrobe-update', listener);
    return () => window.removeEventListener('wardrobe-update', listener);
  }, []);
  return available ? (
    <div className="update-notice" role="status">
      Nowa wersja jest gotowa. <button onClick={() => void update(true)}>Odśwież aplikację</button>
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
