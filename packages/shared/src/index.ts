export * from './accessories.js';
import { recommendBelt } from './accessories.js';
export * from './warmth.js';
import { deriveWarmth } from './warmth.js';
export * from './locale.js';
import { z } from 'zod';
export const uuid = z.uuid();
export const cleanliness = ['clean', 'worn', 'dirty', 'washing', 'drying', 'ironing'] as const;
export const cleanlinessLabels: Record<(typeof cleanliness)[number], string> = {
  clean: 'Czyste',
  worn: 'Noszone',
  dirty: 'Do prania',
  washing: 'W praniu',
  drying: 'Suszenie',
  ironing: 'Do prasowania',
};
export const categories = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
] as const;
export const categoryLabels: Record<(typeof categories)[number], string> = {
  tops: 'Góra',
  bottoms: 'Spodnie i spódnice',
  dresses: 'Sukienki',
  outerwear: 'Okrycia wierzchnie',
  shoes: 'Obuwie',
  accessories: 'Dodatki',
};
export const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
export const seasonLabels = { spring: 'Wiosna', summer: 'Lato', autumn: 'Jesień', winter: 'Zima' };
export const occasions = ['office', 'everyday', 'date', 'evening', 'weekend', 'travel'] as const;
export const occasionLabels = {
  office: 'Do biura',
  everyday: 'Na co dzień',
  date: 'Na randkę',
  evening: 'Na wieczór',
  weekend: 'Na weekend',
  travel: 'W podróż',
};
const short = z.string().trim().max(120);
export const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12, 'Hasło musi mieć co najmniej 12 znaków').max(128),
  name: short.min(1),
});
export const loginSchema = registerSchema
  .pick({ email: true, password: true })
  .extend({ password: z.string().min(1).max(128) });
export const wardrobeInput = z.object({
  name: short.min(1),
  kind: z.enum(['private', 'family']).default('private'),
});
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
  favorite: garmentInput.shape.favorite.removeDefault().optional(),
  archived: garmentInput.shape.archived.removeDefault().optional(),
  notes: garmentInput.shape.notes.removeDefault().optional(),
});
export const aiPreferencesSchema = z.object({ ai_overwrite_metadata: z.boolean() }).strict();
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
});
export type OutfitInput = z.infer<typeof outfitInput>;
export const outfitSchema = outfitInput.extend({
  id: uuid,
  created_by: uuid,
  created_at: z.string(),
});
export type Outfit = z.infer<typeof outfitSchema>;
/** Diverse rule-based suggestions; every ID comes from eligible owned garments. */
export function recommend(
  garments: Garment[],
  occasion: (typeof occasions)[number],
  temperature = 18,
  random: () => number = Math.random,
): Garment[][] {
  const eligible = garments.filter(
    (g) =>
      !g.archived &&
      g.cleanliness === 'clean' &&
      (!g.occasions.length || g.occasions.includes(occasion)) &&
      (g.category === 'accessories' || temperature >= 12 || g.warmth >= 2),
  );
  function shuffled<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }
  const tops = eligible.filter((g) => g.category === 'tops');
  const bottoms = eligible.filter((g) => g.category === 'bottoms');
  const bases: Garment[][] = eligible.filter((g) => g.category === 'dresses').map((g) => [g]);
  for (const top of tops) for (const bottom of bottoms) bases.push([top, bottom]);
  shuffled(bases);
  const usage = new Map<string, number>();
  const selected: Garment[][] = [];
  while (bases.length && selected.length < 6) {
    let best = 0,
      bestMax = Infinity,
      bestAverage = Infinity;
    for (let i = 0; i < bases.length; i++) {
      const counts = bases[i]!.map((g) => usage.get(g.id) ?? 0);
      const max = Math.max(...counts);
      const average = counts.reduce((sum, n) => sum + n, 0) / counts.length;
      if (max < bestMax || (max === bestMax && average < bestAverage)) {
        best = i;
        bestMax = max;
        bestAverage = average;
      }
    }
    const [base] = bases.splice(best, 1);
    selected.push(base!);
    for (const g of base!) usage.set(g.id, (usage.get(g.id) ?? 0) + 1);
  }
  const shoes = shuffled(eligible.filter((g) => g.category === 'shoes'));
  const coats = shuffled(eligible.filter((g) => g.category === 'outerwear'));
  return selected.map((base, i) => {
    const shoe = shoes[i % shoes.length];
    const coat = coats[i % coats.length];
    const outfit = [...base, ...(shoe ? [shoe] : []), ...(temperature < 16 && coat ? [coat] : [])];
    const belt = recommendBelt(outfit, eligible);
    return belt ? [...outfit, belt] : outfit;
  });
}
export interface ApiContract {
  '/api/auth/me': { GET: { response: Me } };
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
  polishColor,
  polishGarmentName,
  polishSubcategory,
  polishStyle,
  localizedAiText,
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
    thickness: { thin: 'Cienkie', medium: 'Średnie', thick: 'Grube' },
    material_source: { user: 'Wpisane ręcznie', label: 'Z metki', unknown: 'Nieznane' },
  };
  return Array.isArray(value)
    ? value.map((v) => aiValueLabel(field, v)).join(', ')
    : (dictionaries[field]?.[String(value)] ?? String(value));
}
