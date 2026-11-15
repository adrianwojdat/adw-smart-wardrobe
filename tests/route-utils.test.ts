import { describe, expect, it } from 'vitest';

import { checked } from '../apps/api/src/lib/route-utils.js';
import { HttpError } from '../apps/api/src/modules/auth/session.js';

describe('checked Supabase result mapping', () => {
  it('returns data without coercion', () => {
    const value = { count: 4 };

    expect(checked({ data: value, error: null })).toBe(value);
  });

  it.each([
    ['PGRST116', 404],
    ['42501', 403],
    ['XX000', 400],
  ])('maps database error %s to HTTP %s', (code, statusCode) => {
    try {
      checked({ data: null, error: { code } });
      throw new Error('expected checked to throw');
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      expect(error.statusCode).toBe(statusCode);
    }
  });

  it('maps an empty result to not found', () => {
    expect(() => checked({ data: null, error: null })).toThrowError(HttpError);
  });
});
