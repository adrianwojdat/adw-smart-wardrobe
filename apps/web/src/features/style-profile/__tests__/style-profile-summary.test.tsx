// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  interpretStyleProfile,
  type StyleAnswerKey,
  styleQuestionSections,
} from '@wardrobe/shared';

import { i18n } from '../../../app/i18n';

import { StyleQuestion } from '../components/style-question';
import { StyleSummary } from '../components/style-summary';
import { formatStyleAnswer } from '../lib/format-style-answer';

const question = (key: StyleAnswerKey) =>
  styleQuestionSections.flatMap((s) => [...s.questions]).find((q) => q.key === key)!;

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('style profile 2.0 controls and bilingual summary', () => {
  for (const lang of ['en', 'pl'] as const) {
    it(`renders explicit styles, color swatches and false answers in ${lang}`, async () => {
      await i18n.changeLanguage(lang);

      const summary = interpretStyleProfile({
        q31_dominant_style: 'classic',
        q32_colors: ['navy', 'beige'],
        q28_remind_rarely_worn: false,
      });
      const snapshot = JSON.stringify(summary);

      render(<StyleSummary summary={summary} />);
      expect(
        screen.getByRole('heading', { name: lang === 'en' ? 'Classic' : 'Klasyczny' }),
      ).toBeTruthy();
      expect(screen.getByText(lang === 'en' ? 'Navy' : 'Granatowy')).toBeTruthy();
      expect(screen.getByText(lang === 'en' ? 'Beige' : 'Beżowy')).toBeTruthy();
      expect(screen.getByText(lang === 'en' ? 'No' : 'Nie')).toBeTruthy();
      expect(JSON.stringify(summary)).toBe(snapshot);
    });
  }

  for (const lang of ['en', 'pl'] as const) {
    it(`translates section names and explains missing favourite colours for legacy profiles (${lang})`, async () => {
      await i18n.changeLanguage(lang);
      expect(i18n.t('sections.aesthetics', { ns: 'styleProfile' })).not.toBe('sections.aesthetics');
      for (const section of styleQuestionSections)
        expect(i18n.exists(`sections.${section.id}`, { ns: 'styleProfile' })).toBe(true);

      const summary = interpretStyleProfile({ q24_palettes: ['earth'] });

      render(<StyleSummary summary={summary} />);
      expect(
        screen.getByRole('heading', {
          name: lang === 'en' ? 'Favourite colours' : 'Ulubione kolory',
        }),
      ).toBeTruthy();
      expect(
        screen.getByText(
          lang === 'en'
            ? /Choose them in the survey, in step 2/
            : /Wybierz je w ankiecie w etapie 2/,
        ),
      ).toBeTruthy();
      expect(summary.stylePreferences.colors).toEqual([]);
      expect(summary.stylePreferences.palettes).toEqual(['earth']);
    });
  }

  it('changes displayed language without changing profile answers', async () => {
    await i18n.changeLanguage('en');

    const answers = {
      q31_dominant_style: 'classic',
      q32_colors: ['navy'],
      q28_remind_rarely_worn: false,
    } as const;
    const input = { ...answers, q32_colors: [...answers.q32_colors] };
    const before = JSON.stringify(input);

    render(<StyleSummary summary={interpretStyleProfile(input)} />);
    expect(screen.getByRole('heading', { name: 'Classic' })).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('pl');
    });
    expect(screen.getByRole('heading', { name: 'Klasyczny' })).toBeTruthy();
    expect(screen.getByText('Granatowy')).toBeTruthy();
    expect(screen.getByText('Nie')).toBeTruthy();
    expect(JSON.stringify(input)).toBe(before);
  });
  it('selects colors using stable IDs rather than translated labels', async () => {
    await i18n.changeLanguage('en');

    const onAnswer = vi.fn();

    render(
      <StyleQuestion
        question={question('q32_colors')}
        number={5}
        value={['navy']}
        skipped={false}
        onAnswer={onAnswer}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Beige'));
    expect(onAnswer).toHaveBeenCalledWith('q32_colors', ['navy', 'beige']);
    fireEvent.click(screen.getByLabelText('Navy'));
    expect(onAnswer).toHaveBeenLastCalledWith('q32_colors', []);
  });
  it('does not preselect a strength and preserves other dimensions on changes', async () => {
    await i18n.changeLanguage('en');

    const onAnswer = vi.fn();
    const { container } = render(
      <StyleQuestion
        question={question('q34_preference_strength')}
        number={4}
        value={{ colors: 'gentle' }}
        skipped={false}
        onAnswer={onAnswer}
        onSkip={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('input:checked')).toHaveLength(1);
    fireEvent.click(screen.getAllByLabelText('Strong')[0]!);
    expect(onAnswer).toHaveBeenCalledWith('q34_preference_strength', {
      styles: 'strong',
      colors: 'gentle',
    });
  });
  it('separates thermal balance, priority balance and formal shoes from office formality', async () => {
    await i18n.changeLanguage('en');

    const t = i18n.getFixedT('en', 'styleProfile');

    expect(formatStyleAnswer(t, 'q01_thermal', 'balanced')).toBe('I usually feel comfortable');
    expect(formatStyleAnswer(t, 'q03_priority', 'balanced')).toBe('A balance of both');
    expect(formatStyleAnswer(t, 'q09_shoes', 'formal')).toBe('Formal shoes');
    expect(formatStyleAnswer(t, 'q16_office_style', 'formal')).toBe('Formal');
  });
});
