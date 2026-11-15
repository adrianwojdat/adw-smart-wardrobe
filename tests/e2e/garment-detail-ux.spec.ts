import { expect, test } from '@playwright/test';

import { captureUiScreen } from './ui-screenshot.ts';

// Keep each run independent of a service worker left by an older app bundle.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smart-wardrobe-language', 'pl'));
});

const wardrobeId = '11111111-1111-4111-8111-111111111111';
const garmentId = '22222222-2222-4222-8222-222222222222';
const imageId = '33333333-3333-4333-8333-333333333333';
const secondGarmentId = '44444444-4444-4444-8444-444444444444';

function garment(id: string, category: 'tops' | 'bottoms', name: string) {
  return {
    id,
    owner_id: '55555555-5555-4555-8555-555555555555',
    wardrobe_id: wardrobeId,
    name,
    name_source: 'manual',
    category,
    subcategory: '',
    pattern: '',
    brand: '',
    size: 'M',
    primary_color: 'Granatowy',
    secondary_color: '',
    material: 'Bawełna',
    material_source: 'user',
    seasons: ['autumn'],
    warmth: 2,
    warmth_manual: false,
    thickness: 'medium',
    style: 'casual',
    occasions: [],
    cleanliness: 'clean',
    favorite: false,
    archived: false,
    notes: '',
    created_at: '2026-11-11T09:00:00.000Z',
    updated_at: '2026-11-11T09:00:00.000Z',
    garment_images:
      id === garmentId
        ? [
            {
              id: imageId,
              garment_id: garmentId,
              wardrobe_id: wardrobeId,
              path: 'fixture.webp',
              kind: 'garment',
              width: 320,
              height: 320,
              created_at: '2026-11-11T09:00:00.000Z',
              original_path: 'fixture.original',
              original_mime: 'image/jpeg',
              cutout_path: null,
              catalog_path: 'fixture.webp',
              thumbnail_path: null,
              revision: 1,
              rotation: 0,
              process_status: 'completed',
              stage: 'Zdjęcie gotowe',
              pipeline_version: 'test',
              processing_error: null,
              orientation: null,
              analysis: {
                source: 'photo',
                confidence: 0.75,
                uncertainties: [],
                suggestions: { primary_color: 'Black', pattern: 'gładki' },
              },
            },
          ]
        : [],
  };
}

