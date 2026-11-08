import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('select pg_advisory_lock(173450001)');
  for (const [role, key] of [
    ['wardrobe_session', 'SESSION_DB_PASSWORD'],
    ['wardrobe_worker', 'WORKER_DB_PASSWORD'],
  ] as const) {
    const password = process.env[key];
    if (!password || !/^[a-f0-9]{64}$/.test(password)) throw Error(`Invalid ${key}: run setup`);
    const exists = await client.query('select 1 from pg_roles where rolname=$1', [role]);
    if (!exists.rowCount) await client.query(`create role ${role} login password '${password}'`);
    else await client.query(`alter role ${role} password '${password}'`);
  }
  await client.query('create schema if not exists private');
  await client.query(
    'create table if not exists private.schema_migrations(name text primary key, checksum text not null, applied_at timestamptz default now())',
  );
  const files = (await readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const name of files) {
    const sql = await readFile(`supabase/migrations/${name}`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const old = await client.query('select checksum from private.schema_migrations where name=$1', [
      name,
    ]);
    if (old.rowCount) {
      if (old.rows[0].checksum !== checksum)
        throw Error(`Migration changed after application: ${name}`);
      continue;
    }
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into private.schema_migrations(name,checksum) values($1,$2)', [
        name,
        checksum,
      ]);
      await client.query('commit');
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.query('select pg_advisory_unlock(173450001)');
  await client.end();
}
