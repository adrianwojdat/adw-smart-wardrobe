import { it, expect } from 'vitest';
import {
  garmentInput,
  localizeAnalysis,
  polishGarmentName,
  aiValueLabel,
} from '../packages/shared/src/index';
it('accepts missing and blank names on creation without adding a name to unrelated patches', () => {
  const base = { wardrobe_id: '2fd58432-9442-4190-9e2b-e1cab47b7cc7', category: 'tops' };
  expect(garmentInput.parse(base).name).toBeUndefined();
  expect(garmentInput.parse({ ...base, name: '   ' }).name).toBe('');
  expect(garmentInput.partial().parse({ brand: 'COS' })).not.toHaveProperty('name');
});
it.each([
  [{ name: 'White pants', category: 'bottoms', primary_color: 'white' }, 'Białe spodnie'],
  [{ name: 'Black blazer', category: 'outerwear', primary_color: 'navy' }, 'Granatowa marynarka'],
  [{ name: 'Blue shirt', category: 'tops', primary_color: 'blue' }, 'Niebieska koszula'],
  [{ name: 'Black dress', category: 'dresses', primary_color: 'black' }, 'Czarna sukienka'],
])('creates a grammatical Polish name from observed attributes', (input, expected) =>
  expect(polishGarmentName(input)).toBe(expected),
);
it('localizes old/new AI output while preserving brands and verbatim OCR', () => {
  const input = {
    source: 'label' as const,
    confidence: 0.8,
    uncertainties: ['Specific brand identification'],
    text: '100% COTTON / MEDICINE',
    suggestions: {
      name: 'Black blazer',
      category: 'outerwear' as const,
      primary_color: 'black',
      brand: 'Medicine',
      style: 'casual',
    },
  };
  const result = localizeAnalysis(input);
  expect(result.suggestions.name).toBe('Czarna marynarka');
  expect(result.suggestions.primary_color).toBe('czarny');
  expect(result.suggestions.brand).toBe('Medicine');
  expect(result.text).toBe(input.text);
  expect(result.uncertainties).toEqual(['Wynik wymaga weryfikacji językowej.']);
  expect(input.suggestions.name).toBe('Black blazer');
  expect(aiValueLabel('seasons', ['spring', 'summer'])).toBe('Wiosna, Lato');
});
