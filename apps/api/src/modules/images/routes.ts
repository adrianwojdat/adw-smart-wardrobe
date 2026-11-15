import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';

import { aiAnalysisSchema, deriveWarmth, localizeAnalysis, uuid } from '@wardrobe/shared';

import type { ApiServer } from '../../app/server.js';
import { checked } from '../../lib/route-utils.js';

import type { SessionService } from '../auth/session.js';
import { HttpError } from '../auth/session.js';

const idParams = z.object({ id: uuid });

export function registerImageRoutes(app: ApiServer, session: SessionService) {
  app.post(
    '/api/garments/:id/images',
    {
      schema: {
        params: idParams,
        querystring: z.object({
          kind: z.enum(['garment', 'label']).default('garment'),
          upload_id: uuid.optional(),
        }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const garment = checked(
        await sb.from('garments').select('id,wardrobe_id').eq('id', req.params.id).single(),
      );

      if (!checked(await sb.rpc('has_wardrobe_access', { w: garment.wardrobe_id, editing: true })))
        throw new HttpError(403, 'You do not have permission to edit this resource.');

      const images = checked(
        await sb.from('garment_images').select('*').eq('garment_id', garment.id),
      );
      const previous = images.find((image) => image.id === req.query.upload_id);

      if (previous) return previous;
      if (images.length >= 12) throw new HttpError(400, 'A garment can have at most 12 images.');

      const file = await req.file();

      if (!file) throw new HttpError(400, 'Select an image.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
        throw new HttpError(400, 'Dozwolone formaty: JPEG, PNG, WebP.');

      const input = await file.toBuffer();
      let output: Buffer;
      let width: number;
      let height: number;

      try {
        const meta = await sharp(input, {
          limitInputPixels: 40_000_000,
          animated: false,
        }).metadata();

        if (
          !['jpeg', 'png', 'webp'].includes(meta.format ?? '') ||
          (meta.pages ?? 1) > 1 ||
          !meta.width ||
          !meta.height ||
          meta.width * meta.height > 40_000_000
        )
          throw Error('format');
        output = input;
        width = meta.width;
        height = meta.height;
      } catch {
        throw new HttpError(400, 'Invalid image or resolution exceeds the 40 MP limit.');
      }

      const path = `${garment.wardrobe_id}/${garment.id}/${req.query.upload_id ?? randomBytes(16).toString('hex')}.original`;
      const stored = await sb.storage
        .from('garments')
        .upload(path, output, { contentType: file.mimetype, upsert: false });

      if (stored.error && !(req.query.upload_id && stored.error.statusCode === '409'))
        checked(stored);

      const inserted = await sb
        .from('garment_images')
        .insert({
          ...(req.query.upload_id ? { id: req.query.upload_id } : {}),
          garment_id: garment.id,
          wardrobe_id: garment.wardrobe_id,
          path,
          original_path: path,
          original_mime: file.mimetype,
          kind: req.query.kind,
          width,
          height,
        })
        .select()
        .single();

      if (inserted.error?.code === '23505' && req.query.upload_id) {
        return checked(
          await sb
            .from('garment_images')
            .select('*')
            .eq('id', req.query.upload_id)
            .eq('garment_id', garment.id)
            .single(),
        );
      }

      if (inserted.error) {
        if (req.query.upload_id)
          throw new HttpError(400, 'Failed to save the image. Retry the upload.');
        await sb.storage.from('garments').remove([path]);
        throw new HttpError(400, 'Failed to save the image.');
      }

      const img = checked(inserted);

      return img;
    },
  );
  app.get(
    '/api/images/:id',
    {
      schema: {
        params: idParams,
        querystring: z.object({
          variant: z.enum(['original', 'cutout', 'catalog', 'thumbnail']).default('catalog'),
          v: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const img = checked(
        await sb.from('garment_images').select('*').eq('id', req.params.id).single(),
      );
      const chosen = req.query.variant;
      const variantPath = chosen === 'original' ? null : img[chosen + '_path'];
      const path = variantPath ?? img.original_path;
      const blob = checked(await sb.storage.from('garments').download(path));

      return reply
        .header(
          'Content-Type',
          variantPath ? (chosen === 'cutout' ? 'image/png' : 'image/webp') : img.original_mime,
        )
        .header('Content-Disposition', 'inline')
        .send(Buffer.from(await blob.arrayBuffer()));
    },
  );
  app.post(
    '/api/images/:id/reprocess',
    {
      schema: {
        params: idParams,
        body: z.object({
          rotation: z
            .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
            .optional(),
        }),
      },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);

      return checked(
        await sb.rpc('reprocess_image', { image: req.params.id, angle: req.body.rotation ?? null }),
      );
    },
  );
  app.post('/api/images/:id/analyze', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);

    return checked(await sb.rpc('reanalyze_image', { image: req.params.id }));
  });
  app.post(
    '/api/images/:id/rotate',
    { schema: { params: idParams, body: z.object({ direction: z.enum(['left', 'right']) }) } },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const img = checked(
        await sb.from('garment_images').select('*').eq('id', req.params.id).single(),
      );
      const current =
        img.rotation ?? (img.orientation as { applied?: number } | null)?.applied ?? 0;

      return checked(
        await sb.rpc('reprocess_image', {
          image: img.id,
          angle: (current + (req.body.direction === 'right' ? 90 : 270)) % 360,
        }),
      );
    },
  );
  app.post(
    '/api/images/:id/suggestions/apply',
    {
      schema: { params: idParams, body: z.object({ fields: z.array(z.string()).min(1).max(16) }) },
    },
    async (req, reply) => {
      const { sb } = await session.load(req, reply);
      const img = checked(
        await sb.from('garment_images').select('*').eq('id', req.params.id).single(),
      );
      const analysis = localizeAnalysis(aiAnalysisSchema.parse(img.analysis));
      const patch: Record<string, unknown> = Object.fromEntries(
        Object.entries(analysis.suggestions).filter(([field]) => req.body.fields.includes(field)),
      );

      if ('warmth' in patch) patch.warmth_manual = false;
      else if ('category' in patch || 'subcategory' in patch) {
        const current = checked(
          await sb
            .from('garments')
            .select('category,subcategory,warmth_manual')
            .eq('id', img.garment_id)
            .single(),
        );

        if (!current.warmth_manual) {
          const warmth = deriveWarmth(
            String(patch.category ?? current.category),
            String(patch.subcategory ?? current.subcategory),
          );

          if (warmth !== undefined) patch.warmth = warmth;
        }
      }

      return checked(
        await sb
          .from('garments')
          .update({ ...patch, ...('name' in patch ? { name_source: 'manual' } : {}) })
          .eq('id', img.garment_id)
          .select('*,garment_images(*)')
          .single(),
      );
    },
  );
  app.delete('/api/images/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { sb } = await session.load(req, reply);
    const img = checked(
      await sb.from('garment_images').select('path,wardrobe_id').eq('id', req.params.id).single(),
    );

    if (!checked(await sb.rpc('has_wardrobe_access', { w: img.wardrobe_id, editing: true })))
      throw new HttpError(403, 'Permission denied.');
    checked(await sb.storage.from('garments').remove([img.path]));
    checked(await sb.from('garment_images').delete().eq('id', req.params.id).select().single());

    return { ok: true };
  });
}
