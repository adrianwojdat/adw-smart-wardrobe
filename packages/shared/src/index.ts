export * from './accessories.js';
export * from './vocabulary.js';
export * from './garment.js';
export * from './warmth.js';
export * from './readiness.js';
export * from './style-profile.js';
export * from './gemini.js';
import type { GeminiSettings, GeminiTask, OutfitRecommendationRequest } from './gemini.js';
import { savedOutfitMissingItemSchema } from './gemini.js';
import type { StyleProfile, StyleProfileUpdate } from './style-profile.js';
import { deriveWarmth } from './warmth.js';

export * from './locale.js';
import { z } from 'zod';

import type { Garment, GarmentInput } from './garment.js';
import { garmentInput } from './garment.js';
import { categoryLabels, occasionLabels, occasions, seasonLabels, uuid } from './vocabulary.js';

export const customPropertyTypes = [
  'text',
  'number',
  'currency',
  'date',
  'select',
  'multi_select',
  'boolean',
] as const;
export const customPropertyOptionSchema = z.object({
  id: z.uuid(),
  property_id: z.uuid(),
  wardrobe_id: z.uuid(),
  label: z.string(),
  sort_order: z.number().int(),
  created_at: z.string(),
});
export const customPropertyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(customPropertyTypes),
  sort_order: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
});
export const customPropertyPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sort_order: z.number().int().min(0).optional(),
    visible: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const customPropertyDefinitionSchema = z.object({
  id: z.uuid(),
  wardrobe_id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  type: z.enum(customPropertyTypes),
  sort_order: z.number().int().min(0),
  visible: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  garment_property_options: z.array(customPropertyOptionSchema).default([]),
});
export const customPropertyOptionCreateSchema = z
  .object({ label: z.string().trim().min(1).max(120) })
  .strict();
export const customPropertyValueSchema = z.object({
  garment_id: z.uuid(),
  property_id: z.uuid(),
  wardrobe_id: z.uuid(),
  value: z.unknown(),
  updated_at: z.string(),
});
export type CustomPropertyType = (typeof customPropertyTypes)[number];
export type CustomPropertyDefinition = z.infer<typeof customPropertyDefinitionSchema>;
export type CustomPropertyValue = z.infer<typeof customPropertyValueSchema>;

const short = z.string().trim().max(120);

export const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12, 'The password must contain at least 12 characters').max(128),
  name: short.min(1),
});
export const loginSchema = registerSchema
  .pick({ email: true, password: true })
  .extend({ password: z.string().min(1).max(128), rememberMe: z.boolean().optional() });
