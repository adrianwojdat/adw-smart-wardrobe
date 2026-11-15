import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import authEn from '../../features/auth/locales/en.json';
import authPl from '../../features/auth/locales/pl.json';
import bulkUploadEn from '../../features/bulk-upload/locales/en.json';
import bulkUploadPl from '../../features/bulk-upload/locales/pl.json';
import catalogEn from '../../features/catalog/locales/en.json';
import catalogPl from '../../features/catalog/locales/pl.json';
import dashboardEn from '../../features/dashboard/locales/en.json';
import dashboardPl from '../../features/dashboard/locales/pl.json';
import familyEn from '../../features/family/locales/en.json';
import familyPl from '../../features/family/locales/pl.json';
import garmentsEn from '../../features/garments/locales/en.json';
import garmentsPl from '../../features/garments/locales/pl.json';
import imageAnalysisEn from '../../features/image-analysis/locales/en.json';
import imageAnalysisPl from '../../features/image-analysis/locales/pl.json';
import laundryEn from '../../features/laundry/locales/en.json';
import laundryPl from '../../features/laundry/locales/pl.json';
import outfitsEn from '../../features/outfits/locales/en.json';
import outfitsPl from '../../features/outfits/locales/pl.json';
import settingsEn from '../../features/settings/locales/en.json';
import settingsPl from '../../features/settings/locales/pl.json';
import styleProfileEn from '../../features/style-profile/locales/en.json';
import styleProfilePl from '../../features/style-profile/locales/pl.json';
import travelPackingEn from '../../features/travel-packing/locales/en.json';
import travelPackingPl from '../../features/travel-packing/locales/pl.json';
import commonEn from '../../locales/en/common.json';
import navigationEn from '../../locales/en/navigation.json';
import validationEn from '../../locales/en/validation.json';
import commonPl from '../../locales/pl/common.json';
import navigationPl from '../../locales/pl/navigation.json';
import validationPl from '../../locales/pl/validation.json';

import { isAppLanguage, languageStorageKey, resolveAppLanguage } from './types';

const savedLanguage =
  typeof window === 'undefined' ? null : window.localStorage.getItem(languageStorageKey);

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      travelPacking: travelPackingEn,
      common: commonEn,
      validation: validationEn,
      navigation: navigationEn,
      settings: settingsEn,
      auth: authEn,
      catalog: catalogEn,
      dashboard: dashboardEn,
      bulkUpload: bulkUploadEn,
      garments: garmentsEn,
      family: familyEn,
      laundry: laundryEn,
      styleProfile: styleProfileEn,
      outfits: outfitsEn,
      imageAnalysis: imageAnalysisEn,
    },
    pl: {
      travelPacking: travelPackingPl,
      common: commonPl,
      validation: validationPl,
      navigation: navigationPl,
      settings: settingsPl,
      auth: authPl,
      catalog: catalogPl,
      dashboard: dashboardPl,
      bulkUpload: bulkUploadPl,
      garments: garmentsPl,
      family: familyPl,
      laundry: laundryPl,
      styleProfile: styleProfilePl,
      outfits: outfitsPl,
      imageAnalysis: imageAnalysisPl,
    },
  },
  lng: resolveAppLanguage(savedLanguage),
  fallbackLng: 'en',
  supportedLngs: ['en', 'pl'],
  load: 'languageOnly',
  defaultNS: 'common',
  ns: [
    'travelPacking',
    'common',
    'validation',
    'navigation',
    'settings',
    'auth',
    'catalog',
    'dashboard',
    'bulkUpload',
    'garments',
    'family',
    'laundry',
    'styleProfile',
    'outfits',
    'imageAnalysis',
  ],
  interpolation: { escapeValue: false },
  initAsync: false,
});

i18n.on('languageChanged', (language) => {
  const active = isAppLanguage(language) ? language : 'en';

  if (typeof window !== 'undefined') window.localStorage.setItem(languageStorageKey, active);
  if (typeof document !== 'undefined') document.documentElement.lang = active;

  if (typeof document !== 'undefined') {
    document.title = 'Smart Wardrobe';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', i18n.t('meta.description', { ns: 'common', lng: active }));
  }
});

if (typeof document !== 'undefined') {
  const active = isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';

  document.documentElement.lang = active;
  document.title = 'Smart Wardrobe';
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', i18n.t('meta.description', { ns: 'common', lng: active }));
}

export { i18n };
