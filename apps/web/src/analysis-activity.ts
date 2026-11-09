import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from './api';
const schema = z.array(
  z.object({
    wardrobe_id: z.uuid(),
    image_id: z.uuid(),
    queued: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative(),
  }),
);
export function useAnalysisActivity() {
  return useQuery({
    queryKey: ['analysis-activity'],
    queryFn: () => request('/api/analysis/activity', schema),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });
}