export const wardrobeInput = z.object({
  name: short.min(1),
  kind: z.enum(['private', 'family']).default('private'),
});
export const aiPreferencesSchema = z.object({ ai_overwrite_metadata: z.boolean() }).strict();
export const wardrobeSchema = wardrobeInput.extend({
  id: uuid,
  owner_id: uuid,
  created_at: z.string(),
});
export type Wardrobe = z.infer<typeof wardrobeSchema>;
export const jobSchema = z.object({
  id: uuid,
  wardrobe_id: uuid,
  garment_id: uuid,
  image_id: uuid,
  requested_by: uuid,
  type: z.enum(['process_image', 'analyze_garment', 'analyze_label']),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  progress: z.number(),
  attempts: z.number(),
  error: z.string().nullable(),
  result: z.unknown().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Job = z.infer<typeof jobSchema>;
export const meSchema = z.object({ id: uuid, email: z.string(), name: z.string() });
export type Me = z.infer<typeof meSchema>;
export const memberSchema = z.object({
  wardrobe_id: uuid,
  user_id: uuid,
  role: z.enum(['owner', 'editor', 'viewer']),
  created_at: z.string(),
});
export const outfitInput = z.object({
  wardrobe_id: uuid,
  name: short.min(1),
  occasion: z.enum(occasions),
  garment_ids: z.array(uuid).min(1).max(12),
  temperature: z.number().min(-40).max(55).optional(),
  rationale: z.string().trim().max(500).optional(),
  wearing_tips: z.string().trim().max(300).optional(),
  missing_items: z.array(savedOutfitMissingItemSchema).max(2).optional(),
});
export type OutfitInput = z.infer<typeof outfitInput>;
export const outfitSchema = outfitInput.extend({
  temperature: z.number().min(-40).max(55).nullable().optional(),
  id: uuid,
  created_by: uuid,
  created_at: z.string(),
  rationale: z.string().nullable().default(null),
  wearing_tips: z.string().nullable().default(null),
  missing_items: z.array(savedOutfitMissingItemSchema).default([]),
});
export type Outfit = z.infer<typeof outfitSchema>;
export { generateOutfits as recommend } from './outfit-engine.js';
export * from './outfit-engine.js';
export interface ApiContract {
  '/api/gemini/settings': { GET: { response: GeminiSettings } };
  '/api/gemini/tasks': { POST: { response: GeminiTask } };
  '/api/recommendations': { POST: { body: OutfitRecommendationRequest; response: GeminiTask } };
  '/api/auth/me': { GET: { response: Me } };
  '/api/profile/style': {
    GET: { response: StyleProfile };
    PATCH: { body: StyleProfileUpdate; response: StyleProfile };
  };
  '/api/auth/login': { POST: { body: z.infer<typeof loginSchema>; response: Me } };
  '/api/auth/register': {
    POST: { body: z.infer<typeof registerSchema>; response: { confirmationRequired: boolean } };
  };
  '/api/wardrobes': {
    GET: { response: Wardrobe[] };
    POST: { body: z.input<typeof wardrobeInput>; response: Wardrobe };
  };
  '/api/garments': {
    GET: { response: Garment[] };
    POST: { body: GarmentInput; response: Garment };
  };
}

export const aiAnalysisSchema = z.object({
  auto_applied: z.boolean().optional(),
  source: z.enum(['photo', 'label']),
  confidence: z.number().min(0).max(1),
  uncertainties: z.array(z.string().max(500)).max(30),
  text: z.string().max(8000).optional(),
  suggestions: z.object({
    pattern: garmentInput.shape.pattern,
    name: garmentInput.shape.name.optional(),
    category: garmentInput.shape.category.optional(),
    subcategory: garmentInput.shape.subcategory.removeDefault().optional(),
    primary_color: garmentInput.shape.primary_color.removeDefault().optional(),
    secondary_color: garmentInput.shape.secondary_color.removeDefault().optional(),
    brand: garmentInput.shape.brand.removeDefault().optional(),
    size: garmentInput.shape.size.removeDefault().optional(),
    material: garmentInput.shape.material.removeDefault().optional(),
    material_source: garmentInput.shape.material_source.removeDefault().optional(),
    seasons: garmentInput.shape.seasons.removeDefault().optional(),
    style: garmentInput.shape.style.removeDefault().optional(),
    occasions: garmentInput.shape.occasions.removeDefault().optional(),
    thickness: garmentInput.shape.thickness.removeDefault().optional(),
    warmth: garmentInput.shape.warmth.removeDefault().optional(),
  }),
  care: z.array(z.string().max(500)).max(30).optional(),
  classifier: z
    .object({
      provider: z.literal('fashion-siglip'),
      model: z.string(),
      elapsed_ms: z.number().nonnegative(),
      category: z
        .array(z.object({ label: z.string(), label_pl: z.string(), score: z.number().finite() }))
        .max(5),
      color: z
        .array(z.object({ label: z.string(), label_pl: z.string(), score: z.number().finite() }))
        .max(5),
      pattern: z
        .array(z.object({ label: z.string(), label_pl: z.string(), score: z.number().finite() }))
        .max(5),
    })
    .optional(),
});
export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
export const orientationSchema = z.object({
  rotation: z.enum(['0', '90', '180', '270']),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(500),
});

import {
  localizedAiText,
  polishColor,
  polishGarmentName,
  polishStyle,
  polishSubcategory,
} from './locale.js';

export function localizeAnalysis(input: AiAnalysis): AiAnalysis {
  const result = structuredClone(input),
    s = result.suggestions;

  if (s.primary_color) s.primary_color = polishColor(s.primary_color);
  if (s.secondary_color) s.secondary_color = polishColor(s.secondary_color);
  if (s.style) s.style = polishStyle(s.style);
  if (s.name || s.category)
    s.name = polishGarmentName({ ...input.suggestions, primary_color: s.primary_color });
  if (s.subcategory) s.subcategory = polishSubcategory(s.subcategory);

  if (result.source === 'photo') {
    const warmth = deriveWarmth(
      s.category ?? '',
      input.suggestions.subcategory || input.suggestions.name,
    );

    if (warmth !== undefined) s.warmth = warmth;
    else delete s.warmth;
  }

  result.uncertainties = result.uncertainties.map(localizedAiText);
  if (result.care) result.care = result.care.map(localizedAiText);

  // Brand, product identifiers, material read from label, and verbatim OCR text are preserved.
  return result;
}

export function aiValueLabel(field: string, value: unknown): string {
  const dictionaries: Record<string, Record<string, string>> = {
    category: categoryLabels,
    seasons: seasonLabels,
    occasions: occasionLabels,
    thickness: { thin: 'Thin', medium: 'Medium', thick: 'Thick' },
    material_source: { user: 'Entered manually', label: 'From the care label', unknown: 'Unknown' },
  };

  return Array.isArray(value)
    ? value.map((v) => aiValueLabel(field, v)).join(', ')
    : (dictionaries[field]?.[String(value)] ?? String(value));
}

export * from './outfit-scoring.js';

export * from './travel-packing.js';

export * from './travel-packing/catalog.js';
export * from './travel-packing/rules.js';
