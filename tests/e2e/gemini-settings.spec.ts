import { expect, test } from '@playwright/test';

import { captureUiScreen } from './ui-screenshot.ts';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smart-wardrobe-language', 'pl'));
});

test('stores a Gemini key without displaying it and tests a selected API model', async ({
  page,
}, testInfo) => {
  const userId = 'a7000000-0000-4000-8000-000000000031';
  const apiKey = 'AIzaSy_example-user-owned-test-key-123456789';
  const settings = {
    configured: false,
    key_hint: null as string | null,
    model: null as string | null,
    rpm_limit: 12,
    queue_limit: 100,
    active_task: null as Record<string, unknown> | null,
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/auth/me')
      return json({ id: userId, email: 'gemini@test.invalid', name: 'Test' });
    if (path === '/api/auth/csrf') return json({ token: 'gemini-test-token' });
    if (path === '/api/wardrobes' || path === '/api/analysis/activity') return json([]);
    if (path === '/api/preferences/ai') return json({ ai_overwrite_metadata: false });
    if (path === '/api/config')
      return json({ smtpConfigured: false, emailConfirmation: false, manualAnalysis: true });
    if (path === '/api/gemini/settings' && request.method() === 'GET') return json(settings);

    if (path === '/api/gemini/settings' && request.method() === 'PUT') {
      const body = request.postDataJSON() as { apiKey: string };

      expect(body.apiKey).toBe(apiKey);
      settings.configured = true;
      settings.key_hint = apiKey.slice(-4);

      return json({ configured: true, key_hint: settings.key_hint, model: settings.model });
    }

    if (path === '/api/gemini/settings/model' && request.method() === 'PATCH') {
      settings.model = (request.postDataJSON() as { model: string }).model;

      return json({ configured: true, key_hint: settings.key_hint, model: settings.model });
    }

    if (path === '/api/gemini/tasks' && request.method() === 'POST') {
      const kind = (request.postDataJSON() as { kind: string }).kind;

      settings.active_task = {
        id: 'a7000000-0000-4000-8000-000000000032',
        kind,
        status: 'completed',
        result:
          kind === 'list_models'
            ? { models: [{ name: 'models/gemini-example', displayName: 'Gemini example' }] }
            : { message: 'The Gemini connection is working.' },
        error_code: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return json(settings.active_task);
    }

    return json({ message: `Unexpected mock request ${request.method()} ${path}` }, 404);
  });

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /Gemini AI/ })).toBeVisible();
  await captureUiScreen(page, testInfo, 'ustawienia-gemini');

  const settingsLabels = page.locator('.settings-grid > label');

  for (const index of [0, 1]) {
    const label = settingsLabels.nth(index);
    const control = label.locator(index === 0 ? 'input' : 'select');

    await expect(control).toHaveCSS('display', 'block');
    expect(
      await control.evaluate(
        (el) =>
          Math.abs(
            el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width,
          ) < 2,
      ),
    ).toBe(true);
  }

  await page.getByLabel('Klucz Gemini API').fill(apiKey);
  await page.getByRole('button', { name: 'Zapisz klucz' }).click();
  await expect(page.getByText(/Klucz zapisany i zaszyfrowany/)).toBeVisible();
  await expect(page.getByLabel('Klucz Gemini API')).toHaveValue('');
  await page.getByRole('button', { name: /Pobierz dostępne modele/ }).click();
  await page.getByLabel('Model Gemini').selectOption('models/gemini-example');
  await page.getByRole('button', { name: 'Zapisz model' }).click();
  await page.getByRole('button', { name: 'Sprawdź połączenie' }).click();
  await expect(page.getByText('Połączenie z Gemini działa.')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(apiKey);
  await expect(page.getByLabel('Klucz Gemini API')).toHaveAttribute(
    'placeholder',
    `Klucz Gemini API ····${apiKey.slice(-4)}`,
  );
});
