import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const origin = 'http://localhost:8080',
  cookies = new Map<string, string>();
let csrf = '';

async function call(path: string, method = 'GET', body?: unknown) {
  if (method !== 'GET' && !csrf) csrf = (await call('/api/auth/csrf')).token;

  const r = await fetch(origin + path, {
    method,
    headers: {
      origin,
      cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(method === 'GET' ? {} : { 'x-csrf-token': csrf }),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });

  for (const cookie of r.headers.getSetCookie()) {
    const [part] = cookie.split(';');
    const n = part!.indexOf('=');

    cookies.set(part!.slice(0, n), part!.slice(n + 1));
  }

  assert.equal(r.status, 200, `${path}: ${r.status}`);
  if (r.headers.get('content-type')?.startsWith('image/'))
    return Buffer.from(await r.arrayBuffer());

  return r.json();
}

const suffix = randomUUID().slice(0, 8);

await call('/api/auth/register', 'POST', {
  email: `pipeline-${suffix}@example.com`,
  password: randomUUID() + '!',
  name: 'Pipeline verification',
});

const w = await call('/api/wardrobes', 'POST', {
  name: 'Pipeline test ' + suffix,
  kind: 'private',
});
const g = await call('/api/garments', 'POST', {
  name: 'Test marynarki na podłodze',
  category: 'outerwear',
  wardrobe_id: w.id,
});
const source = await readFile(process.env.GARMENT_FIXTURE ?? '/tmp/wardrobe-real-jacket.webp');
const form = new FormData();

form.append('file', new Blob([source], { type: 'image/webp' }), 'jacket.webp');

const image = await call(`/api/garments/${g.id}/images`, 'POST', form);
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');

assert.equal(hash(await call(`/api/images/${image.id}?variant=original`)), hash(source));
await call(`/api/images/${image.id}/reprocess`, 'POST', { rotation: 90 });

let current = image;
const deadline = Date.now() + 180000;

while (Date.now() < deadline) {
  const data = await call('/api/garments/' + g.id);

  current = data.garment_images.find((i: { id: string }) => i.id === image.id);
  if (current.process_status === 'completed') break;
  if (current.process_status === 'failed') throw Error(current.processing_error);
  await new Promise((r) => setTimeout(r, 1000));
}

assert.equal(current.process_status, 'completed');
assert(current.catalog_path && current.cutout_path && current.thumbnail_path);
for (const variant of ['cutout', 'catalog', 'thumbnail'])
  await writeFile(
    `/tmp/wardrobe-stack-${variant}.${variant === 'cutout' ? 'png' : 'webp'}`,
    await call(`/api/images/${image.id}?variant=${variant}`),
  );
assert.equal(hash(await call(`/api/images/${image.id}?variant=original`)), hash(source));

const jobs = await call(`/api/jobs?garment_id=${g.id}`);

assert(
  jobs.some(
    (j: { type: string; status: string }) => j.type === 'analyze_garment' && j.status === 'queued',
  ),
);

// Repeat the exact completed CPU job; paths must remain identical.
const job = jobs.find(
  (j: { type: string; revision: number }) =>
    j.type === 'process_image' && j.revision === current.revision,
);

assert.match(job.id, /^[a-f0-9-]{36}$/);
execFileSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  {
    input: `update public.jobs set status='queued',available_at=now() where id='${job.id}';`,
    stdio: ['pipe', 'pipe', 'pipe'],
  },
);

let repeated = false;

for (let i = 0; i < 90; i++) {
  const j = await call(`/api/jobs?garment_id=${g.id}`);

  if (
    j.some(
      (x: { id: string; status: string; attempts: number }) =>
        x.id === job.id && x.status === 'completed' && x.attempts >= 2,
    )
  ) {
    repeated = true;
    break;
  }

  await new Promise((r) => setTimeout(r, 1000));
}

assert(repeated);

const again = (await call('/api/garments/' + g.id)).garment_images.find(
  (i: { id: string }) => i.id === image.id,
);

assert.equal(again.catalog_path, current.catalog_path);
assert.equal(hash(await call(`/api/images/${image.id}?variant=original`)), hash(source));
await writeFile(
  '/tmp/wardrobe-pipeline-browser-session.json',
  JSON.stringify({
    cookies: [...cookies].map(([name, value]) => ({ name, value, url: origin })),
    garmentId: g.id,
    imageId: image.id,
  }),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    garmentId: g.id,
    imageId: image.id,
    originalPreserved: true,
    variantsInStorage: true,
    cpuJobCompleted: true,
    aiQueued: true,
    idempotent: true,
  }),
);
