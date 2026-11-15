import { expect, type Page, test } from '@playwright/test';

import {
  deriveStyleHardConstraints,
  styleAnswerKeys,
  type StyleAnswers,
  styleAnswersSchema,
  styleProfileUpdateSchema,
  styleQuestionSections,
} from '../../packages/shared/src/index.ts';

import { captureUiScreen } from './ui-screenshot.ts';

test.use({ serviceWorkers: 'block' });

// All writes terminate in this isolated, per-test in-memory fixture.
async function mockProfile(page: Page, initial: StyleAnswers = {}) {
  let answers = structuredClone(initial);
  let skipped: string[] = [];
  let writes = 0;
  const response = () => ({
    schema_version: 1,
    answers,
    skipped,
    hard_constraints: deriveStyleHardConstraints(answers),
  });

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/auth/me')
        return json({
          id: 'a7000000-0000-4000-8000-000000000001',
          email: 'style@test.invalid',
          name: 'Test',
        });
      if (path === '/api/wardrobes') return json([]);
      if (path === '/api/auth/csrf') return json({ token: 'style-test-csrf' });
      if (path === '/api/profile/style' && request.method() === 'GET') return json(response());

      if (path === '/api/profile/style' && request.method() === 'PATCH') {
        const patch = styleProfileUpdateSchema.parse(request.postDataJSON());

        answers = { ...answers, ...patch.answers };
        skipped = [
          ...new Set([...skipped.filter((key) => !(key in patch.answers)), ...patch.skipped]),
        ];
        for (const key of patch.skipped) delete answers[key];
        writes++;

        return json(response());
      }

      return json({ message: 'Unexpected test request' }, 404);
    },
  );

  return { answers: () => answers, writes: () => writes };
}

for (const language of ['en', 'pl'] as const) {
  test(`style survey saves new answers and reopens visual profile (${language})`, async ({
    page,
  }, testInfo) => {
    const fixture = await mockProfile(page);

    await page.addInitScript(
      (lang) => localStorage.setItem('smart-wardrobe-language', lang),
      language,
    );

    const en = language === 'en';

    await page.goto('/style/survey');
    await expect(
      page.getByRole('heading', {
        name: en ? 'Your style and aesthetics' : 'Twój styl i estetyka',
      }),
    ).toBeVisible();
    await captureUiScreen(page, testInfo, `survey2-${language}`);
    await page.locator('input[name="q31_dominant_style"]').nth(1).check(); // classic
    await page.locator('input[name="q21_aesthetics"]').nth(3).check(); // preppy
    await page.locator('input[name="q33_daily_formality"]').nth(2).check();
    await page.locator('input[name="q34_preference_strength-styles"]').nth(2).check();
    await expect.poll(() => fixture.answers().q31_dominant_style).toBe('classic');
    await page.getByRole('button', { name: en ? 'Next' : 'Dalej', exact: true }).click();
    await page.locator('input[name="q32_colors"]').nth(2).check(); // navy
    await page.locator('input[name="q32_colors"]').nth(4).check(); // beige
    await expect.poll(() => fixture.answers().q32_colors).toEqual(['navy', 'beige']);
    await captureUiScreen(page, testInfo, `survey2-colors-${language}`);
    await page.reload();
    await expect(page.locator('input[name="q32_colors"]').nth(2)).toBeChecked();
    await page
      .locator('fieldset')
      .filter({ has: page.locator('input[name="q22_patterns"]') })
      .getByRole('button', { name: en ? 'Skip question' : 'Pomiń pytanie' })
      .click();
    await page
      .locator('#main')
      .getByRole('link', { name: en ? 'My style' : 'Mój styl', exact: true })
      .click();
    await expect(page.locator('.style-identity-hero h2')).toHaveText(en ? 'Classic' : 'Klasyczny');
    await expect(page.locator('.style-palette')).toContainText(en ? 'Navy' : 'Granatowy');
    await expect(page.locator('.style-palette')).toContainText(en ? 'Beige' : 'Beżowy');
    await expect(page.locator('.style-summary-chips')).toContainText('Preppy');
    await expect(page.locator('.style-full-profile')).not.toHaveAttribute('open');
    await captureUiScreen(page, testInfo, `profile2-${language}`);
    await page.reload();
    await expect(page.locator('.style-identity-hero h2')).toHaveText(en ? 'Classic' : 'Klasyczny');
    expect(fixture.answers().q34_preference_strength).toEqual({ styles: 'strong' });
  });
}

