/** Isolated browser verification; mocked API, no database writes or AI inference. Run against vite preview on :4173. */
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { garmentInput } from '../packages/shared/src/index.ts';

const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const owner = randomUUID(),
    wardrobe = randomUUID();
  const records = new Map<string, Record<string, unknown>>();
  let failOnce = true;
  const creates: string[] = [],
    uploads: string[] = [];

  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const send = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (url.pathname === '/api/auth/me')
      return send({ id: owner, email: 'test@example.com', name: 'Test' });
    if (url.pathname === '/api/auth/csrf') return send({ token: 'test' });
    if (url.pathname === '/api/wardrobes')
      return send([
        {
          id: wardrobe,
          owner_id: owner,
          name: 'Test importu',
          kind: 'private',
          created_at: new Date().toISOString(),
        },
      ]);
    if (url.pathname === '/api/garments' && req.method() === 'GET')
      return send([...records.values()]);

    if (url.pathname === '/api/garments' && req.method() === 'POST') {
      const body = req.postDataJSON();

      creates.push(body.id);
      if (!records.has(body.id))
        records.set(body.id, {
          ...garmentInput.parse(body),
          id: body.id,
          owner_id: owner,
          name: 'Ubranie ' + body.id,
          name_source: 'temporary',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          garment_images: [],
        });

      return send(records.get(body.id));
    }

    if (url.pathname.endsWith('/images')) {
      const id = url.pathname.split('/')[3]!;

      uploads.push(id);

      if (failOnce) {
        failOnce = false;

        return send({ message: 'Simulated upload failure' }, 503);
      }

      const image = {
        id: url.searchParams.get('upload_id'),
        garment_id: id,
        wardrobe_id: wardrobe,
        path: 'private.original',
        original_path: 'private.original',
        original_mime: 'image/png',
        kind: 'garment',
        width: 1,
        height: 1,
        created_at: new Date().toISOString(),
        cutout_path: 'private.png',
        catalog_path: 'private.webp',
        thumbnail_path: 'thumb.webp',
        revision: 0,
        rotation: null,
        process_status: 'completed',
        stage: 'Gotowe',
        pipeline_version: 'test',
        processing_error: null,
        orientation: null,
        analysis: null,
      };

      records.get(id)!.garment_images = [image];

      return send(image);
    }

    return send([]);
  });
  await page.goto((process.env.BULK_TEST_ORIGIN ?? 'http://127.0.0.1:4173') + '/wardrobe');
  await page.getByRole('link', { name: 'Dodaj wiele ubrań' }).first().click();

  const input = page.getByLabel('Zdjęcia wielu ubrań');
  const photo = (i: number) => ({
    name: `ubranie-${i}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from('test'),
  });

  await input.setInputFiles(Array.from({ length: 201 }, (_, i) => photo(i)));
  await expect(page.getByRole('alert')).toContainText('Maksymalnie 200');
  expect(records.size).toBe(0);
  await input.setInputFiles([photo(1), photo(2), photo(3), photo(4)]);
  await page.getByRole('link', { name: 'Przegląd', exact: true }).first().click();
  await page.getByRole('link', { name: /Zobacz postęp/ }).click();
  await expect(page.getByRole('button', { name: 'Wyczyść listę importu' })).toBeEnabled({
    timeout: 15000,
  });
  await expect(page.getByRole('button', { name: 'Ponów przesyłanie' })).toHaveCount(1);
  expect(records.size).toBe(4);
  await page.getByRole('button', { name: 'Ponów przesyłanie' }).click();
  await expect(page.getByRole('button', { name: 'Ponów przesyłanie' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Otwórz ubranie' })).toHaveCount(4);
  expect(records.size).toBe(4);
  expect(creates.length).toBe(5);
  expect(new Set(uploads).size).toBe(4);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/wardrobe-bulk-mobile.png', fullPage: true });
  console.log(
    'PASS: 201 rejected; independent files and failure retry; navigation preserves batch; four records after retry; mobile has no horizontal overflow. No database/AI calls.',
  );
} finally {
  await browser.close();
}
