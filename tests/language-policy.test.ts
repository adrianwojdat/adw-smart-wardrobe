import { describe, expect, it } from 'vitest';

import { isLikelyPolish } from '../scripts/lib/language-policy.mjs';

describe('English-first language policy', () => {
  it('reports Polish technical prose, including text without accented letters', () => {
    expect(isLikelyPolish('Nie można zapisać danych użytkownika.')).toBe(true);
    expect(isLikelyPolish('Dodano pliki oraz pytania ankiety')).toBe(true);
    expect(isLikelyPolish('Nie znaleziono zadania Gemini.')).toBe(true);
    expect(isLikelyPolish('Zapisano baseline Knip.')).toBe(true);
    expect(isLikelyPolish('Struktura src i publiczne granice feature: poprawne.')).toBe(true);
  });

  it('accepts English technical messages and isolated proper names', () => {
    expect(isLikelyPolish('Failed to save wardrobe preferences.')).toBe(false);
    expect(isLikelyPolish('Destination: Łódź')).toBe(false);
    expect(isLikelyPolish('Zod validation and Gemini API')).toBe(false);
  });
});
