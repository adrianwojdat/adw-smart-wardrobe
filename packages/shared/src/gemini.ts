import { z } from 'zod';

import { packingItemSchema } from './travel-packing.js';

export const geminiModelSchema = z.string().regex(/^models\/[a-zA-Z0-9._-]{1,120}$/);
export const geminiCredentialInputSchema = z.object({
  apiKey: z.string().trim().min(20).max(200),
});
export const geminiModelUpdateSchema = z.object({ model: geminiModelSchema });

const wardrobeCategories = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
] as const;
const outfitOccasions = ['office', 'everyday', 'date', 'evening', 'weekend', 'travel'] as const;

export const savedOutfitMissingItemSchema = z
  .object({
    category: z.enum(wardrobeCategories),
    description: z.string().trim().min(1).max(160),
  })
  .strict();

export const outfitRecommendationRequestSchema = z
  .object({
    wardrobe_id: z.uuid(),
    occasion: z.enum(outfitOccasions),
    temperature: z.number().min(-40).max(55).default(18),
    weather: z.string().trim().max(140).optional(),
    requirements: z.string().trim().max(500).optional(),
    language: z.enum(['en', 'pl']).optional(),
    count: z.number().int().min(1).max(6).default(4),
  })
  .strict();
export const geminiOutfitSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(100),
    garment_ids: z.array(z.uuid()).min(1).max(12),
    rationale: z.string().trim().min(1).max(500),
    missing_items: z.array(savedOutfitMissingItemSchema).max(2).default([]),
    wearing_tips: z.string().trim().max(300).optional(),
  })
  .strict();
export const geminiOutfitResultSchema = z
  .object({ outfits: z.array(geminiOutfitSchema).max(6) })
  .strict();
export const geminiTaskKindSchema = z.enum([
  'connection_test',
  'list_models',
  'outfit_recommendation',
  'travel_packing',
]);
export const geminiTaskSchema = z.object({
  id: z.uuid(),
  kind: geminiTaskKindSchema,
  status: z.enum(['queued', 'running', 'retrying', 'completed', 'failed', 'cancelled']),
  result: z
    .object({
      models: z.array(z.object({ name: geminiModelSchema, displayName: z.string() })).optional(),
      message: z.string().optional(),
      outfits: z.array(geminiOutfitSchema).optional(),
      items: z.array(packingItemSchema).optional(),
    })
    .nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const geminiSettingsSchema = z.object({
  configured: z.boolean(),
  key_hint: z.string().nullable(),
  model: geminiModelSchema.nullable(),
  rpm_limit: z.number().int().positive(),
  queue_limit: z.number().int().positive(),
  active_task: geminiTaskSchema.nullable(),
});
export const geminiTaskCreateSchema = z.object({ id: z.uuid(), status: z.string() });
export const geminiCredentialStatusSchema = z.object({
  configured: z.boolean(),
  key_hint: z.string().nullable().optional(),
  model: geminiModelSchema.nullable().optional(),
  ok: z.boolean().optional(),
});
export type GeminiSettings = z.infer<typeof geminiSettingsSchema>;
export type GeminiTask = z.infer<typeof geminiTaskSchema>;
export type OutfitRecommendationRequest = z.infer<typeof outfitRecommendationRequestSchema>;
export type GeminiOutfit = z.infer<typeof geminiOutfitSchema>;