test('completed profile presents interpreted preferences and firm restrictions', async ({
  page,
}, testInfo) => {
  const questions = styleQuestionSections.flatMap((section) => [...section.questions]);
  const base = Object.fromEntries(
    styleAnswerKeys.slice(0, 30).map((key) => {
      const q = questions.find((q) => q.key === key)!;
      const option = q.options[0]![0];

      return [key, 'boolean' in q ? false : 'multiple' in q ? [option] : option];
    }),
  );
  const answers = styleAnswersSchema.parse({
    ...base,
    q06_favorite_fits: ['regular'],
    q07_avoided_fits: ['slim'],
    q21_aesthetics: ['classic', 'preppy'],
    q31_dominant_style: 'classic',
    q32_colors: ['navy', 'beige', 'burgundy'],
    q33_daily_formality: 'smart_casual',
    q34_preference_strength: { styles: 'strong', colors: 'balanced', fits: 'gentle' },
  });
  const fixture = await mockProfile(page, answers);

  await page.addInitScript(() => localStorage.setItem('smart-wardrobe-language', 'en'));
  await page.goto('/style');
  await expect(page.getByText('34/34 answers', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Profile additions: 4/4 optional answers', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.style-identity-hero h2')).toHaveText('Classic');
  await expect(page.locator('.style-summary-chips')).toContainText('Preppy');
  await expect(page.locator('.style-palette')).toContainText('Burgundy');
  await expect(page.locator('.style-hard-rules')).toContainText('Slim');
  await expect(page.locator('.style-rules-grid')).toContainText('I tend to feel cold');
  await captureUiScreen(page, testInfo, 'profile2-complete');
  await page.locator('.style-full-profile > summary').click();
  await expect(page.locator('.style-profile-section')).toHaveCount(7);
  await captureUiScreen(page, testInfo, 'profile2-answer-sections');
  expect(fixture.writes()).toBe(0);
  expect(fixture.answers()).toEqual(answers);
});

test('legacy profile retains all 30 answers and maps local page progress without a write', async ({
  page,
}, testInfo) => {
  const questions = styleQuestionSections.flatMap((section) => [...section.questions]);
  const legacy = styleAnswersSchema.parse(
    Object.fromEntries(
      styleAnswerKeys.slice(0, 30).map((key) => {
        const q = questions.find((q) => q.key === key)!;
        const first = q.options[0]![0];

        return [key, 'boolean' in q ? false : 'multiple' in q ? [first] : first];
      }),
    ),
  );
  const fixture = await mockProfile(page, legacy);

  await page.addInitScript(() => {
    localStorage.setItem('smart-wardrobe-language', 'en');
    localStorage.setItem(
      'smart-wardrobe-style-progress:a7000000-0000-4000-8000-000000000001',
      JSON.stringify({ step: 0, pendingAnswers: {}, pendingSkipped: [] }),
    );
  });
  await page.goto('/style');
  await expect(page.getByText('30/34 answers', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Profile additions: 0/4 optional answers', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.style-identity-hero h2')).toHaveText('Preference not established');
  await expect(page.getByText('Original survey: 30/30 answers', { exact: true })).toBeVisible();
  await expect(page.locator('.style-palette-card')).toContainText(
    'Choose them in the survey, in step 2',
  );
  await expect(page.locator('#main')).not.toContainText('sections.');
  await captureUiScreen(page, testInfo, 'profile2-legacy');
  await page.getByRole('link', { name: 'Edit answers' }).click();
  await expect(page.getByRole('heading', { name: 'Comfort and weather' })).toBeVisible();
  await expect(page.locator('input[name="q01_thermal"]').first()).toBeChecked();
  await page.getByRole('button', { name: 'Answer the new questions' }).click();
  await expect(page.locator('input[name="q31_dominant_style"]').first()).toBeVisible();
  await expect(page.locator('input[name="q33_daily_formality"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('input[name="q32_colors"]').first()).toBeVisible();
  expect(fixture.answers()).toEqual(legacy);
  expect(fixture.writes()).toBe(0);
});
