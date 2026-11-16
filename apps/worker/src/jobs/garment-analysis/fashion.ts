import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type * as ORT from 'onnxruntime-node';
import sharp from 'sharp';

import { aiAnalysisSchema, localizeAnalysis } from '@wardrobe/shared';

type Prototype = { en: string; pl: string; vector: number[] };
type Ranking = { label: string; label_pl: string; score: number }[];
type Config = {
  sha256: string;
  locale: string;
  groups: Record<'category' | 'color' | 'pattern', Prototype[]>;
};

const directory = new URL('../../../../../infra/models/fashion-siglip/', import.meta.url);
let loaded: Promise<{ session: ORT.InferenceSession; config: Config }> | undefined;

export function fashionEnabled() {
  return (process.env.GARMENT_ANALYSIS_PROVIDER ?? 'fashion-siglip') === 'fashion-siglip';
}

async function engine() {
  return (loaded ??= (async () => {
    const config = JSON.parse(
      await readFile(new URL('prototypes.json', directory), 'utf8'),
    ) as Config;
    const bytes = await readFile(new URL('vision.onnx', directory));

    if (createHash('sha256').update(bytes).digest('hex') !== config.sha256)
      throw Error('Invalid FashionSigLIP checksum.');

    const ort = await import('onnxruntime-node');
    const session = await ort.InferenceSession.create(bytes, {
      executionProviders: ['cpu'],
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
      graphOptimizationLevel: 'all',
    });

    return { session, config };
  })());
}

export function rankFashion(feature: ArrayLike<number>, labels: Prototype[]): Ranking {
  const norm = Math.hypot(...Array.from(feature));

  if (!norm || !Number.isFinite(norm)) throw Error('Invalid FashionSigLIP embedding.');

  return labels
    .map((p) => ({
      label: p.en,
      label_pl: p.pl,
      score:
        p.vector.reduce((s, v, i) => s + v * feature[i]!, 0) / (norm * Math.hypot(...p.vector)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

const categories: Record<string, string> = {
  trousers: 'bottoms',
  jeans: 'bottoms',
  shorts: 'bottoms',
  dress: 'dresses',
  skirt: 'bottoms',
  blazer: 'outerwear',
  jacket: 'outerwear',
  coat: 'outerwear',
  shoes: 'shoes',
  belt: 'accessories',
  scarf: 'accessories',
  cap: 'accessories',
};

export async function analyzeFashion(
  original: Buffer,
  rotation: number | null = null,
  signal?: AbortSignal,
) {
  const started = performance.now();
  const { session, config } = await engine();
  const ort = await import('onnxruntime-node');
  const normalized = await sharp(original, { limitInputPixels: 40_000_000 })
    .autoOrient()
    .flatten({ background: '#f5f4ef' })
    .toColourspace('srgb')
    .removeAlpha()
    .png()
    .toBuffer();
  let best: { category: Ranking; color: Ranking; pattern: Ranking } | undefined;

  // Pool category scores across rotations, never use them to rotate the stored image.
  for (const angle of rotation === null ? [0, 90, 180, 270] : [rotation]) {
    signal?.throwIfAborted();

    const pixels = await sharp(normalized)
      .rotate(angle)
      .resize(224, 224, { fit: 'fill', kernel: 'cubic' })
      .removeAlpha()
      .raw()
      .toBuffer();
    const input = new Float32Array(3 * 224 * 224);

    for (let i = 0; i < 224 * 224; i++)
      for (let c = 0; c < 3; c++) input[c * 224 * 224 + i] = pixels[i * 3 + c]! / 127.5 - 1;

    const output = await session.run({
      [session.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, 224, 224]),
    });

    signal?.throwIfAborted();

    const tensor = output[session.outputNames[0]!]!;

    if (tensor.data.length !== 768) throw Error('Invalid FashionSigLIP embedding dimension.');

    const feature = tensor.data as Float32Array;
    const category = rankFashion(feature, config.groups.category);

    if (!best || category[0]!.score > best.category[0]!.score)
      best = {
        category,
        color: rankFashion(feature, config.groups.color),
        pattern: rankFashion(feature, config.groups.pattern),
      };
  }

  const found = best!;

  return localizeAnalysis(
    aiAnalysisSchema.parse({
      source: 'photo',
      confidence: 0,
      uncertainties: [
        'Review the category, color and pattern. Model similarity is not a confidence percentage.',
      ],
      suggestions: {
        pattern: found.pattern[0]!.label_pl,
        category: categories[found.category[0]!.label] ?? 'tops',
        subcategory: found.category[0]!.label_pl,
        primary_color: found.color[0]!.label_pl,
      },
      classifier: {
        provider: 'fashion-siglip',
        model: 'Marqo/marqo-fashionSigLIP',
        category: found.category,
        color: found.color,
        pattern: found.pattern,
        elapsed_ms: Math.round(performance.now() - started),
      },
    }),
  );
}
