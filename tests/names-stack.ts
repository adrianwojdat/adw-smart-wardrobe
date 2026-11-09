/** Run only after approved 0006 migration/deployment. Creates isolated test records. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const origin = 'http://localhost:8080',
  cookies = new Map<string, string>();
let csrf = '';
async function api(path: string, method = 'GET', body?: unknown, expected = 200) {
  if (method !== 'GET' && !csrf) csrf = (await api('/api/auth/csrf')).token;
  const r = await fetch(origin + path, {
    method,
    headers: {
      origin,
      cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(method === 'GET' ? {} : { 'x-csrf-token': csrf, 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const cookie of r.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]!,
      i = pair.indexOf('=');
    cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
  assert.equal(r.status, expected, `${method} ${path}: ${r.status}`);
  return r.json();
}
await api('/api/auth/register', 'POST', {
  email: `names-${randomUUID()}@example.com`,
  password: randomUUID() + '!',
  name: 'Naming verification',
});
const wardrobe = await api('/api/wardrobes', 'POST', {
  name: 'Naming integration',
  kind: 'private',
});
const garments = await Promise.all(
  Array.from({ length: 12 }, () =>
    api('/api/garments', 'POST', { wardrobe_id: wardrobe.id, category: 'tops' }),
  ),
);
assert.equal(new Set(garments.map((g) => g.name)).size, 12);
assert(garments.every((g) => g.name === 'Ubranie ' + g.id && g.name_source === 'temporary'));
console.log('PASS: 12 concurrent unnamed creates produce distinct stable temporary names');
const workerCode = `import{createRequire}from'node:module';const require=createRequire('/app/apps/worker/package.json');const{Pool}=require('pg');const p=new Pool({connectionString:process.env.WORKER_DATABASE_URL,max:8});const ids=${JSON.stringify(garments.map((g) => g.id))};try{await Promise.all(ids.map(id=>p.query("update public.garments set name='Biała koszula',name_source='ai' where id=$1 and name_source='temporary'",[id])));}finally{await p.end();}`;
execFileSync('docker', ['compose', 'exec', '-T', 'worker', 'node', '--input-type=module'], {
  input: workerCode,
  stdio: ['pipe', 'pipe', 'pipe'],
});
const named = await Promise.all(garments.map((g) => api('/api/garments/' + g.id)));
assert.equal(new Set(named.map((g) => g.name)).size, 12);
assert(named.every((g) => g.name_source === 'ai'));
assert(named.some((g) => g.name === 'Biała koszula'));
assert(named.some((g) => g.name === 'Biała koszula 11'));
console.log('PASS: concurrent worker naming assigns one base name plus unique suffixes');
await api('/api/garments/' + garments[0].id, 'PATCH', { name: 'Moja własna nazwa' });
execFileSync('docker', ['compose', 'exec', '-T', 'worker', 'node', '--input-type=module'], {
  input: workerCode,
  stdio: ['pipe', 'pipe', 'pipe'],
});
const manual = await api('/api/garments/' + garments[0].id);
assert.equal(manual.name, 'Moja własna nazwa');
assert.equal(manual.name_source, 'manual');
await api('/api/garments/' + garments[0].id, 'PATCH', { favorite: true });
assert.equal((await api('/api/garments/' + garments[0].id)).name, manual.name);
await api(
  '/api/garments',
  'POST',
  { wardrobe_id: wardrobe.id, category: 'tops', name: 'Moja własna nazwa' },
  400,
);
console.log(
  'PASS: manual name survives worker retry and unrelated edit; duplicate manual name rejected',
);
for (const g of garments) await api('/api/garments/' + g.id, 'DELETE');
await api('/api/auth/logout', 'POST', {});
console.log(
  'PASS: test garments cleaned through API; no original photos or existing garments changed',
);
