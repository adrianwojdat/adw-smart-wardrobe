import sharp from 'sharp';

export function decodeMask(prediction: Float32Array, dims: readonly number[]): Buffer {
  if (
    dims.length !== 4 ||
    dims[0] !== 1 ||
    dims[1] !== 1 ||
    !dims[2] ||
    !dims[3] ||
    prediction.length !== dims[2] * dims[3]
  )
    throw new Error('Invalid ONNX mask dimensions.');

  let low = Infinity,
    high = -Infinity;

  for (const value of prediction) {
    if (!Number.isFinite(value)) throw new Error('Invalid ONNX mask values.');
    low = Math.min(low, value);
    high = Math.max(high, value);
  }

  if (high - low < 1e-6) throw new Error('Failed to separate the garment from the background.');

  return Buffer.from(prediction.map((value) => Math.round((255 * (value - low)) / (high - low))));
}

/** The model stretches input to its tensor size, without letterboxing.
 * Resize its single-channel mask directly back to normalized image coordinates.
 * Build RGBA explicitly: Sharp's removeAlpha option also removes joined alpha.
 */
export async function applyMask(
  normalized: Buffer,
  mask: Buffer,
  maskWidth: number,
  maskHeight: number,
  angle: number,
  padding = 12,
) {
  const { data: rgba, info } = await sharp(normalized)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  if (mask.length !== maskWidth * maskHeight) throw new Error('Invalid mask size.');

  const { data: alpha, info: maskInfo } = await sharp(mask, {
    raw: { width: maskWidth, height: maskHeight, channels: 1 },
  })
    .resize(w, h, { fit: 'fill' })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (maskInfo.channels !== 1 || alpha.length !== w * h || info.channels !== 4)
    throw new Error('Invalid image channels.');

  let left = w,
    top = h,
    right = -1,
    bottom = -1,
    background = 0;

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const pixel = y * w + x;
      const a = Math.round((alpha[pixel]! * rgba[pixel * 4 + 3]!) / 255);

      rgba[pixel * 4 + 3] = a;
      if (a < 25) background++;

      if (a > 100) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }

  if (right < left || bottom < top || background / (w * h) < 0.01)
    throw new Error(
      'The mask did not isolate the garment. Try an image with a clearer background.',
    );
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(w - 1, right + padding);
  bottom = Math.min(h - 1, bottom + padding);

  // Materialize cropping first: Sharp otherwise rotates before extracting.
  const cropped = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();
  const cutout =
    angle === 0
      ? cropped
      : await sharp(cropped)
          .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

  return { cutout, backgroundFraction: background / (w * h) };
}
