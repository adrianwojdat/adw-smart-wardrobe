import sharp from 'sharp';

/** Bake EXIF orientation into pixels and strip metadata from the stored image. */
export async function prepareImage(input: Buffer, angle: 0 | 90 | -90 = 0) {
  const source = sharp(input, { limitInputPixels: 40_000_000, animated: false });
  const meta = await source.metadata();

  if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1)
    throw new Error('Unsupported image');

  return source
    .autoOrient()
    .rotate(angle)
    .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
}
