import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { prepareImage } from '../apps/api/src/images';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp') as typeof import('../apps/api/node_modules/sharp');
it('bakes portrait EXIF rotation into WebP pixels without EXIF and supports manual rotation', async () => {
  const pixels = Buffer.alloc(80 * 40 * 3);
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 80; x++) {
      const i = (y * 80 + x) * 3;
      pixels[i] = x < 40 ? 255 : 0;
      pixels[i + 2] = x < 40 ? 0 : 255;
    }
  const jpeg = await sharp(pixels, { raw: { width: 80, height: 40, channels: 3 } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const upright = await prepareImage(jpeg);
  expect([upright.info.width, upright.info.height]).toEqual([40, 80]);
  const metadata = await sharp(upright.data).metadata();
  expect(metadata.orientation).toBeUndefined();
  expect(metadata.exif).toBeUndefined();
  const { data, info } = await sharp(upright.data).raw().toBuffer({ resolveWithObject: true });
  const top = (10 * info.width + 20) * info.channels;
  const bottom = (70 * info.width + 20) * info.channels;
  expect(data[top]).toBeGreaterThan(200);
  expect(data[bottom + 2]).toBeGreaterThan(200);
  const rotated = await prepareImage(upright.data, 90);
  expect([rotated.info.width, rotated.info.height]).toEqual([80, 40]);
  const restored = await prepareImage(rotated.data, -90);
  expect([restored.info.width, restored.info.height]).toEqual([40, 80]);
});
