import { z } from 'zod';

import { categories, cleanliness, occasions, seasons, uuid, wearConditions } from './vocabulary.js';

const short = z.string().trim().max(120);

export const garmentInput = z.object({
  wardrobe_id: uuid,
  name: short.optional(),
  category: z.enum(categories),
  subcategory: short.default(''),
  pattern: short.optional(),
  brand: short.default(''),
  size: short.default(''),
  primary_color: short.default(''),
  secondary_color: short.default(''),
  material: z.string().trim().max(1000).default(''),
  material_source: z.enum(['user', 'label', 'unknown']).default('unknown'),
  seasons: z.array(z.enum(seasons)).max(4).default([]),
  warmth: z.number().int().min(1).max(5).default(3),
  warmth_manual: z.boolean().optional(),
  thickness: z.enum(['thin', 'medium', 'thick']).default('medium'),
  style: short.default(''),
  occasions: z.array(z.enum(occasions)).max(6).default([]),
  cleanliness: z.enum(cleanliness).default('clean'),
  wear_condition: z.enum(wearConditions).default('unknown'),
  favorite: z.boolean().default(false),
  archived: z.boolean().default(false),
  notes: z.string().trim().max(2000).default(''),
});

// PATCH must preserve absent keys: Zod defaults must not erase unrelated metadata.
export const garmentPatch = garmentInput.partial().extend({
  subcategory: garmentInput.shape.subcategory.removeDefault().optional(),
  brand: garmentInput.shape.brand.removeDefault().optional(),
  size: garmentInput.shape.size.removeDefault().optional(),
  primary_color: garmentInput.shape.primary_color.removeDefault().optional(),
  secondary_color: garmentInput.shape.secondary_color.removeDefault().optional(),
  material: garmentInput.shape.material.removeDefault().optional(),
  material_source: garmentInput.shape.material_source.removeDefault().optional(),
  seasons: garmentInput.shape.seasons.removeDefault().optional(),
  warmth: garmentInput.shape.warmth.removeDefault().optional(),
  thickness: garmentInput.shape.thickness.removeDefault().optional(),
  style: garmentInput.shape.style.removeDefault().optional(),
  occasions: garmentInput.shape.occasions.removeDefault().optional(),
  cleanliness: garmentInput.shape.cleanliness.removeDefault().optional(),
  wear_condition: garmentInput.shape.wear_condition.removeDefault().optional(),
  favorite: garmentInput.shape.favorite.removeDefault().optional(),
  archived: garmentInput.shape.archived.removeDefault().optional(),
  notes: garmentInput.shape.notes.removeDefault().optional(),
});

export type GarmentInput = z.infer<typeof garmentInput>;

export const imageSchema = z.object({
  id: uuid,
  garment_id: uuid,
  wardrobe_id: uuid,
  path: z.string(),
  kind: z.enum(['garment', 'label']),
  width: z.number(),
  height: z.number(),
  created_at: z.string(),
  original_path: z.string(),
  original_mime: z.string(),
  cutout_path: z.string().nullable(),
  catalog_path: z.string().nullable(),
  thumbnail_path: z.string().nullable(),
  revision: z.number(),
  rotation: z.number().nullable(),
  process_status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  stage: z.string(),
  pipeline_version: z.string().nullable(),
  processing_error: z.string().nullable(),
  orientation: z.unknown().nullable(),
  analysis: z.unknown().nullable(),
});

export const garmentSchema = garmentInput.extend({
  name: short.min(1),
  name_source: z.enum(['temporary', 'ai', 'manual']).default('manual'),
  warmth_manual: z.boolean().default(false),
  pattern: short.default(''),
  id: uuid,
  owner_id: uuid,
  created_at: z.string(),
  updated_at: z.string(),
  garment_images: z.array(imageSchema).default([]),
});

export type Garment = z.infer<typeof garmentSchema>;
export type GarmentImage = z.infer<typeof imageSchema>;
