import { z } from 'zod';

import {
  type ApiContract,
  customPropertyDefinitionSchema,
  customPropertyOptionSchema,
  customPropertyTypes,
  customPropertyValueSchema,
  type GarmentInput,
  garmentSchema,
  geminiTaskSchema,
  imageSchema,
  jobSchema,
  memberSchema,
  meSchema,
  type OutfitInput,
  outfitRecommendationRequestSchema,
  outfitSchema,
  styleProfileSchema,
  type StyleProfileUpdate,
  wardrobeSchema,
} from '@wardrobe/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

let csrf: string | undefined;

async function csrfToken() {
  if (!csrf) {
    const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });

    if (!r.ok) throw new ApiError(r.status, 'Request failed.');
    csrf = (await r.json()).token;
  }

  return csrf!;
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};

  if (method !== 'GET') headers['x-csrf-token'] = await csrfToken();
  if (body !== undefined && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json';

  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network request failed.');
  }

  if (!response.ok) {
    const raw: unknown = await response.json().catch(() => null);
    const parsed = z
      .object({ message: z.string().optional(), code: z.string().optional() })
      .safeParse(raw);
    const data = parsed.success ? parsed.data : {};

    if (response.status === 403) csrf = undefined;
    throw new ApiError(response.status, data.message ?? 'Request failed.', data.code);
  }

  return schema.parse(await response.json());
}

const ok = z.object({ ok: z.boolean() });

export const api = {
  me: () => request('/api/auth/me', meSchema),
  styleProfile: () => request('/api/profile/style', styleProfileSchema),
  saveStyleProfile: (patch: StyleProfileUpdate) =>
    request('/api/profile/style', styleProfileSchema, 'PATCH', patch),
  login: (body: ApiContract['/api/auth/login']['POST']['body']) =>
    request('/api/auth/login', meSchema, 'POST', body),
  register: (body: ApiContract['/api/auth/register']['POST']['body']) =>
    request('/api/auth/register', z.object({ confirmationRequired: z.boolean() }), 'POST', body),
  logout: async () => {
    await request('/api/auth/logout', ok, 'POST');
    csrf = undefined;
  },
  wardrobes: () => request('/api/wardrobes', z.array(wardrobeSchema)),
  createWardrobe: (name: string, kind: 'private' | 'family') =>
    request('/api/wardrobes', wardrobeSchema, 'POST', { name, kind }),
  garments: async (wardrobeId?: string, archived = false) => {
    const all: z.infer<typeof garmentSchema>[] = [];

    for (let offset = 0; ; offset += 100) {
      const batch = await request(
        `/api/garments?offset=${offset}&archived=${archived}${wardrobeId ? '&wardrobe_id=' + wardrobeId : ''}`,
        z.array(garmentSchema),
      );

      all.push(...batch);
      if (batch.length < 100) return all;
    }
  },
  garment: (id: string) => request('/api/garments/' + id, garmentSchema),
  createGarment: (data: GarmentInput & { id?: string }) =>
    request('/api/garments', garmentSchema, 'POST', data),
  updateGarment: (id: string, data: Partial<GarmentInput>) =>
    request('/api/garments/' + id, garmentSchema, 'PATCH', data),
  customProperties: (wardrobeId: string) =>
    request(
      `/api/wardrobes/${wardrobeId}/custom-properties`,
      z.array(customPropertyDefinitionSchema),
    ),
  createCustomProperty: (
    wardrobeId: string,
    data: {
      name: string;
      type: (typeof customPropertyTypes)[number];
      sort_order: number;
      visible: boolean;
    },
  ) =>
    request(
      `/api/wardrobes/${wardrobeId}/custom-properties`,
      customPropertyDefinitionSchema,
      'POST',
      data,
    ),
  updateCustomProperty: (
    id: string,
    data: { name?: string; sort_order?: number; visible?: boolean },
  ) => request(`/api/custom-properties/${id}`, customPropertyDefinitionSchema, 'PATCH', data),
  addCustomPropertyOption: (id: string, label: string) =>
    request(`/api/custom-properties/${id}/options`, customPropertyOptionSchema, 'POST', { label }),
  customPropertyValues: (garmentId: string) =>
    request(`/api/garments/${garmentId}/custom-properties`, z.array(customPropertyValueSchema)),
  saveCustomPropertyValue: (garmentId: string, propertyId: string, value: unknown) =>
    request(
      `/api/garments/${garmentId}/custom-properties/${propertyId}`,
      customPropertyValueSchema,
      'PUT',
      { value },
    ),
  clearCustomPropertyValue: (garmentId: string, propertyId: string) =>
    request(`/api/garments/${garmentId}/custom-properties/${propertyId}`, ok, 'DELETE'),
  deleteGarment: (id: string) => request('/api/garments/' + id, ok, 'DELETE'),
  upload: (id: string, file: File, kind: 'garment' | 'label' = 'garment', uploadId?: string) => {
    const form = new FormData();

    form.append('file', file);

    return request(
      `/api/garments/${id}/images?kind=${kind}${uploadId ? '&upload_id=' + uploadId : ''}`,
      imageSchema,
      'POST',
      form,
    );
  },
  jobs: (id: string) => request('/api/jobs?garment_id=' + id, z.array(jobSchema)),
  retry: (id: string) => request('/api/jobs/' + id + '/retry', jobSchema, 'POST'),
  members: (id: string) => request('/api/wardrobes/' + id + '/members', z.array(memberSchema)),
  outfits: () => request('/api/outfits', z.array(outfitSchema)),
  saveOutfit: (data: OutfitInput) => request('/api/outfits', outfitSchema, 'POST', data),
  recommendations: (criteria: z.infer<typeof outfitRecommendationRequestSchema>) =>
    request('/api/recommendations', geminiTaskSchema, 'POST', criteria),
  geminiTask: (id: string) => request(`/api/gemini/tasks/${id}`, geminiTaskSchema),
  cancelGeminiTask: (id: string) =>
    request(`/api/gemini/tasks/${id}/cancel`, geminiTaskSchema, 'POST', {}),
};

export const imageUrl = (
  image: { id: string; path: string; revision?: number; catalog_path?: string | null },
  variant: 'catalog' | 'thumbnail' | 'original' | 'cutout' = 'catalog',
) =>
  `/api/images/${image.id}?variant=${variant}&v=${encodeURIComponent((image.catalog_path ?? image.path) + ':' + (image.revision ?? 0))}`;
