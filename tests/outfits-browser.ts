/** Browser regression: empty recommendation response must give actionable feedback. No data writes. */
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const id = '00000000-0000-4000-8000-000000000001';
  let requests = 0;

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/auth/me'
        ? { id, email: 'test@example.com', name: 'Test' }
        : path === '/api/wardrobes'
          ? [
              {
                id,
                owner_id: id,
                name: 'Test',
                kind: 'private',
                created_at: new Date().toISOString(),
              },
            ]
          : path === '/api/auth/csrf'
            ? { token: 'test' }
            : path === '/api/recommendations'
              ? (requests++, { source: 'rules', outfits: [] })
              : [];

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('http://localhost:8080/outfits');
  await page.getByRole('button', { name: 'Zaproponuj zestawy' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nie znaleziono pasujących zestawów' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sprawdź kategorie w garderobie' })).toBeVisible();
  expect(requests).toBe(1);
  console.log('PASS: empty recommendation feedback and wardrobe link');
} finally {
  await browser.close();
}
