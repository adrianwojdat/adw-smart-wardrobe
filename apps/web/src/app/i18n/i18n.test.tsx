// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '../../lib/api/client';
import { userErrorMessage } from '../../lib/api/user-error';

import { i18n } from './index';
import { languageStorageKey, resolveAppLanguage } from './types';

function LanguageProbe() {
  const { t } = useTranslation('common');

  return (
    <>
      <label>
        {t('state.loading')}
        <input aria-label="draft" defaultValue="preserve me" />
      </label>
      <span>{t('garments.count', { count: 3 })}</span>
    </>
  );
}

describe('application language', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
    localStorage.removeItem(languageStorageKey);
  });

  it('defaults to English and falls back for unsupported preferences', () => {
    expect(resolveAppLanguage(null)).toBe('en');
    expect(resolveAppLanguage('fr')).toBe('en');
  });

  it.each(['en', 'pl'] as const)(
    'localizes API codes, legacy statuses and validation in %s',
    async (language) => {
      await i18n.changeLanguage(language);

      const t = (key: string) => i18n.t(key, { ns: 'common' });

      expect(
        userErrorMessage(new ApiError(500, 'Internal diagnostic', 'SERVICE_UNAVAILABLE'), t),
      ).toBe(t('errors.server'));
      expect(userErrorMessage(new ApiError(403, 'Private database details'), t)).toBe(
        t('errors.forbidden'),
      );
      expect(userErrorMessage(new ApiError(400, 'Invalid input', 'VALIDATION_FAILED'), t)).toBe(
        t('errors.request'),
      );
      expect(userErrorMessage(new TypeError('fetch failed'), t)).toBe(t('errors.network'));
      expect(i18n.t('required', { ns: 'validation' })).not.toBe('required');
      expect(i18n.t('actions.save', { ns: 'common' })).toBe(language === 'pl' ? 'Zapisz' : 'Save');
    },
  );

  it('switches language immediately, persists it, updates html lang, and preserves form data', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageProbe />
      </I18nextProvider>,
    );
    expect(screen.getByText('Loading')).toBeTruthy();

    const input = screen.getByLabelText<HTMLInputElement>('draft');

    await i18n.changeLanguage('pl');
    expect(screen.getByText('Ładowanie')).toBeTruthy();
    expect(input.value).toBe('preserve me');
    expect(localStorage.getItem(languageStorageKey)).toBe('pl');
    expect(document.documentElement.lang).toBe('pl');
    expect(screen.getByText('3 ubrania')).toBeTruthy();
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
