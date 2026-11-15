import { Link } from '@tanstack/react-router';
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Plus,
  Settings,
  Shirt,
  Sparkles,
  Users,
  WashingMachine,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Wardrobe } from '@wardrobe/shared';

import { WardrobePicker } from './wardrobe-picker';

const navigation = [
  { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/wardrobe', key: 'wardrobe', icon: Shirt },
  { to: '/outfits', key: 'outfits', icon: Sparkles },
  { to: '/travel-packing', key: 'travelPacking', icon: Shirt },
  { to: '/style', key: 'style', icon: Palette },
  { to: '/saved', key: 'saved', icon: Heart },
  { to: '/laundry', key: 'laundry', icon: WashingMachine },
  { to: '/family', key: 'family', icon: Users },
] as const;

export function AppSidebar({
  wardrobe,
  wardrobes,
  userName,
  mobileOpen,
  onChooseWardrobe,
  onCreateWardrobe,
  onCloseMobile,
  onLogout,
}: {
  wardrobe?: Wardrobe;
  wardrobes: Wardrobe[];
  userName?: string;
  mobileOpen: boolean;
  onChooseWardrobe: (id: string) => void;
  onCreateWardrobe: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation('navigation');

  return (
    <aside className={'sidebar ' + (mobileOpen ? 'sidebar-open' : '')}>
      <Link to="/dashboard" className="brand">
        <span className="brand-mark">
          <Shirt size={22} strokeWidth={1.5} />
        </span>
        <span>
          smart<span className="brand-light">wardrobe</span>
          <small>{t('brandTagline')}</small>
        </span>
      </Link>
      <button className="mobile-close" aria-label={t('closeMenu')} onClick={onCloseMobile}>
        <X />
      </button>
      <div className="wardrobe-switch">
        <label htmlFor="active-wardrobe">{t('wardrobeLabel')}</label>
        <div className="wardrobe-switch-controls">
          <WardrobePicker
            wardrobes={wardrobes}
            selectedId={wardrobe?.id ?? ''}
            onSelect={onChooseWardrobe}
          />
          <button
            className="wardrobe-create-button"
            aria-label={t('createWardrobe')}
            title={t('createWardrobe')}
            onClick={onCreateWardrobe}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
      <div className="sidebar-nav">
        <nav aria-label={t('main')}>
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav-item"
              activeProps={{ className: 'nav-item active' }}
              onClick={onCloseMobile}
            >
              <item.icon size={19} strokeWidth={1.6} />
              {t(item.key)}
              {item.to === '/outfits' && <span className="tiny-tag">{t('forYou')}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">{t('sidebarEyebrow')}</span>
          <p>{t('sidebarNote')}</p>
          <span className="note-line" />
        </div>
        <Link className="nav-item settings-link" to="/settings" onClick={onCloseMobile}>
          <Settings size={19} />
          {t('settings')}
        </Link>
      </div>
      <div className="user-block">
        <span className="avatar">{userName?.[0]?.toUpperCase() || 'S'}</span>
        <div>
          <strong>{userName || 'Twoje konto'}</strong>
          <small>{t('privateSpace')}</small>
        </div>
        <button aria-label={t('logout')} title={t('logout')} onClick={onLogout}>
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}

export function BottomNavigation() {
  const { t } = useTranslation('navigation');

  return (
    <nav className="bottom-nav" aria-label={t('mobile')}>
      {navigation.slice(0, 3).map((item) => (
        <Link key={item.to} to={item.to} activeProps={{ className: 'active' }}>
          <item.icon size={21} />
          <span>{t(item.to === '/wardrobe' ? 'wardrobe' : item.key)}</span>
        </Link>
      ))}
      <Link to="/laundry">
        <WashingMachine size={21} />
        <span>{t('care')}</span>
      </Link>
    </nav>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('navigation');

  return (
    <button className="mobile-menu" aria-label={t('openMenu')} onClick={onClick}>
      <Menu />
    </button>
  );
}
