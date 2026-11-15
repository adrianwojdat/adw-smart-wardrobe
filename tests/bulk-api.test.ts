import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))(
  'sharp',
) as typeof import('../apps/api/node_modules/sharp');

import { randomUUID } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('../apps/api/src/modules/auth/session.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../apps/api/src/modules/auth/session.js')>();

  return {
    ...original,
    sessions: () => ({ load: mocks.load, close: vi.fn(), pool: { end: vi.fn(), on: vi.fn() } }),
  };
});
import { buildApp } from '../apps/api/src/app/app.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
const id = randomUUID(),
  wardrobe = randomUUID(),
  user = randomUUID(),
  imageId = randomUUID();
let images: Record<string, unknown>[] = [];
let duplicate = false;
let imageInsertFails = false;
let owner = user;

function from(table: string) {
  let inserted = false;
  const chain = {
    select: () => chain,
    eq: () => chain,
    insert: (data: unknown) => {
      inserted = true;
      mocks.insert(table, data);

      return chain;
    },
    single: async () => {
      if (table === 'garments')
        return inserted && duplicate
          ? { data: null, error: { code: '23505' } }
          : {
              data: { id, wardrobe_id: wardrobe, owner_id: owner, name: 'Ubranie ' + id },
              error: null,
            };
      if (inserted && imageInsertFails) return { data: null, error: { code: 'error' } };

      const row = { id: imageId, garment_id: id, path: 'private.original' };

      images = [row];

      return { data: row, error: null };
    },
    then: (resolve: (value: unknown) => void) => resolve({ data: images, error: null }),
  };

  return chain;
}

beforeAll(async () => {
  app = await buildApp({
    NODE_ENV: 'test',
    PORT: 3000,
    APP_ORIGIN: 'http://localhost:8080',
    COOKIE_SECURE: false,
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_ANON_KEY: 'a'.repeat(40),
    SESSION_DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused',
    SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
    SMTP_ENABLED: '',
    EMAIL_AUTOCONFIRM: 'true',
  });
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  vi.clearAllMocks();
  images = [];
  duplicate = false;
  imageInsertFails = false;
  owner = user;
  mocks.upload.mockResolvedValue({ data: {}, error: null });
  mocks.load.mockResolvedValue({
    user: { id: user },
    sb: {
      from,
      rpc: async () => ({ data: true, error: null }),
      storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
    },
  });
});

const headers = { origin: 'http://localhost:8080', cookie: 'sw_csrf=test', 'x-csrf-token': 'test' };

async function photo() {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#314c40' } })
    .png()
    .toBuffer();

  return Buffer.concat([
    Buffer.from(
      '--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n',
    ),
    bytes,
    Buffer.from('\r\n--test-boundary--\r\n'),
  ]);
}

async function upload() {
  return app.inject({
    method: 'POST',
    url: `/api/garments/${id}/images?upload_id=${imageId}`,
    headers: { ...headers, 'content-type': 'multipart/form-data; boundary=test-boundary' },
    payload: await photo(),
  });
}

describe('bulk API retry semantics (mocked Supabase)', () => {
  it('returns the same garment after a lost create response without updating it', async () => {
    duplicate = true;

    const result = await app.inject({
      method: 'POST',
      url: '/api/garments',
      headers,
      payload: { id, wardrobe_id: wardrobe, category: 'tops' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json().id).toBe(id);
  });
  it('refuses replaying a different user’s garment ID', async () => {
    duplicate = true;
    owner = randomUUID();

    const result = await app.inject({
      method: 'POST',
      url: '/api/garments',
      headers,
      payload: { id, wardrobe_id: wardrobe, category: 'tops' },
    });

    expect(result.statusCode).toBe(403);
  });
  it('reuses the image ID and original path on retry, without overwriting the original', async () => {
    expect((await upload()).statusCode).toBe(200);
    expect((await upload()).statusCode).toBe(200);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[0]?.[0]).toBe(`${wardrobe}/${id}/${imageId}.original`);
    expect(mocks.upload.mock.calls[0]?.[2]).toEqual({ contentType: 'image/png', upsert: false });
    expect(mocks.insert.mock.calls.filter((call) => call[0] === 'garment_images')).toHaveLength(1);
  });
  it('recovers an original stored before a failed image-record insert', async () => {
    imageInsertFails = true;
    expect((await upload()).statusCode).toBe(400);
    imageInsertFails = false;
    mocks.upload.mockResolvedValue({
      data: null,
      error: { statusCode: '409', message: 'The resource already exists' },
    });
    expect((await upload()).statusCode).toBe(200);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
