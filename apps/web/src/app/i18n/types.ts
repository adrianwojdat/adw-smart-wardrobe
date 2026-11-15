const supportedLanguages = ['en', 'pl'] as const;

export type AppLanguage = (typeof supportedLanguages)[number];

export const languageStorageKey = 'smart-wardrobe-language';

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return supportedLanguages.some((language) => language === value);
}

export function resolveAppLanguage(value: string | null | undefined): AppLanguage {
  return isAppLanguage(value) ? value : 'en';
}
