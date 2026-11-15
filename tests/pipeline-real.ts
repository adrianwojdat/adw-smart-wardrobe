import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { processImage } from '../apps/worker/src/pipelines/images/pipeline.ts';

const require = createRequire(new URL('../apps/worker/package.json', import.meta.url));
const sharp = require('sharp');
const file = process.env.GARMENT_FIXTURE ?? '/tmp/wardrobe-real-jacket.webp';
const input = await readFile(file);
const start = Date.now();
const output = await processImage(input, 90, async (stage, pct) => console.log(stage, pct));

await writeFile('/tmp/wardrobe-cutout.png', output.cutout);
await writeFile('/tmp/wardrobe-catalog.webp', output.catalog);
await writeFile('/tmp/wardrobe-thumbnail.webp', output.thumbnail);

const raw = await sharp(output.cutout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let transparent = 0,
  opaque = 0;

for (let i = 3; i < raw.data.length; i += 4) {
  if (raw.data[i] < 25) transparent++;
  if (raw.data[i] > 230) opaque++;
}

assert(transparent > 1000);
assert(opaque > 1000);
assert(output.backgroundFraction > 0.1);
assert.equal((await sharp(output.catalog).metadata()).width, 1200);
assert.equal((await sharp(output.thumbnail).metadata()).width, 320);
console.log(
  JSON.stringify({
    modelRan: true,
    seconds: (Date.now() - start) / 1000,
    rssMiB: process.memoryUsage().rss / 1048576,
    backgroundFraction: output.backgroundFraction,
    transparent,
    opaque,
  }),
);
