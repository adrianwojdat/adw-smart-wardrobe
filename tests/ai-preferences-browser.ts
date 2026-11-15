/** Synthetic authenticated sessions only; no real profile or queue writes. */
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const first = '00000000-0000-4000-8000-000000000001',
    second = '00000000-0000-4000-8000-000000000002';
  let user = first;
  const saved = new Map<string, boolean>();
  let analyses = 0,
    fail = false;

  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    let data: unknown = [];

    if (path === '/api/auth/me') data = { id: user, email: 'test@example.invalid', name: 'Test' };
    if (path === '/api/auth/csrf') data = { token: 'test' };
    if (path === '/api/config') data = { smtpConfigured: false, emailConfirmation: false };

    if (path === '/api/preferences/ai') {
      if (req.method() === 'PATCH') {
        if (fail) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Simulated save failure' }),
          });

          return;
        }

        saved.set(user, req.postDataJSON().ai_overwrite_metadata);
      }

      data = { ai_overwrite_metadata: saved.get(user) ?? false };
    }

    if (path.endsWith('/analyze')) analyses++;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });

  const origin = process.env.TEST_ORIGIN ?? 'http://127.0.0.1:4173';

  await page.goto(origin + '/settings');

  const box = page.getByRole('checkbox', {
    name: 'Pozwalaj AI na nadpisywanie metadanych ubrań',
    exact: true,
  });

  await expect(box).toBeEnabled();
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(box).toBeChecked();
  await page.reload();
  await expect(box).toBeChecked();
  user = second;
  await page.reload();
  await expect(box).not.toBeChecked();
  user = first;
  await page.reload();
  await expect(box).toBeChecked();
  fail = true;
  await box.click();
  await expect(page.getByText('Simulated save failure', { exact: true })).toBeVisible();
  await expect(box).toBeChecked();
  expect(analyses).toBe(0);
  console.log(
    'PASS: default off, saved/reloaded setting, isolated users, failed save retains value, no automatic mass analysis.',
  );
} finally {
  await browser.close();
}
