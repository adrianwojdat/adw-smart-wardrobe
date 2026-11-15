/* eslint-disable @typescript-eslint/no-require-imports -- Supabase backend uses CommonJS. */
// Run only against an isolated empty bind mount, never application data.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const { FileBackend } = require('/app/dist/storage/backend/file.js');
const backend = new FileBackend();
const hash = (b) => createHash('sha256').update(b).digest('hex');
const bytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=',
  'base64',
);

async function read(key, version, headers) {
  const response = await backend.getObject('probe', key, version, headers);
  const chunks = [];

  if (response.body) for await (const chunk of response.body) chunks.push(chunk);

  return { ...response, bytes: Buffer.concat(chunks) };
}

async function main() {
  if (process.env.PROBE_PHASE === 'read-after-restart') {
    const result = await read('persist.png', 'v1');

    assert.equal(hash(result.bytes), hash(bytes));
    assert.equal(result.metadata.mimetype, 'image/png');
    assert.equal(result.metadata.cacheControl, 'max-age=123');
    console.log(JSON.stringify({ restartRead: true, sha256: hash(result.bytes) }));

    return;
  }

  assert.deepEqual(fs.readdirSync(process.env.FILE_STORAGE_BACKEND_PATH), []);
  await backend.uploadObject(
    'probe',
    'persist.png',
    'v1',
    Readable.from(bytes),
    'image/png',
    'max-age=123',
  );

  const first = await read('persist.png', 'v1');

  assert.equal(hash(first.bytes), hash(bytes));
  assert.equal(first.metadata.mimetype, 'image/png');

  const range = await read('persist.png', 'v1', { range: 'bytes=0-7' });

  assert.equal(range.httpStatusCode, 206);
  assert.deepEqual(range.bytes, bytes.subarray(0, 8));

  const cached = await read('persist.png', 'v1', { ifNoneMatch: first.metadata.eTag });

  assert.equal(cached.httpStatusCode, 304);
  await backend.copyObject('probe', 'persist.png', 'v1', 'copy.png', 'v2');
  assert.equal((await read('copy.png', 'v2')).metadata.mimetype, 'image/png');
  await backend.deleteObject('probe', 'copy.png', 'v2');
  await assert.rejects(() => read('copy.png', 'v2'));
  await backend.uploadObject(
    'probe',
    'encoded.png',
    'v1',
    Readable.from(bytes),
    'image/png',
    'no-cache',
    undefined,
    undefined,
    'gzip',
  );
  assert.equal((await read('encoded.png', 'v1')).metadata.contentEncoding, 'gzip');
  await backend.deleteObjects('probe', ['encoded.png/v1']);
  await assert.rejects(() => read('encoded.png', 'v1'));

  const uploadId = await backend.createMultiPartUpload(
    'probe',
    'multipart.png',
    'v3',
    'image/png',
    'max-age=456',
  );
  const part = await backend.uploadPart(
    'probe',
    'multipart.png',
    'v3',
    uploadId,
    1,
    Readable.from(bytes),
  );

  await backend.completeMultipartUpload('probe', 'multipart.png', uploadId, 'v3', [
    { PartNumber: 1, ETag: part.ETag },
  ]);

  const multi = await read('multipart.png', 'v3');

  assert.equal(hash(multi.bytes), hash(bytes));
  assert.equal(multi.metadata.mimetype, 'image/png');

  const abort = await backend.createMultiPartUpload(
    'probe',
    'aborted.png',
    'v4',
    'image/png',
    'no-cache',
  );

  await backend.uploadPart('probe', 'aborted.png', 'v4', abort, 1, Readable.from(bytes));
  await backend.abortMultipartUpload('probe', 'aborted.png', abort, 'v4');
  // Completion removes temporary multipart files asynchronously in upstream code.
  await new Promise((r) => setTimeout(r, 100));
  console.log(
    JSON.stringify({
      upload: true,
      read: true,
      copy: true,
      delete: true,
      range: true,
      etag: true,
      contentEncoding: true,
      multipart: true,
      abort: true,
      nativeAttributes: true,
    }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
