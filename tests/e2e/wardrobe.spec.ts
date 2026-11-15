import { expect, test } from '@playwright/test';
import path from 'node:path';

test('registration → login → wardrobe → upload → catalog → details', async ({ page }, info) => {
  test.skip(
    process.env.E2E_ALLOW_WRITES !== '1' || process.env.E2E_ISOLATED_STACK !== '1',
    'Wymaga jawnej zgody i odizolowanego stacku testowego z cyklem sprzątania.',
  );
  await page.addInitScript(() => localStorage.setItem('smart-wardrobe-language', 'pl'));

  const suffix = `${Date.now()}-${info.project.name}`;
  const email = `e2e-${suffix}@example.com`;
  const password = 'Smart-Wardrobe-Test-2026!';

  await page.goto('/register');
  await page.getByLabel('Jak masz na imię?').fill('Test garderoby');
  await page.getByLabel('Adres email').fill(email);
  await page.getByLabel('Hasło', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Utwórz konto', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Otwórz menu' }).click();
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Adres email').fill(email);
  await page.getByLabel('Hasło', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole('button', { name: 'Utwórz garderobę', exact: true }).first().click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Nazwa garderoby').fill('Moja szafa E2E');
  await dialog.getByRole('button', { name: 'Utwórz garderobę', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Dodaj ubranie', exact: true }).first().click();
  await page.getByLabel('Nazwa (opcjonalna)', { exact: true }).fill('Koszulka E2E');
  await page.getByLabel('Marka', { exact: true }).fill('Test');
  await page
    .getByLabel('Zdjęcia ubrania', { exact: true })
    .setInputFiles(path.resolve('apps/web/public/icon-192.png'));
  await page.getByRole('button', { name: 'Zapisz ubranie' }).click();
  await expect(page.getByRole('heading', { name: 'Koszulka E2E', exact: true })).toBeVisible();
  await expect(page.locator('.detail-photo img')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.detail-photo img').evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Twoja garderoba', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Koszulka E2E', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Koszulka E2E', exact: true }).click();
  await expect(page.locator('.detail-title')).toHaveText('Koszulka E2E');
  await expect
    .poll(() => page.locator('body').evaluate((el) => el.scrollWidth <= window.innerWidth))
    .toBe(true);
});
test('public landing and protected routes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smart-wardrobe-language', 'pl'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Mniej szukania/ })).toBeVisible();
  await page.goto('/wardrobe');
  await expect(page).toHaveURL(/login/);
});
