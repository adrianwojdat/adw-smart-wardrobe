import { z } from 'zod';
import {
  garmentSchema,
  wardrobeSchema,
  meSchema,
  imageSchema,
  jobSchema,
  outfitSchema,
  memberSchema,
  type GarmentInput,
  type ApiContract,
  type OutfitInput,
} from '@wardrobe/shared';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let csrf: string | undefined;
async function csrfToken() {
  if (!csrf) {
    const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    if (!r.ok) throw new ApiError(r.status, 'Nie można połączyć się z serwerem.');
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
    throw new ApiError(0, 'Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 403) csrf = undefined;
    throw new ApiError(response.status, data.message ?? 'Nie udało się wykonać operacji.');
  }
  return schema.parse(await response.json());
}
const ok = z.object({ ok: z.boolean() });
export const api = {
  me: () => request('/api/auth/me', meSchema),
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
  createGarment: (data: GarmentInput) => request('/api/garments', garmentSchema, 'POST', data),
  updateGarment: (id: string, data: Partial<GarmentInput>) =>
    request('/api/garments/' + id, garmentSchema, 'PATCH', data),
  deleteGarment: (id: string) => request('/api/garments/' + id, ok, 'DELETE'),
  upload: (id: string, file: File, kind: 'garment' | 'label' = 'garment') => {
    const form = new FormData();
    form.append('file', file);
    return request(`/api/garments/${id}/images?kind=${kind}`, imageSchema, 'POST', form);
  },
  jobs: (id: string) => request('/api/jobs?garment_id=' + id, z.array(jobSchema)),
  retry: (id: string) => request('/api/jobs/' + id + '/retry', jobSchema, 'POST'),
  members: (id: string) => request('/api/wardrobes/' + id + '/members', z.array(memberSchema)),
  outfits: () => request('/api/outfits', z.array(outfitSchema)),
  saveOutfit: (data: OutfitInput) => request('/api/outfits', outfitSchema, 'POST', data),
  recommendations: (wardrobe_id: string, occasion: OutfitInput['occasion'], temperature: number) =>
    request(
      '/api/recommendations',
      z.object({ source: z.literal('rules'), outfits: z.array(z.array(garmentSchema)) }),
      'POST',
      { wardrobe_id, occasion, temperature },
    ),
};
