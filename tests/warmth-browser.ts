/** UI-only regression using synthetic records and a mocked API. */
import { chromium, expect } from '@playwright/test';

import { garmentSchema } from '../packages/shared/src/index.ts';

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const owner = '00000000-0000-4000-8000-000000000001',
    wardrobe = '00000000-0000-4000-8000-000000000010',
    id = '00000000-0000-4000-8000-000000000020';
  let garment = garmentSchema.parse({
    id,
    wardrobe_id: wardrobe,
    owner_id: owner,
    name: 'Biała koszulka polo',
    category: 'tops',
    subcategory: 'Koszulka polo',
    warmth: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  let saved: Record<string, unknown> | undefined;

  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    let data: unknown = [];

    if (path === '/api/auth/me') data = { id: owner, email: 'test@example.invalid', name: 'Test' };
    if (path === '/api/auth/csrf') data = { token: 'test' };
    if (path === '/api/wardrobes')
      data = [
        {
          id: wardrobe,
          owner_id: owner,
          name: 'Test',
          kind: 'private',
          created_at: new Date().toISOString(),
        },
      ];
    if (path === '/api/config') data = { smtpConfigured: false, emailConfirmation: false };

    if (path === `/api/garments/${id}`) {
      if (req.method() === 'PATCH') {
        saved = req.postDataJSON();
        garment = garmentSchema.parse({ ...garment, ...saved });
      }

      data = garment;
    }

    if (path === '/api/recommendations') data = { source: 'rules', outfits: [] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });

  const origin = process.env.TEST_ORIGIN ?? 'http://127.0.0.1:4173';

  await page.goto(origin + '/garments/new');

  const warmth = page.getByRole('spinbutton', { name: /Ciepło/ });

  await expect(warmth).toHaveValue('1');
  await page.getByLabel('Podkategoria', { exact: true }).fill('Koszulka polo');
  await expect(warmth).toHaveValue('2');
  await page.getByLabel('Podkategoria', { exact: true }).fill('');
  await page.getByRole('combobox', { name: /^Kategoria/ }).selectOption('outerwear');
  await expect(warmth).toHaveValue('4');
  await page.getByLabel('Podkategoria', { exact: true }).fill('Kurtka zimowa');
  await expect(warmth).toHaveValue('5');
  await page.getByRole('combobox', { name: /^Kategoria/ }).selectOption('accessories');
  await expect(page.getByRole('spinbutton', { name: /nie dotyczy/ })).toBeDisabled();
  await page.goto(origin + `/garments/${id}/edit`);
  await expect(warmth).toHaveValue('2');
  await warmth.fill('3');
  await page.getByLabel('Podkategoria', { exact: true }).fill('Kurtka zimowa');
  await page.getByRole('combobox', { name: /^Kategoria/ }).selectOption('outerwear');
  await expect(warmth).toHaveValue('3');
  await page.getByRole('button', { name: 'Zapisz ubranie', exact: true }).click();
  await expect.poll(() => saved?.warmth).toBe(3);
  expect(saved?.warmth_manual).toBe(true);
  await page.goto(origin + `/garments/${id}/edit`);
  await expect(warmth).toHaveValue('3');
  await page.getByLabel('Podkategoria', { exact: true }).fill('T-shirt');
  await page.getByRole('combobox', { name: /^Kategoria/ }).selectOption('tops');
  await expect(warmth).toHaveValue('1');
  console.log(
    'PASS: new/default and analysed warmth, category changes, accessories, manual override saved and retained.',
  );
} finally {
  await browser.close();
}
