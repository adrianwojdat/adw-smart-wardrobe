import { expect, test } from '@playwright/test';

import {
  garmentSchema,
  packingInputSchema,
  packingItemSchema,
  type PackingList,
  tripSchema,
} from '../../packages/shared/src/index.ts';

test.use({ serviceWorkers: 'block' });
for (const language of ['en', 'pl'] as const)
  test(`packing persists assignments and progress (${language})`, async ({ page }) => {
    const id = 'a7000000-0000-4000-8000-000000000001';
    const garment = garmentSchema.parse({
      id: 'a7000000-0000-4000-8000-000000000002',
      wardrobe_id: id,
      owner_id: id,
      name: 'Real T-shirt',
      category: 'tops',
      created_at: '2026-11-14',
      updated_at: '2026-11-14',
    });
    const item = packingItemSchema.parse({
      id: 'a7000000-0000-4000-8000-000000000003',
      category: 'tops',
      name: 'T-shirts',
      quantity: 10,
      description: '',
      weather_dependent: false,
      match_wardrobe: true,
      subcategory: '',
      seasons: [],
      warmth: null,
      material: '',
      style: '',
      occasion: '',
      assigned: [],
      packed: 0,
    });
    let lists: PackingList[] = [];
    let generated = 0;

    await page.addInitScript(
      (lang) => localStorage.setItem('smart-wardrobe-language', lang),
      language,
    );
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const req = route.request(),
          path = new URL(req.url()).pathname;
        const json = (data: unknown, status = 200) =>
          route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

        if (path === '/api/auth/me')
          return json({ id, email: 'packing@example.invalid', name: 'Test' });
        if (path === '/api/wardrobes')
          return json([
            { id, owner_id: id, name: 'Wardrobe', kind: 'private', created_at: '2026-11-14' },
          ]);
        if (path === '/api/auth/csrf') return json({ token: 'packing-csrf' });

        if (path === '/api/travel-packing/generate') {
          generated++;

          const body = tripSchema.parse(req.postDataJSON());

          expect(body).toMatchObject({ destination: 'Japonia', days: 10, language });

          return json(
            {
              id,
              kind: 'travel_packing',
              status: 'queued',
              result: null,
              error_code: null,
              error_message: null,
              created_at: '2026-11-14',
              updated_at: '2026-11-14',
            },
            202,
          );
        }

        if (path === `/api/gemini/tasks/${id}`)
          return json({
            id,
            kind: 'travel_packing',
            status: 'completed',
            result: { items: [item] },
            error_code: null,
            error_message: null,
            created_at: '2026-11-14',
            updated_at: '2026-11-14',
          });
        if (path === '/api/travel-packing')
          return json(lists.map((list) => ({ ...list, user_id: id, wardrobe_id: id })));
        if (path.endsWith('/recommendations'))
          return json({ wardrobe_count: 1, items: { [item.id]: [garment] } });

        if (path.startsWith('/api/travel-packing/') && req.method() === 'PUT') {
          const saved = {
            ...packingInputSchema.parse(req.postDataJSON()),
            id: path.split('/').pop()!,
            updated_at: '2026-11-14',
          };

          lists = [saved];

          return json({ ...saved, user_id: id, wardrobe_id: id });
        }

        return json({ message: 'Unexpected mock request' }, 404);
      },
    );
    await page.goto('/travel-packing');
    await expect(
      page.getByRole('button', { name: language === 'en' ? /Saved lists/ : /Zapisane listy/ }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/travel-planner-${language}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByLabel(language === 'en' ? 'Destination' : 'Cel podróży').fill('Japonia');
    await page.getByLabel(language === 'en' ? 'Number of days' : 'Liczba dni').fill('10');
    await page
      .getByRole('button', {
        name: language === 'en' ? 'Generate packing list' : 'Wygeneruj listę',
        exact: true,
      })
      .click();
    await expect(page.getByText('T-shirts', { exact: true })).toBeVisible();
    await page.locator('summary').click();
    await page.getByLabel('Real T-shirt').check();
    await page.getByLabel(language === 'en' ? 'Packed' : 'Spakowano', { exact: true }).fill('1');
    await page
      .getByRole('button', { name: language === 'en' ? 'Save list' : 'Zapisz listę', exact: true })
      .click();
    await expect.poll(() => lists[0]?.items[0]?.packed).toBe(1);
    await page.reload();
    await page
      .getByRole('button', { name: language === 'en' ? /Saved lists/ : /Zapisane listy/ })
      .click();
    await page.screenshot({
      path: `/tmp/travel-saved-${language}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Japonia', exact: true }).click();
    await expect(
      page.getByLabel(language === 'en' ? 'Packed' : 'Spakowano', { exact: true }),
    ).toHaveValue('1');
    await page.locator('summary').click();
    await expect(page.getByLabel('Real T-shirt')).toBeChecked();
    expect(generated).toBe(1);
  });

test('complete baseline fallback is grouped, editable and preserves progress', async ({
  page,
}, info) => {
  const { buildBasePackingList } = await import('../../packages/shared/src/index.ts');
  const id = 'a7100000-0000-4000-8000-000000000001';
  const trip = tripSchema.parse({
    wardrobe_id: id,
    destination: 'Japan',
    days: 10,
    departure: '2026-11-16',
    activity: 'mixed',
    laundry: false,
    light: false,
    notes: '',
    language: 'en',
  });
  const items = buildBasePackingList(trip).map((i) => ({
    ...i,
    generation_source: 'fallback' as const,
  }));
  let lists: PackingList[] = [];

  await page.addInitScript(() => localStorage.setItem('smart-wardrobe-language', 'en'));
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      const json = (body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/auth/me')
        return json({ id, email: 'baseline@example.invalid', name: 'Test' });
      if (path === '/api/wardrobes')
        return json([
          { id, owner_id: id, name: 'Wardrobe', kind: 'private', created_at: '2026-11-14' },
        ]);
      if (path === '/api/auth/csrf') return json({ token: 'test-csrf' });
      if (path === '/api/travel-packing/generate' || path === `/api/gemini/tasks/${id}`)
        return json({
          id,
          kind: 'travel_packing',
          status: path.endsWith('generate') ? 'queued' : 'completed',
          result: path.endsWith('generate') ? null : { items },
          error_code: null,
          error_message: null,
          created_at: '2026-11-14',
          updated_at: '2026-11-14',
        });
      if (path === '/api/travel-packing')
        return json(lists.map((list) => ({ ...list, user_id: id, wardrobe_id: id })));
      if (path.endsWith('/recommendations')) return json({ wardrobe_count: 0, items: {} });

      if (path.startsWith('/api/travel-packing/') && req.method() === 'PUT') {
        const saved = {
          ...packingInputSchema.parse(req.postDataJSON()),
          id: path.split('/').pop()!,
          updated_at: '2026-11-14',
        };

        lists = [saved];

        return json({ ...saved, user_id: id, wardrobe_id: id });
      }

      return route.fulfill({ status: 404, body: 'Unexpected test request' });
    },
  );
  await page.goto('/travel-packing');
  await page.getByLabel('Destination').fill('Japan');
  await page.getByRole('button', { name: 'Generate packing list', exact: true }).click();
  await expect(page.getByText(/This is a deterministic baseline/)).toBeVisible();
  for (const section of [
    'Underwear and socks',
    'Clothes',
    'Footwear',
    'Hygiene',
    'Electronics',
    'Documents',
    'Health',
  ])
    await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible();
  for (const name of [
    'Underpants',
    'Short socks',
    'Long socks',
    'T-shirts',
    'Shirts',
    'Long trousers',
    'Sweatshirts',
    'Pyjamas',
    'Toothbrush',
    'Toothpaste',
  ])
    await expect(page.locator('article').getByText(name, { exact: true })).toBeVisible();

  const briefs = page
    .locator('article')
    .filter({ has: page.getByText('Underpants', { exact: true }) });

  await briefs.getByLabel('Packed', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Save list', exact: true }).click();
  await expect.poll(() => lists[0]?.items.find((i) => i.packing_key === 'briefs')?.packed).toBe(3);
  await page.reload();
  await page.getByRole('button', { name: /Saved lists/ }).click();
  await page.getByRole('button', { name: 'Japan', exact: true }).click();
  await expect(briefs.getByLabel('Packed', { exact: true })).toHaveValue('3');
  await expect(page.getByText(/This is a deterministic baseline/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `/tmp/travel-complete-${info.project.name}.png`, fullPage: true });
});
