/** Real-stack integration: API, Storage, Auth, RLS, roles, worker, CSRF. Creates test-only data. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const origin = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

class Browser {
  cookies = new Map<string, string>();
  csrf = '';
  async call(path: string, method = 'GET', body?: unknown, expected = 200) {
    if (method !== 'GET' && !this.csrf) {
      const r = await this.call('/api/auth/csrf');

      this.csrf = r.token;
    }

    const response = await fetch(origin + path, {
      method,
      headers: {
        origin,
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(method === 'GET' ? {} : { 'x-csrf-token': this.csrf }),
        ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });

    for (const cookie of response.headers.getSetCookie()) {
      const part = cookie.split(';')[0]!;
      const index = part.indexOf('=');

      this.cookies.set(part.slice(0, index), part.slice(index + 1));
    }

    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${response.status} ${response.status === expected ? '' : await response.text()}`,
    );
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    if (response.headers.get('content-type')?.includes('image/'))
      return { bytes: (await response.arrayBuffer()).byteLength };

    return await response.json();
  }
}

const suffix = randomUUID().slice(0, 8),
  password = 'Test-Wardrobe-Strong-2026!';
const owner = new Browser(),
  stranger = new Browser();

function sql(text: string) {
  return execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
}

function uid(id: string) {
  assert.match(id, /^[0-9a-f-]{36}$/);

  return id;
}

await owner.call('/api/auth/register', 'POST', {
  email: `owner-${suffix}@example.com`,
  password,
  name: 'Test owner',
});

const me = await owner.call('/api/auth/me');

uid(me.id);
assert(owner.cookies.get('sw_session'));
assert(!owner.cookies.has('access_token'));
await owner.call('/api/auth/logout', 'POST');
owner.csrf = '';
await owner.call('/api/auth/me', 'GET', undefined, 401);
await owner.call('/api/auth/login', 'POST', { email: `owner-${suffix}@example.com`, password });

const wardrobe = await owner.call('/api/wardrobes', 'POST', {
  name: 'Integration ' + suffix,
  kind: 'family',
});

uid(wardrobe.id);

const garment = await owner.call('/api/garments', 'POST', {
  wardrobe_id: wardrobe.id,
  name: 'Test koszulka',
  category: 'tops',
  material: '100% bawełna',
  material_source: 'label',
});

uid(garment.id);

const form = new FormData();

form.append(
  'file',
  new Blob([await readFile('apps/web/public/icon-192.png')], { type: 'image/png' }),
  'test.png',
);

const image = await owner.call(`/api/garments/${garment.id}/images`, 'POST', form);

uid(image.id);
assert((await owner.call('/api/images/' + image.id)).bytes > 0);

if (process.env.TEST_RESTART === 'true') {
  execFileSync('docker', ['compose', 'restart', 'api', 'worker', 'db', 'storage', 'redis'], {
    stdio: 'pipe',
  });

  const deadline = Date.now() + 120000;
  let ready = false;

  while (Date.now() < deadline) {
    const statuses = execFileSync('docker', ['compose', 'ps', '--format', '{{.Health}}'], {
      encoding: 'utf8',
    });

    if (!statuses.includes('starting') && !statuses.includes('unhealthy')) {
      ready = true;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  assert(ready, 'services did not recover after restart');
  assert.equal((await owner.call('/api/auth/me')).id, me.id);
  assert((await owner.call('/api/images/' + image.id)).bytes > 0);
  console.log(
    'PASS: session, garment and private image survived API/worker/DB/Storage/Redis restart',
  );
}

const list = await owner.call('/api/garments');

assert(list.some((g: { id: string }) => g.id === garment.id));
assert.equal((await owner.call('/api/garments/' + garment.id)).garment_images[0].id, image.id);
console.log('PASS: register → logout → login → create wardrobe → upload → catalog → details');
await stranger.call('/api/auth/register', 'POST', {
  email: `stranger-${suffix}@example.com`,
  password,
  name: 'Test stranger',
});

const other = await stranger.call('/api/auth/me');

uid(other.id);
assert.equal((await stranger.call('/api/wardrobes')).length, 0);
await stranger.call('/api/garments/' + garment.id, 'GET', undefined, 404);
await stranger.call('/api/images/' + image.id, 'GET', undefined, 404);
await stranger.call('/api/garments/' + garment.id, 'PATCH', { name: 'Hacked' }, 404);

const csrf = await fetch(origin + '/api/wardrobes', {
  method: 'POST',
  headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'X' }),
});

assert.equal(csrf.status, 403);
sql(
  `begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${other.id}","role":"authenticated"}',true); do $$ begin if (select count(*) from public.garments where id='${garment.id}')<>0 then raise exception 'RLS leak: garments'; end if; if (select count(*) from public.wardrobe_members where wardrobe_id='${wardrobe.id}')<>0 then raise exception 'RLS leak: members'; end if; if (select count(*) from storage.objects where bucket_id='garments' and name like '${wardrobe.id}/%')<>0 then raise exception 'RLS leak: storage'; end if; end $$; rollback;`,
);
console.log('PASS: cross-tenant API + SQL RLS + private Storage + CSRF');

const invite = await owner.call(`/api/wardrobes/${wardrobe.id}/invitations`, 'POST', {
  email: other.email,
  role: 'viewer',
});
const token = new URL(invite.url).searchParams.get('invite');

await stranger.call('/api/invitations/accept', 'POST', { token });
assert.equal((await stranger.call('/api/garments/' + garment.id)).name, 'Test koszulka');
await stranger.call('/api/garments/' + garment.id, 'PATCH', { name: 'Viewer edit' }, 404);
await stranger.call(
  '/api/garments',
  'POST',
  { wardrobe_id: wardrobe.id, name: 'Forbidden', category: 'tops' },
  403,
);
await owner.call(`/api/wardrobes/${wardrobe.id}/members/${other.id}`, 'PATCH', { role: 'editor' });
await stranger.call('/api/garments/' + garment.id, 'PATCH', { name: 'Edited by editor' });
await owner.call(`/api/wardrobes/${wardrobe.id}/members/${other.id}`, 'DELETE');
await stranger.call('/api/garments/' + garment.id, 'GET', undefined, 404);
console.log('PASS: invitation, viewer read-only, editor writes, membership revocation');

const deadline = Date.now() + 90000;
let completed = false;

while (Date.now() < deadline) {
  const jobs = await owner.call('/api/jobs?garment_id=' + garment.id);

  if (jobs.some((j: { status: string }) => j.status === 'completed')) {
    completed = true;
    break;
  }

  await new Promise((r) => setTimeout(r, 1000));
}

assert(completed, 'worker did not complete durable image job');
console.log('PASS: durable outbox → BullMQ → image processing → completed');

const bottom = await owner.call('/api/garments', 'POST', {
  wardrobe_id: wardrobe.id,
  name: 'Test spodnie',
  category: 'bottoms',
});

await owner.call(
  '/api/recommendations',
  'POST',
  {
    wardrobe_id: wardrobe.id,
    occasion: 'everyday',
    temperature: 18,
  },
  400,
);

const outfit = await owner.call('/api/outfits', 'POST', {
  wardrobe_id: wardrobe.id,
  name: 'Test zestaw',
  occasion: 'everyday',
  garment_ids: [garment.id, bottom.id],
});

assert.deepEqual(outfit.garment_ids, [garment.id, bottom.id]);
await owner.call(`/api/garments/${garment.id}/wear`, 'POST', {
  worn_on: new Date().toISOString().slice(0, 10),
});
assert.equal((await owner.call(`/api/garments/${garment.id}`)).cleanliness, 'worn');
console.log(
  'PASS: Gemini-only recommendation path requires a configured user key; outfit persistence and wear history',
);
// Test-only cleanup. No volumes, unrelated users or objects are removed.
await owner.call('/api/garments/' + garment.id, 'DELETE');
await owner.call('/api/garments/' + bottom.id, 'DELETE');
sql(
  `begin; delete from public.wardrobes where id='${wardrobe.id}' and owner_id='${me.id}'; delete from auth.users where id in ('${me.id}','${other.id}') and email in ('owner-${suffix}@example.com','stranger-${suffix}@example.com'); commit;`,
);
console.log('PASS: test records cleaned up; all real-stack checks passed');
