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
  name: short.min(1, 'Podaj nazwę'),
  category: z.enum(categories),
  subcategory: short.default(''),
  brand: short.default(''),
  size: short.default(''),
  primary_color: short.default(''),
  secondary_color: short.default(''),
  material: z.string().trim().max(1000).default(''),
  material_source: z.enum(['user', 'label', 'unknown']).default('unknown'),
  seasons: z.array(z.enum(seasons)).max(4).default([]),
  warmth: z.number().int().min(1).max(5).default(3),
  thickness: z.enum(['thin', 'medium', 'thick']).default('medium'),
  style: short.default(''),
  occasions: z.array(z.enum(occasions)).max(6).default([]),
  cleanliness: z.enum(cleanliness).default('clean'),
  favorite: z.boolean().default(false),
  archived: z.boolean().default(false),
  notes: z.string().trim().max(2000).default(''),
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
});
export const garmentSchema = garmentInput.extend({
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
  type: z.literal('process_image'),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
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
/** Deterministic suggestions only; every ID comes from eligible owned garments. */
export function recommend(
  garments: Garment[],
  occasion: (typeof occasions)[number],
  temperature = 18,
): Garment[][] {
  const eligible = garments.filter(
    (g) =>
      !g.archived &&
      g.cleanliness === 'clean' &&
      (!g.occasions.length || g.occasions.includes(occasion)) &&
      (temperature >= 12 || g.warmth >= 2),
  );
  const tops = eligible.filter((g) => g.category === 'tops');
  const bottoms = eligible.filter((g) => g.category === 'bottoms');
  const dresses = eligible.filter((g) => g.category === 'dresses');
  const shoes = eligible.filter((g) => g.category === 'shoes');
  const bases: Garment[][] = dresses.map((g) => [g]);
  for (const top of tops) for (const bottom of bottoms) bases.push([top, bottom]);
  return bases.slice(0, 6).map((base, i) => {
    const shoe = shoes[i % shoes.length];
    const coat = eligible.find((g) => g.category === 'outerwear');
    return [...base, ...(shoe ? [shoe] : []), ...(temperature < 16 && coat ? [coat] : [])];
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
