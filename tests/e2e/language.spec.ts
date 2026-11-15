import { expect, test } from '@playwright/test';

test('English is the default on first visit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: /Less searching/i })).toBeVisible();
});

test('the settings selector switches language and remembers Polish', async ({ page }) => {
  const email = process.env.E2E_LANGUAGE_EMAIL;
  const password = process.env.E2E_LANGUAGE_PASSWORD;

  test.skip(
    !email || !password,
    'Requires an isolated development test account in E2E_LANGUAGE_EMAIL/PASSWORD.',
  );

  await page.goto('/login');
  await page.getByLabel('Email address').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'Application language' }).selectOption('pl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.getByRole('heading', { name: 'Profil i ustawienia' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});
