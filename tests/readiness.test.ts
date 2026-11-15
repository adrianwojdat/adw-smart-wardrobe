import { describe, expect, it } from 'vitest';

import { getStylingReadiness } from '../packages/shared/src/index.ts';

describe('getStylingReadiness', () => {
  it('requires a usable color while accepting minimal outfit metadata', () => {
    expect(getStylingReadiness({ category: 'tops', primary_color: ' granatowy ' })).toEqual({
      ready: true,
      missing: [],
    });
    expect(getStylingReadiness({ category: 'bottoms', secondary_color: 'biały' }).ready).toBe(true);
  });

  it('reports color as missing without requiring brand, style, or custom properties', () => {
    expect(getStylingReadiness({ category: 'outerwear' })).toEqual({
      ready: false,
      missing: ['color'],
    });
  });

  it('reports a missing category when the source record is incomplete', () => {
    expect(getStylingReadiness({ category: '', primary_color: 'czarny' })).toEqual({
      ready: false,
      missing: ['category'],
    });
  });
});
