import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';

const { createAdapter } = createRequire(import.meta.url)(
  '../infra/storage-sidecars/file-sidecars.cjs',
);
const cleanup: string[] = [];
afterEach(() => {
  for (const root of cleanup.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const parent = resolve('investigation/tmp/storage-sidecars');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'unit-'));
  cleanup.push(root);
  const images = join(root, 'images'),
    metadata = join(root, 'metadata');
  mkdirSync(images);
  const adapter = createAdapter(images, metadata);
  const file = join(images, '.upload.tmp');
  writeFileSync(file, Buffer.from([1, 2, 3]));
  return { root, images, metadata, file, adapter };
}
it('preserves image bytes and persistent metadata across staged rename, copy and deletion', async () => {
  const { images, metadata, file, adapter } = fixture();
  adapter.setAttributeSync(file, 'user.supabase.content-type', 'image/jpeg');
  adapter.setAttributeSync(file, 'user.supabase.cache-control', 'max-age=3600');
  const destination = join(images, 'photo.jpg');
  await adapter.rename(file, destination);
  const restarted = createAdapter(images, metadata);
  expect(restarted.getAttributeSync(destination, 'user.supabase.content-type').toString()).toBe(
    'image/jpeg',
  );
  expect(restarted.getAttributeSync(destination, 'user.supabase.cache-control').toString()).toBe(
    'max-age=3600',
  );
  expect(readFileSync(destination)).toEqual(Buffer.from([1, 2, 3]));
  expect(readdirSync(metadata)).toHaveLength(1);
  restarted.removeAttributeSync(destination, 'user.supabase.cache-control');
  expect(() => restarted.getAttributeSync(destination, 'user.supabase.cache-control')).toThrow(
    'Attribute not found',
  );
  await restarted.unlink(destination);
  expect(readdirSync(metadata)).toEqual([]);
});
it('serializes metadata updates without lost attributes', async () => {
  const { file, adapter } = fixture();
  await Promise.all(
    ['content-type', 'cache-control', 'content-encoding'].map(async (key) =>
      adapter.setAttributeSync(file, 'user.supabase.' + key, key),
    ),
  );
  for (const key of ['content-type', 'cache-control', 'content-encoding'])
    expect(adapter.getAttributeSync(file, 'user.supabase.' + key).toString()).toBe(key);
});
it('restores destination metadata when publication fails', async () => {
  const { images, file, adapter } = fixture();
  const destination = join(images, 'directory');
  mkdirSync(destination);
  adapter.setAttributeSync(file, 'user.supabase.content-type', 'image/png');
  await expect(adapter.rename(file, destination)).rejects.toThrow();
  expect(adapter.getAttributeSync(file, 'user.supabase.content-type').toString()).toBe('image/png');
  expect(() => adapter.getAttributeSync(destination, 'user.supabase.content-type')).toThrow(
    'Attribute not found',
  );
});
it('rejects escapes, symlinks, unsupported attributes and corrupt metadata', () => {
  const { root, images, metadata, file, adapter } = fixture();
  expect(() =>
    adapter.setAttributeSync(join(root, 'outside'), 'user.supabase.etag', 'x'),
  ).toThrow();
  symlinkSync(root, join(images, 'escape'));
  expect(() =>
    adapter.getAttributeSync(join(images, 'escape', 'outside'), 'user.supabase.etag'),
  ).toThrow();
  expect(() => adapter.setAttributeSync(file, '__proto__', 'x')).toThrow('Unsupported');
  adapter.setAttributeSync(file, 'user.supabase.etag', 'x');
  writeFileSync(join(metadata, readdirSync(metadata)[0]), '{broken');
  expect(() => adapter.getAttributeSync(file, 'user.supabase.etag')).toThrow();
});
it('removes multipart sidecars without affecting other objects', async () => {
  const { images, file, adapter, metadata } = fixture();
  const directory = join(images, 'multiparts', 'upload');
  mkdirSync(directory, { recursive: true });
  const part = join(directory, 'part-1');
  writeFileSync(part, 'part');
  adapter.setAttributeSync(part, 'user.supabase.etag', 'part-etag');
  adapter.setAttributeSync(file, 'user.supabase.etag', 'original-etag');
  await adapter.removePath(directory);
  expect(readdirSync(metadata)).toHaveLength(1);
  expect(adapter.getAttributeSync(file, 'user.supabase.etag').toString()).toBe('original-etag');
});
