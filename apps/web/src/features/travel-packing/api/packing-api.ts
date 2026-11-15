import { z } from 'zod';

import {
  geminiTaskSchema,
  type PackingList,
  packingListSchema,
  packingRecommendationsSchema,
  type Trip,
} from '@wardrobe/shared';

import { request } from '../../../lib/api/client';

export const packingApi = {
  lists: () => request('/api/travel-packing', z.array(packingListSchema)),
  generate: (trip: Trip) => request('/api/travel-packing/generate', geminiTaskSchema, 'POST', trip),
  save: (list: PackingList) => {
    const { id, updated_at: _, ...body } = list;

    return request(`/api/travel-packing/${id}`, packingListSchema, 'PUT', body);
  },
  remove: (id: string) =>
    request(`/api/travel-packing/${id}`, z.object({ ok: z.boolean() }), 'DELETE'),
  recommendations: (id: string) =>
    request(`/api/travel-packing/${id}/recommendations`, packingRecommendationsSchema),
};
