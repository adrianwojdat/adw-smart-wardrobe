/** Exercises the deployed UI with a mocked API; never submits actual AI jobs. */
import { chromium, expect } from '@playwright/test';
import { garmentSchema } from '../packages/shared/src/index';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const id = '11111111-1111-4111-8111-111111111111';
  const owner = '00000000-0000-4000-8000-000000000001';
  const garmentId = '44444444-4444-4444-8444-444444444444';
  const photoId = '22222222-2222-4222-8222-222222222222';
  const now = new Date().toISOString();
  const garment = garmentSchema.parse({
    id: garmentId,
    wardrobe_id: id,
    owner_id: owner,
    name: 'Test',
    category: 'tops',
    created_at: now,
    updated_at: now,
    garment_images: [
      {
        id: photoId,
        garment_id: garmentId,
        wardrobe_id: id,
        path: 'test.jpg',
        original_path: 'test.jpg',
        original_mime: 'image/jpeg',
        kind: 'garment',
        width: 100,
        height: 100,
        created_at: now,
        cutout_path: null,
        catalog_path: null,
        thumbnail_path: null,
        revision: 0,
        rotation: 90,
        process_status: 'completed',
        stage: 'Gotowe',
        pipeline_version: null,
        processing_error: null,
        orientation: null,
        analysis: null,
      },
    ],
  });
  let calls = 0;
  let active = false;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    let data: unknown = [];
    if (path === '/api/auth/me') data = { id: owner, email: 'test@example.com', name: 'Test' };
    if (path === '/api/wardrobes')
      data = [
        {
          id,
          owner_id: owner,
          name: 'Szafa testowa',
          kind: 'private',
          created_at: new Date().toISOString(),
        },
      ];
    if (path === '/api/analysis/activity')
      data = active
        ? [
            {
              wardrobe_id: id,
              image_id: '22222222-2222-4222-8222-222222222222',
              queued: 14,
              processing: 1,
            },
          ]
        : [];
    if (path === '/api/config')
      data = { smtpConfigured: true, emailConfirmation: true, manualAnalysis: true };
    if (path === `/api/garments/${garmentId}`) data = garment;
    if (path === '/api/recommendations') data = { source: 'rules', outfits: [] };
    if (path === '/api/auth/csrf') data = { token: 'test' };
    if (path === `/api/wardrobes/${id}/analyze`) {
      expect(req.method()).toBe('POST');
      calls++;
      if (calls === 1) await gate;
      active = true;
      data =
        calls === 1
          ? { queued: 12, pending: 3, missing: 1 }
          : { queued: 0, pending: 15, missing: 1 };
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('http://localhost:8080/settings');
  const button = page.getByRole('button', {
    name: 'Ponów analizę AI wszystkich ubrań',
    exact: true,
  });
  await button.click();
  await expect(page.getByRole('button', { name: 'Zlecanie analizy…', exact: true })).toBeDisabled();
  finish();
  await expect(
    page.getByRole('status').filter({ hasText: 'Szafa testowa: zakolejkowano 12' }),
  ).toContainText('bez zdjęcia: 1');
  await expect(
    page.getByRole('button', { name: 'Analiza AI w toku · pozostało 15' }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Analiza AI w toku · pozostało 15' }),
  ).toBeDisabled();
  active = false;
  await expect(button).toBeEnabled({ timeout: 10000 });
  await button.click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Szafa testowa: zakolejkowano 0' }),
  ).toContainText('przetwarzaniu: 15');
  expect(calls).toBe(2);
  await page.goto(`http://localhost:8080/garments/${garmentId}`);
  await expect(
    page.getByRole('button', { name: 'Analiza AI w toku…', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('[role="status"] svg.animate-spin')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Analiza AI w toku…', exact: true }),
  ).toBeDisabled();
  active = false;
  await expect(page.getByRole('button', { name: 'Powtórz analizę AI', exact: true })).toBeEnabled({
    timeout: 10000,
  });
  console.log(
    'PASS: wardrobe-specific POST, disabled button while pending, queued/pending/missing counters, durable spinner after reload, reenabled on completion; mocked API only.',
  );
} finally {
  await browser.close();
}
