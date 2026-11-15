import { expect, test } from '@playwright/test';

import { captureUiScreen } from './ui-screenshot.ts';

test.use({ serviceWorkers: 'block' });

for (const rememberMe of [true, false])
  test(`login uses the BFF session (remember=${rememberMe})`, async ({ page }, testInfo) => {
    let authenticated = false;
    const user = {
      id: 'a7000000-0000-4000-8000-000000000041',
      email: 'ada@test.invalid',
      name: 'Ada',
    };

    await page.addInitScript(() => localStorage.setItem('smart-wardrobe-language', 'pl'));
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const json = (body: unknown, status = 200) =>
          route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

        if (path === '/api/auth/csrf') return json({ token: 'auth-test-csrf' });

        if (path === '/api/auth/login' && request.method() === 'POST') {
          expect(request.postDataJSON()).toEqual({
            email: 'ada@test.invalid',
            password: 'test-password',
            rememberMe,
          });
          authenticated = true;

          return json(user);
        }

        if (path === '/api/auth/me')
          return authenticated ? json(user) : json({ message: 'Unauthorized' }, 401);
        if (path === '/api/wardrobes') return json([]);
        if (path === '/api/profile/style')
          return json({
            schema_version: 1,
            answers: {},
            skipped: [],
            hard_constraints: {
              avoid_fits: [],
              office_avoid: [],
              date_avoid: [],
              avoid_visuals: [],
              bans: {
                sneakers_with_suit: false,
                blazer_with_tshirt: false,
                hoodie_under_blazer: false,
              },
            },
          });

        return json({ message: `Unexpected mock request ${request.method()} ${path}` }, 404);
      },
    );

    await page.goto('/login');
    await expect(page.getByRole('checkbox', { name: 'Zapamiętaj mnie' })).toBeChecked();
    if (!rememberMe) await page.getByRole('checkbox', { name: 'Zapamiętaj mnie' }).uncheck();
    await captureUiScreen(page, testInfo, `remember-login-${rememberMe}`);
    await page.getByLabel('Adres email').fill('ada@test.invalid');
    await page.getByLabel('Hasło').fill('test-password');
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(page.getByRole('heading', { name: 'Cześć, Ada.' })).toBeVisible();
    await captureUiScreen(page, testInfo, 'logowanie-i-dashboard');
  });
