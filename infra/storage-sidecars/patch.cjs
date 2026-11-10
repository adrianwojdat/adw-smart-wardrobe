/* eslint-disable @typescript-eslint/no-require-imports -- Supabase backend uses CommonJS. */
'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const file = '/app/dist/storage/backend/file.js';
let source = fs.readFileSync(file, 'utf8');
// Fail closed when upstream changes: never silently patch an unreviewed release.
if (
  createHash('sha256').update(source).digest('hex') !==
  'd72acb8cf7b8a97572ab5edfbdc84a601a7ce3f542de88fe4672ec4460650181'
)
  throw new Error('Unexpected Supabase file backend; review adapter before upgrading');
function replaceAll(from, to, count) {
  if (source.split(from).length - 1 !== count) throw new Error('Unexpected backend patch sites');
  source = source.replaceAll(from, to);
}
replaceAll(
  'var xattr = __toESM(require("fs-xattr"));',
  'var xattr = require("./file-sidecars.cjs").createAdapter(process.env.FILE_STORAGE_BACKEND_PATH, process.env.FILE_STORAGE_METADATA_PATH);',
  1,
);
replaceAll('await fsp.rename(stagedFile, file);', 'await xattr.rename(stagedFile, file);', 1);
replaceAll(
  'await fsp.rename(stagedFile, partPath);',
  'await xattr.rename(stagedFile, partPath);',
  1,
);
replaceAll('await fsp.unlink(stagedFile)', 'await xattr.unlink(stagedFile)', 2);
replaceAll('await fsp.unlink(file);', 'await xattr.unlink(file);', 1);
replaceAll('(0, import_fs.removePath)(', 'xattr.removePath(', 2);
fs.writeFileSync(file, source);
