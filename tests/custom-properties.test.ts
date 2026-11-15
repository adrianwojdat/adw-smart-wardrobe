import { describe, expect, it } from 'vitest';

import { validatePropertyValue } from '../apps/api/src/app/app.ts';
import {
  customPropertyTypes,
  wearConditionLabels,
  wearConditions,
} from '../packages/shared/src/index.ts';

describe('custom garment property values', () => {
  it('keeps the supported property types and the system wear-condition scale explicit', () => {
    expect(customPropertyTypes).toEqual([
      'text',
      'number',
      'currency',
      'date',
      'select',
      'multi_select',
      'boolean',
    ]);
    expect(wearConditions).toContain('unknown');
    expect(wearConditionLabels.very_good).toBe('Very good');
  });

  it.each([
    ['text', 'Len i wiskoza'],
    ['number', 42],
    ['currency', { amount: 129.99, currency: 'PLN' }],
    ['date', '2026-11-11'],
    ['select', '11111111-1111-4111-8111-111111111111'],
    ['multi_select', ['11111111-1111-4111-8111-111111111111']],
    ['boolean', false],
  ] as const)('accepts a valid %s value', (type, value) => {
    expect(() => validatePropertyValue(type, value)).not.toThrow();
  });

  it('rejects malformed currency, dates and option identifiers', () => {
    expect(() => validatePropertyValue('currency', { amount: -1, currency: 'PLN' })).toThrow();
    expect(() => validatePropertyValue('date', '2026-02-31')).toThrow();
    expect(() => validatePropertyValue('select', 'not-an-option-id')).toThrow();
    expect(() => validatePropertyValue('multi_select', ['not-an-option-id'])).toThrow();
  });
});
