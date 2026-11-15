import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';

import { orient } from '../../integrations/ollama/providers.js';

import { fashionEnabled } from '../../jobs/garment-analysis/fashion.js';

import { applyMask, decodeMask } from './mask.js';

export const PIPELINE_VERSION = 'u2netp-catalog-v2';

let session: Promise<ort.InferenceSession> | undefined;

async function model() {
  session ??= (async () => {
    const path = process.env.SEGMENTATION_MODEL_PATH ?? 'infra/models/u2netp.onnx';
    const bytes = await readFile(path);

    if (
      createHash('sha256').update(bytes).digest('hex') !==
      '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8'
    )
      throw Error('Invalid segmentation model checksum.');

    return ort.InferenceSession.create(bytes, {
      executionProviders: ['cpu'],
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
      graphOptimizationLevel: 'all',
    });
  })();

  try {
    return await session;
  } catch (e) {
    session = undefined;
    throw e;
  }
}

export async function processImage(
  original: Buffer,
  rotation: number | null,
  progress: (stage: string, pct: number) => Promise<void>,
) {
  await progress('Removing the background', 15);

  const normalized = await sharp(original, { limitInputPixels: 40_000_000 })
    .autoOrient()
    .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const { data, info } = await sharp(normalized)
    .removeAlpha()
    .resize(320, 320, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = new Float32Array(3 * 320 * 320);
  let max = 0;

  for (const v of data) max = Math.max(max, v);

  const means = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];

  for (let i = 0; i < 320 * 320; i++)
    for (let c = 0; c < 3; c++)
      tensor[c * 320 * 320 + i] = (data[i * info.channels + c]! / (max || 1) - means[c]!) / std[c]!;

  const engine = await model();
  const result = await engine.run({
    [engine.inputNames[0]!]: new ort.Tensor('float32', tensor, [1, 3, 320, 320]),
  });
  const outputTensor = result[engine.outputNames[0]!]!;
  const mask = decodeMask(outputTensor.data as Float32Array, outputTensor.dims);

  await progress('Prostowanie i kadrowanie', 55);

  let orientation: { rotation: string; confidence: number; reason: string } = {
    rotation: '0',
    confidence: 0,
    reason: 'Check the orientation; you can rotate the image manually.',
  };

  if (
    !fashionEnabled() &&
    rotation === null &&
    process.env.OLLAMA_BASE_URL &&
    process.env.OLLAMA_VISION_MODEL
  ) {
    try {
      const small = await sharp(normalized).resize(768, 768, { fit: 'inside' }).jpeg().toBuffer();

      orientation = await orient(small);
    } catch {
      /* CPU pipeline remains independent of the AI PC. */
    }
  }

  // LLM angles are suggestions only; only an explicit manual angle is applied.
  const angle = rotation ?? 0;
  const { cutout, backgroundFraction } = await applyMask(
    normalized,
    mask,
    outputTensor.dims[3]!,
    outputTensor.dims[2]!,
    angle,
  );

  await progress('Preparing the catalog image', 80);

  // No recolouring, generative reconstruction or fabricated wrinkle removal.
  const product = await sharp(cutout)
    .resize({ width: 1050, height: 1300, fit: 'inside' })
    .png()
    .toBuffer();
  const catalog = await sharp({
    create: { width: 1200, height: 1500, channels: 3, background: '#f5f4f0' },
  })
    .composite([{ input: product, gravity: 'centre' }])
    .webp({ quality: 90 })
    .toBuffer();
  const thumbnail = await sharp(catalog).resize(320, 400).webp({ quality: 82 }).toBuffer();

  return {
    cutout,
    catalog,
    thumbnail,
    orientation: { ...orientation, applied: angle, manual: rotation !== null },
    width: 1200,
    height: 1500,
    backgroundFraction,
  };
}
