// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { styleQuestionSections } from '@wardrobe/shared';

import { i18n } from '../../../app/i18n';

import { StyleQuestion } from '../components/style-question';

const multipleQuestion = styleQuestionSections[3].questions.find(
  (question) => 'multiple' in question && question.multiple,
);

if (!multipleQuestion) throw new Error('Expected a multi-choice question in the thermal section.');

describe('StyleQuestion', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pl');
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('sends a selected multi-choice answer and allows skipping', () => {
    const onAnswer = vi.fn();
    const onSkip = vi.fn();

    render(
      <StyleQuestion
        question={multipleQuestion}
        number={2}
        value={undefined}
        skipped={false}
        onAnswer={onAnswer}
        onSkip={onSkip}
      />,
    );

    fireEvent.click(screen.getByLabelText('T-shirt'));
    expect(onAnswer).toHaveBeenCalledWith('q02_at_18c', ['tshirt']);
    fireEvent.click(screen.getByRole('button', { name: 'Pomiń pytanie' }));
    expect(onSkip).toHaveBeenCalledWith('q02_at_18c');
  });
});
