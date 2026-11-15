import { expect, it } from 'vitest';

import { RecommendationRequest } from '../apps/web/src/features/outfits/api/recommendation-request.ts';

it('rejects responses for changed criteria and superseded requests', () => {
  const gate = new RecommendationRequest();
  const first = gate.begin();

  expect(gate.accepts(first, 'office:8', 'everyday:18')).toBe(false);

  const second = gate.begin();

  expect(gate.accepts(first, 'office:8', 'office:8')).toBe(false);
  expect(gate.accepts(second, 'office:8', 'office:8')).toBe(true);
});