test('garment detail supports inline editing, review, fast rotation and responsive layout', async ({
  page,
}, testInfo) => {
  let current = garment(garmentId, 'tops', 'Koszulka testowa');
  const second = garment(secondGarmentId, 'bottoms', 'Spodnie testowe');

  second.brand = '  Nike  ';
  second.primary_color = '';

  const duplicateBrand = garment('77777777-7777-4777-8777-777777777777', 'tops', 'Bluza testowa');

  duplicateBrand.brand = 'nike';

  const aiRun: { id?: string } = {};
  const rotations: number[] = [];
  const updates: Record<string, unknown>[] = [];
  const customDefinitions: Record<string, unknown>[] = [];
  const customValues: Record<string, unknown>[] = [];
  let customOptionSequence = 0;
  let failNextRotation = false;
  let failNextUpdate = false;
  const image = () => current.garment_images[0]!;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/auth/me')
      return json({ id: current.owner_id, email: 'test@example.com', name: 'Test' });
    if (path === '/api/wardrobes')
      return json([
        {
          id: wardrobeId,
          owner_id: current.owner_id,
          name: 'Garderoba testowa z długą nazwą',
          kind: 'private',
          created_at: current.created_at,
        },
      ]);
    if (path === `/api/wardrobes/${wardrobeId}/members`)
      return json([
        {
          wardrobe_id: wardrobeId,
          user_id: current.owner_id,
          role: 'owner',
          created_at: current.created_at,
        },
      ]);
    if (path === `/api/wardrobes/${wardrobeId}/custom-properties` && request.method() === 'GET')
      return json(customDefinitions);

    if (path === `/api/wardrobes/${wardrobeId}/custom-properties` && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const definition = {
        id: '88888888-8888-4888-8888-888888888888',
        wardrobe_id: wardrobeId,
        created_at: current.created_at,
        updated_at: current.updated_at,
        garment_property_options: [],
        ...body,
      };

      customDefinitions.push(definition);

      return json(definition);
    }

    if (
      path === `/api/custom-properties/88888888-8888-4888-8888-888888888888` &&
      request.method() === 'PATCH'
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      const definition = { ...customDefinitions[0], ...body };

      customDefinitions[0] = definition;

      return json(definition);
    }

    if (
      path === `/api/custom-properties/88888888-8888-4888-8888-888888888888/options` &&
      request.method() === 'POST'
    ) {
      const body = request.postDataJSON() as { label: string };
      const option = {
        id: `99999999-9999-4999-8999-${String(++customOptionSequence).padStart(12, '0')}`,
        property_id: '88888888-8888-4888-8888-888888888888',
        wardrobe_id: wardrobeId,
        sort_order: 0,
        created_at: current.created_at,
        ...body,
      };

      (customDefinitions[0]!.garment_property_options as unknown[]).push(option);

      return json(option);
    }

    if (/^\/api\/garments\/[^/]+$/.test(path) && request.method() === 'GET') {
      const requestedId = path.split('/').at(-1);

      if (requestedId === garmentId) return json(current);
      if (requestedId === secondGarmentId) return json(second);

      return json({ message: 'Garment not found.' }, 404);
    }

    if (path === '/api/garments' && request.method() === 'GET')
      return json([current, second, duplicateBrand]);

    if (path === `/api/garments/${garmentId}` && request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;

      if (failNextUpdate) {
        failNextUpdate = false;

        return json({ code: 'SERVICE_UNAVAILABLE', message: 'Failed to save the change.' }, 503);
      }

      updates.push(body);
      current = { ...current, ...body };

      return json(current);
    }

    if (path === `/api/garments/${garmentId}/history`) return json([]);
    if (path === `/api/garments/${garmentId}/custom-properties` && request.method() === 'GET')
      return json(customValues);

    if (
      path ===
        `/api/garments/${garmentId}/custom-properties/88888888-8888-4888-8888-888888888888` &&
      request.method() === 'PUT'
    ) {
      const body = request.postDataJSON() as { value: unknown };
      const record = {
        garment_id: garmentId,
        property_id: '88888888-8888-4888-8888-888888888888',
        wardrobe_id: wardrobeId,
        updated_at: current.updated_at,
        ...body,
      };

      customValues.splice(0, customValues.length, record);

      return json(record);
    }

    if (path === '/api/config') return json({ manualAnalysis: false });
    if (path === '/api/jobs')
      return json(
        aiRun.id
          ? [
              {
                id: aiRun.id,
                wardrobe_id: wardrobeId,
                garment_id: garmentId,
                image_id: imageId,
                requested_by: current.owner_id,
                type: 'analyze_garment',
                status: 'completed',
                progress: 100,
                attempts: 1,
                error: null,
                result: null,
                created_at: '2026-11-11T10:00:00.000Z',
                updated_at: '2026-11-11T10:00:01.000Z',
              },
            ]
          : [],
      );
    if (path === '/api/recommendations')
      return json({ source: 'rules', outfits: [[current, second]] });
    if (path === '/api/outfits' && request.method() === 'GET')
      return json([
        {
          id: '66666666-6666-4666-8666-666666666666',
          wardrobe_id: wardrobeId,
          created_by: current.owner_id,
          name: 'Zestaw testowy',
          occasion: 'everyday',
          garment_ids: [current.id],
          temperature: 18,
          rationale: 'Zestaw pasuje na co dzień.',
          wearing_tips: null,
          missing_items: [{ category: 'shoes', description: 'Białe sneakersy' }],
          created_at: current.created_at,
        },
      ]);
    if (path === '/api/auth/csrf') return json({ token: 'test-csrf' });

    if (path === `/api/images/${imageId}/reprocess`) {
      const body = request.postDataJSON() as { rotation?: number };

      rotations.push(body.rotation ?? -1);

      if (failNextRotation) {
        failNextRotation = false;

        return json({ message: 'Failed to save image rotation.' }, 503);
      }

      const revision = image().revision + 1;

      current.garment_images = [
        {
          ...image(),
          rotation: body.rotation ?? image().rotation,
          revision,
          process_status: 'completed',
          stage: 'Zdjęcie gotowe',
          catalog_path: `catalog-v${revision}.webp`,
        },
      ];

      return json(image());
    }

    if (path.startsWith('/api/images/'))
      return route.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.from('') });

    return json({ message: `Unexpected mock request: ${request.method()} ${path}` }, 404);
  });

  await page.goto(`/garments/${garmentId}`);
  await expect(page.getByRole('heading', { name: 'Koszulka testowa' })).toBeVisible();
  await expect(page.getByText('Gotowe do stylizacji')).toBeVisible();
  await expect(page.locator('.detail-photo .garment-image-badges')).toContainText('Czyste');
  await expect(page.locator('.detail-photo .garment-image-badges')).toContainText(
    'Gotowe do stylizacji',
  );
  await expect(page.getByText('Stopień zużycia')).toBeVisible();

  const statusControl = page.locator('.detail-properties > label').first();
  const statusSelect = statusControl.locator('select');

  await expect(statusSelect).toHaveCSS('display', 'block');
  expect(
    await statusSelect.evaluate(
      (el) =>
        Math.abs(
          el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width,
        ) < 2,
    ),
  ).toBe(true);
  await captureUiScreen(page, testInfo, 'szczegoly-ubrania');

  const wearCondition = page.locator('.detail-properties > label').nth(1).locator('select');

  await wearCondition.click();

  const wearConditionMenu = page.locator('.app-dropdown-list');

  await expect(wearConditionMenu).toBeVisible();
  await wearConditionMenu.getByRole('option', { name: 'Dobry', exact: true }).click();
  await expect.poll(() => updates.length).toBe(1);
  expect(updates[0]).toMatchObject({ wear_condition: 'good' });

  if (testInfo.project.name === 'desktop') {
    await captureUiScreen(page, testInfo, 'menu-desktop');
  }

  await page.getByRole('button', { name: 'Zarządzaj polami' }).click();
  await page.getByLabel('Nazwa nowego pola').fill('Stopień zużycia');
  await page.getByLabel('Typ').selectOption('select');
  await page.getByRole('button', { name: 'Dodaj pole' }).click();
  await expect(page.getByText('Stopień zużycia', { exact: true })).toBeVisible();

  for (const label of ['Niski', 'Średni', 'Wysoki']) {
    await page.getByPlaceholder('Dodaj opcję').fill(label);
    await page.getByRole('button', { name: 'Dodaj opcję' }).click();
    await expect(page.locator('.custom-option-manager')).toContainText(label);
  }

  await page.getByRole('button', { name: 'Zamknij' }).click();
  await page.getByRole('button', { name: 'Edytuj własną właściwość Stopień zużycia' }).click();

  const wearProperty = page.locator('.custom-value-editor select');

  await wearProperty.click();

  const wearOptions = page.locator('.app-dropdown-list');

  await expect(wearOptions).toBeVisible();
  await wearOptions.getByRole('option', { name: 'Średni', exact: true }).click();
  await expect(wearProperty).toHaveValue('99999999-9999-4999-8999-000000000002');
  await page.getByRole('button', { name: 'Zapisz: Stopień zużycia' }).click();
  await expect.poll(() => customValues.length).toBe(1);
  expect(customValues[0]).toMatchObject({ value: '99999999-9999-4999-8999-000000000002' });

  await page.getByRole('button', { name: /Edytuj Kolor główny/ }).click();

  const colorInput = page.getByRole('combobox', { name: 'Kolor główny' });

  await colorInput.fill('Błękitny');
  await colorInput.press('Enter');
  await expect.poll(() => updates.length).toBe(2);
  expect(updates[1]).toMatchObject({ primary_color: 'Błękitny' });

  await page.getByRole('button', { name: /Edytuj Marka/ }).click();

  const brandInput = page.getByRole('combobox', { name: 'Marka' });

  await brandInput.fill(' nike ');
  await page.getByRole('button', { name: 'Zapisz: Marka' }).click();
  await expect.poll(() => updates.length).toBe(3);
  expect(updates[2]).toMatchObject({ brand: 'Nike' });

  await page.getByRole('button', { name: /Edytuj Kolor główny/ }).click();

  const colorAutocomplete = page.getByRole('combobox', { name: 'Kolor główny' });

  await colorAutocomplete.fill('Gra');

  const colorOption = page.getByRole('option', { name: 'Granatowy' });

  await expect(colorOption).toBeVisible();
  await colorOption.click();
  await page.getByRole('button', { name: 'Zapisz: Kolor główny' }).click();
  await expect.poll(() => updates.length).toBe(4);
  expect(updates[3]).toMatchObject({ primary_color: 'Granatowy' });

  await page.getByRole('button', { name: /Edytuj Wzór/ }).click();

  const patternInput = page.getByRole('combobox', { name: 'Wzór' });

  await patternInput.fill('  Kratka   ');
  await page.getByRole('button', { name: 'Zapisz: Wzór' }).click();
  await expect.poll(() => updates.length).toBe(5);
  expect(updates[4]).toMatchObject({ pattern: 'Kratka' });

  await page.getByRole('button', { name: /Edytuj Marka/ }).click();

  const updatedBrand = page.getByRole('combobox', { name: 'Marka' });

  await expect(updatedBrand).toBeVisible();
  await updatedBrand.fill('Adidas');
  await page.getByRole('button', { name: /Edytuj Kategoria/ }).click();
  await expect.poll(() => updates.length).toBe(6);
  expect(updates[5]).toMatchObject({ brand: 'Adidas' });
  await expect(page.getByRole('combobox', { name: 'Kategoria' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Kategoria' }).press('Escape');

  failNextUpdate = true;
  await page.getByRole('button', { name: /Edytuj Marka/ }).click();

  const failedDraft = page.getByRole('combobox', { name: 'Marka' });

  await failedDraft.fill('Nowa marka');
  await page.getByRole('button', { name: /Edytuj Kolor główny/ }).click();
  await expect(failedDraft).toHaveValue('Nowa marka');
  await expect(page.getByText(/Serwer nie może teraz wykonać żądania/).first()).toBeVisible();
  await failedDraft.press('Escape');

  await page.getByRole('button', { name: /Edytuj Rozmiar/ }).click();

  const sizeInput = page.getByRole('textbox', { name: 'Rozmiar' });

  await sizeInput.fill('XL');
  await sizeInput.press('Escape');
  expect(updates).toHaveLength(6);

  const suggestions = page.locator('.ai-suggestions');

  await expect(suggestions).toBeVisible();
  await suggestions.locator('summary').click();
  await suggestions.getByRole('button', { name: 'Odrzuć pozostałe' }).click();
  await expect(suggestions).toHaveCount(0);
  aiRun.id = '66666666-6666-4666-8666-666666666666';
  await page.reload();
  await expect(page.locator('.ai-suggestions')).toBeVisible();

  await page.getByRole('button', { name: 'Obróć zdjęcie o 90 stopni w prawo' }).click();
  await page.getByRole('button', { name: 'Obróć zdjęcie o 90 stopni w prawo' }).click();
  await expect(page.locator('.detail-photo img')).toHaveAttribute('style', /rotate\(180deg\)/);
  await expect.poll(() => rotations.length, { timeout: 4000 }).toBe(1);
  expect(rotations).toEqual([180]);
  await expect
    .poll(() => page.locator('.detail-photo img').getAttribute('src'))
    .toContain('catalog-v2.webp');

  failNextRotation = true;
  await page.getByRole('button', { name: 'Obróć zdjęcie o 90 stopni w lewo' }).click();
  await expect(page.locator('.rotation-state')).toContainText(
    'Nie udało się zapisać lub przygotować zdjęcia po obrocie.',
  );
  await expect(page.locator('.detail-photo img')).toHaveAttribute('style', /rotate\(270deg\)/);
  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect.poll(() => rotations.length, { timeout: 2000 }).toBe(3);
  await expect
    .poll(() => page.locator('.detail-photo img').getAttribute('src'))
    .toContain('catalog-v3.webp');
  expect(image().original_path).toBe('fixture.original');

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Otwórz menu' }).click();
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();

  const wardrobePicker = page.getByRole('combobox', { name: 'Wybierz garderobę' });

  await wardrobePicker.press('ArrowDown');
  await expect(page.getByRole('listbox', { name: 'Garderoby' })).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Garderoba testowa z długą nazwą' }),
  ).toHaveAttribute('aria-selected', 'true');
  if (testInfo.project.name === 'mobile')
    await captureUiScreen(page, testInfo, 'menu-garderoby-otwarte');
  await wardrobePicker.press('Escape');
  await expect(page.getByRole('listbox', { name: 'Garderoby' })).toHaveCount(0);
  await wardrobePicker.press('ArrowDown');
  await wardrobePicker.press('Tab');
  await expect(page.getByRole('listbox', { name: 'Garderoby' })).toHaveCount(0);

  const selector = await page.locator('#active-wardrobe').boundingBox();
  const add = await page.getByRole('button', { name: 'Utwórz garderobę' }).first().boundingBox();

  expect(selector && add && selector.x + selector.width).toBeLessThanOrEqual(add.x + 1);

  const firstNavigationItem = await page.locator('.sidebar-nav .nav-item').first().boundingBox();

  expect(selector && firstNavigationItem && selector.y + selector.height).toBeLessThanOrEqual(
    firstNavigationItem.y,
  );
  if (testInfo.project.name === 'mobile') await captureUiScreen(page, testInfo, 'menu-mobilne');
  await page.getByRole('button', { name: 'Zamknij menu' }).click();
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  );

  await page.goto('/wardrobe');
  await expect(
    page.locator('.readiness-badge').filter({ hasText: 'Brakuje: kolor' }),
  ).toBeVisible();
  await captureUiScreen(page, testInfo, 'lista-garderoby');

  const sortControl = page.getByRole('combobox', { name: 'Sortowanie ubrań' });

  await sortControl.click();
  await expect(sortControl).toHaveAttribute('aria-expanded', 'true');

  const sortOptions = page.locator('.app-dropdown-list');

  await expect(sortOptions).toBeVisible();
  await expect(sortOptions).toHaveAttribute('aria-label', 'Sortowanie ubrań');
  await expect(sortOptions.getByRole('option', { name: 'Najnowsze' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await sortOptions.getAttribute('class')).toContain('app-dropdown-list');
  await captureUiScreen(page, testInfo, 'lista-sortowania-otwarta');
  await sortOptions.getByRole('option', { name: 'Nazwa A–Z' }).click();
  await expect(sortControl).toHaveValue('name');
  await expect(page).toHaveURL(/sort=name/);
  await expect(page.locator('.garment-card').first().locator('h3')).toHaveText('Bluza testowa');
  await sortControl.click();
  await page.locator('.app-dropdown-list').getByRole('option', { name: 'Najnowsze' }).click();
  await expect(page).not.toHaveURL(/sort=name/);
  await expect(sortOptions).toHaveCount(0);
  expect(
    await page.locator('.sort-select').evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe('1px');
  await page.locator('.garment-card').first().locator('.garment-card-info').click();
  await expect(page.getByRole('heading', { name: 'Koszulka testowa' })).toBeVisible();
  await page.getByRole('button', { name: /Następne ubranie/ }).click();
  await expect(page.getByRole('heading', { name: 'Spodnie testowe' })).toBeVisible();
  await expect(page.locator('.detail-photo .readiness-badge')).toHaveText('Uzupełnij: kolor');
  await expect(page.getByRole('button', { name: /Edytuj Kolor główny/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Poprzednie ubranie/ })).toBeEnabled();
  await page.getByRole('button', { name: /Poprzednie ubranie/ }).click();
  await expect(page.getByRole('heading', { name: 'Koszulka testowa' })).toBeVisible();
  await page.goto('/outfits');
  await expect(page.getByRole('heading', { name: 'Co dziś założysz?' })).toBeVisible();

  const activeNavigation = page.locator('.sidebar-nav .nav-item.active');

  expect(await activeNavigation.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
  await expect(page.locator('.outfit-input-grid')).toHaveCSS('display', 'grid');

  const weatherLabel = page.getByText('Pogoda (opcjonalnie)').locator('..');
  const weatherInput = weatherLabel.locator('input');

  expect(
    await weatherInput.evaluate(
      (el) =>
        Math.abs(
          el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width,
        ) < 2,
    ),
  ).toBe(true);
  await captureUiScreen(page, testInfo, 'generator-stylizacji');
  await page.goto('/saved');
  await expect(page.getByRole('heading', { name: 'Zapisane stylizacje' })).toBeVisible();

  const removeOutfit = page.getByRole('button', { name: 'Usuń zestaw' });

  await expect(removeOutfit).toBeVisible();
  await expect(removeOutfit).toHaveCSS('margin-top', '16px');
  await captureUiScreen(page, testInfo, 'zapisane-zestawy');
  await page.goto('/garments/new');
  await expect(page.getByRole('heading', { name: 'Trochę o tym ubraniu' })).toBeVisible();

  const garmentForm = page.locator('.garment-form');
  const categorySelect = garmentForm.locator('select').first();
  const subcategoryInput = garmentForm.locator('.form-row').first().locator('input').first();

  expect(
    await categorySelect.evaluate(
      (el) =>
        Math.abs(
          el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width,
        ) < 2,
    ),
  ).toBe(true);
  expect(
    await subcategoryInput.evaluate(
      (el) =>
        Math.abs(
          el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width,
        ) < 2,
    ),
  ).toBe(true);
  await categorySelect.click();

  const categoryOptions = page.getByRole('listbox', { name: 'Kategoria' });

  await expect(categoryOptions).toBeVisible();
  await expect(categoryOptions).toHaveClass(/app-dropdown-list/);
  await categoryOptions.getByRole('option', { name: 'Spodnie i spódnice' }).click();
  await expect(categorySelect).toHaveValue('bottoms');
  await categorySelect.press('Escape');
  await captureUiScreen(page, testInfo, 'formularz-ubrania');
});
