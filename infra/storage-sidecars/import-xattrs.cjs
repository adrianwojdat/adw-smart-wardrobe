/* eslint-disable @typescript-eslint/no-require-imports -- Supabase backend uses CommonJS. */
// Offline migration helper: read-only images and a fresh metadata directory.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createAdapter } = require('./file-sidecars.cjs');
const [imageRoot, metadataRoot, manifestFile, xattrsFile] = process.argv.slice(2);
if (!imageRoot || !metadataRoot || !manifestFile || !xattrsFile)
  throw new Error('Expected image root, fresh metadata root, manifest and xattrs JSON');
fs.mkdirSync(metadataRoot, { recursive: true, mode: 0o700 });
if (fs.readdirSync(metadataRoot).length) throw new Error('Metadata destination must be empty');
const rows = JSON.parse(fs.readFileSync(manifestFile, 'utf8')).filter((row) => row.type === 'file');
const attrs = new Map(
  JSON.parse(fs.readFileSync(xattrsFile, 'utf8')).map((row) => [row.path, row.attributes]),
);
const adapter = createAdapter(imageRoot, metadataRoot);
// Validate the complete input and all image hashes before writing any metadata.
for (const row of rows) {
  const file = path.resolve(imageRoot, row.path);
  if (!file.startsWith(path.resolve(imageRoot) + path.sep))
    throw new Error('Invalid manifest path');
  const stat = fs.lstatSync(file);
  if (
    !stat.isFile() ||
    stat.size !== row.size ||
    createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== row.sha256
  )
    throw new Error('Image manifest mismatch');
  if (!attrs.has(row.path)) throw new Error('Missing xattr manifest entry');
  for (const [key, value] of Object.entries(attrs.get(row.path))) {
    if (
      !/^user\.supabase\.(cache-control|content-type|content-encoding|etag)$/.test(key) ||
      typeof value !== 'string' ||
      Buffer.from(value, 'base64').toString('base64') !== value
    )
      throw new Error('Invalid xattr manifest');
  }
}
let attributes = 0;
for (const row of rows) {
  const file = path.resolve(imageRoot, row.path);
  for (const [key, value] of Object.entries(attrs.get(row.path))) {
    adapter.setAttributeSync(file, key, Buffer.from(value, 'base64'));
    if (adapter.getAttributeSync(file, key).toString('base64') !== value)
      throw new Error('Metadata round-trip mismatch');
    attributes++;
  }
}
console.log(JSON.stringify({ files: rows.length, attributes, hashesVerified: true }));
