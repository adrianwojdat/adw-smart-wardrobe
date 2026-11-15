import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

import { applyMask, decodeMask } from '../apps/worker/src/pipelines/images/mask.ts';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp');

it('keeps a one-channel mask mapped to pixels, RGBA alpha, original RGB and correct 90-degree crop', async () => {
  const pixels = Buffer.alloc(8 * 6 * 3);

  for (let p = 0; p < 48; p++) {
    pixels[p * 3] = 31;
    pixels[p * 3 + 1] = 67;
    pixels[p * 3 + 2] = 111;
  }

  const image = await sharp(pixels, { raw: { width: 8, height: 6, channels: 3 } })
    .png()
    .toBuffer();
  const mask = decodeMask(new Float32Array([0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0]), [1, 1, 3, 4]);
  const zero = await applyMask(image, mask, 4, 3, 0, 1),
    ninety = await applyMask(image, mask, 4, 3, 90, 1);
  const meta = await sharp(zero.cutout).metadata(),
    rotated = await sharp(ninety.cutout).metadata();

  expect(meta.hasAlpha).toBe(true);
  expect(meta.channels).toBe(4);
  expect([rotated.width, rotated.height]).toEqual([meta.height, meta.width]);

  const { data, info } = await sharp(zero.cutout).raw().toBuffer({ resolveWithObject: true });
  let transparent = 0,
    opaque = 0;

  for (let i = 0; i < data.length; i += 4) {
    expect([...data.subarray(i, i + 3)]).toEqual([31, 67, 111]);
    if (data[i + 3] === 0) transparent++;
    if (data[i + 3] === 255) opaque++;
  }

  expect(transparent).toBeGreaterThan(0);
  expect(opaque).toBeGreaterThan(0);

  // A clockwise rotation must only permute pixels; it must not pad a black band.
  const expected = await sharp(data, { raw: info }).rotate(90).raw().toBuffer();

  expect(await sharp(ninety.cutout).raw().toBuffer()).toEqual(expected);
});
it('rejects invalid ONNX tensor shape, flat predictions and NaN', () => {
  expect(() => decodeMask(new Float32Array(4), [1, 3, 2, 2])).toThrow();
  expect(() => decodeMask(new Float32Array(4), [1, 1, 2, 2])).toThrow();
  expect(() => decodeMask(new Float32Array([0, 1, NaN, 0]), [1, 1, 2, 2])).toThrow();
});
