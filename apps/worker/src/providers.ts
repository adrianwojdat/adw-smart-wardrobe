import { z } from 'zod';
// Phase 2 contract. Not connected to user-facing actions in Phase 1.
export const analysisSuggestion = z.object({
  category: z.string().optional(),
  colors: z.array(z.string()),
  style: z.string().optional(),
  season: z.array(z.string()),
  warmth: z.number().min(1).max(5).optional(),
  confidence: z.number().min(0).max(1),
  uncertainties: z.array(z.string()),
  materialFromLabel: z.object({ text: z.string(), composition: z.string() }).optional(),
});
export type AnalysisSuggestion = z.infer<typeof analysisSuggestion>;
export interface VisionProvider {
  analyze(
    image: Uint8Array,
    kind: 'garment' | 'label',
    signal: AbortSignal,
  ): Promise<AnalysisSuggestion>;
}
