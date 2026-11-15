/** Tests confirmation against a mocked API in the deployed UI; no real deletion. */
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const owner = '00000000-0000-4000-8000-000000000001';
  const id = '11111111-1111-4111-8111-111111111111';
  let deleted = 0;
  let wardrobes = [
    {
      id,
      owner_id: owner,
      name: 'Szafa testowa',
      kind: 'private',
      created_at: new Date().toISOString(),
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      owner_id: '33333333-3333-4333-8333-333333333333',
      name: 'Szafa współdzielona',
      kind: 'family',
      created_at: new Date().toISOString(),
    },
  ];

  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    let data: unknown = [];

    if (path === '/api/auth/me') data = { id: owner, email: 'test@example.com', name: 'Test' };
    if (path === '/api/auth/csrf') data = { token: 'test' };
    if (path === '/api/config') data = { smtpConfigured: true, emailConfirmation: true };
    if (path === '/api/wardrobes') data = wardrobes;

    if (path === `/api/wardrobes/${id}` && request.method() === 'DELETE') {
      deleted++;
      wardrobes = wardrobes.filter((w) => w.id !== id);
      data = { ok: true };
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('http://localhost:8080/settings');

  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Twoje garderoby', exact: true }) });

  await expect(section.getByRole('button', { name: 'Usuń', exact: true })).toHaveCount(1);
  await expect(section.getByText('Usuwa tylko właściciel')).toBeVisible();
  await section.getByRole('button', { name: 'Usuń', exact: true }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog).toContainText('wszystkie ubrania');
  await dialog.getByRole('button', { name: 'Anuluj', exact: true }).click();
  expect(deleted).toBe(0);
  await section.getByRole('button', { name: 'Usuń', exact: true }).click();
  await dialog.getByRole('button', { name: 'Usuń garderobę i ubrania', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(deleted).toBe(1);
  await expect(section.getByText('Szafa testowa', { exact: false })).toHaveCount(0);
  console.log(
    'PASS: owner-only delete, warning, cancel without request, confirmed delete and list refresh; mocked API only.',
  );
} finally {
  await browser.close();
}
