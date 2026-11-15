import type { SupabaseClient } from '@supabase/supabase-js';
import type { Processor } from 'bullmq';
import type pg from 'pg';
import type { Logger } from 'pino';
import sharp from 'sharp';
import { z } from 'zod';

import { AiUnavailable, analyze } from '../integrations/ollama/providers.js';
import { PIPELINE_VERSION, processImage } from '../pipelines/images/pipeline.js';
import { analyzeFashion, fashionEnabled } from './garment-analysis/fashion.js';
import { commitJob, JobCancelled, watchCancellation } from './job-cancellation.js';

type Payload = { id: string };
type StorageClient = Pick<SupabaseClient, 'storage'>;
interface Dependencies {
  pool: pg.Pool;
  storage: StorageClient;
  logger: Logger;
}

export function createImageProcessor({ pool, storage, logger }: Dependencies): Processor<Payload> {
  return async (job) => {
    const id = z.uuid().parse(job.data.id);
    const result = await pool.query(
      "select j.*, i.path, i.original_path, i.rotation, i.revision as image_revision from public.jobs j join public.garment_images i on i.id=j.image_id and i.garment_id=j.garment_id and i.wardrobe_id=j.wardrobe_id where j.id=$1 and j.status in ('queued','processing')",
      [id],
    );

    if (!result.rowCount) return { cancelled: true };

    const row = result.rows[0];

    if (row.revision !== row.image_revision) {
      await pool.query(
        "update public.jobs set status='completed',progress=100,result='{\"superseded\":true}' where id=$1 and status in ('queued','processing')",
        [id],
      );

      return;
    }

    const cancellation = watchCancellation(pool, id);

    try {
      const membership = await pool.query(
        "select 1 from public.wardrobe_members where wardrobe_id=$1 and user_id=$2 and role in ('owner','editor')",
        [row.wardrobe_id, row.requested_by],
      );

      if (!membership.rowCount) throw new Error('Wardrobe access has been revoked.');
      await commitJob(pool, id, (client) =>
        client.query(
          "update public.jobs set status='processing',progress=20,attempts=attempts+1,error=null where id=$1",
          [id],
        ),
      );
      await job.updateProgress(20);

      const { data, error } = await storage.storage
        .from('garments')
        .download(row.original_path ?? row.path);

      if (error || !data) throw new Error('Failed to download the original image.');

      const output = await processImage(
        Buffer.from(await data.arrayBuffer()),
        row.rotation,
        async (stage, progress) => {
          cancellation.signal.throwIfAborted();
          await commitJob(pool, id, async (client) => {
            await client.query(
              "update public.garment_images set process_status='processing',stage=$2,processing_error=null where id=$1 and revision=$3",
              [row.image_id, stage, row.revision],
            );
            await client.query('update public.jobs set progress=$2 where id=$1', [id, progress]);
            await job.updateProgress(progress);
          });
        },
      );

      cancellation.signal.throwIfAborted();

      const prefix = `${row.wardrobe_id}/${row.garment_id}/${row.image_id}/v${row.revision}-${PIPELINE_VERSION}`;

      for (const [name, buffer, mime] of [
        ['cutout', output.cutout, 'image/png'],
        ['catalog', output.catalog, 'image/webp'],
        ['thumbnail', output.thumbnail, 'image/webp'],
      ] as const) {
        cancellation.signal.throwIfAborted();
        await commitJob(pool, id, async () => {
          const { error } = await storage.storage
            .from('garments')
            .upload(`${prefix}/${name}.${name === 'cutout' ? 'png' : 'webp'}`, buffer, {
              contentType: mime,
              upsert: true,
            });

          if (error) throw Error('Failed to save the image variant.');
        });
      }

      await commitJob(pool, id, async (client) => {
        await client.query(
          "update public.garment_images set cutout_path=$2,catalog_path=$3,thumbnail_path=$4,orientation=$5,pipeline_version=$6,process_status='completed',stage='Gotowe',processing_error=null where id=$1 and revision=$7",
          [
            row.image_id,
            `${prefix}/cutout.png`,
            `${prefix}/catalog.webp`,
            `${prefix}/thumbnail.webp`,
            output.orientation,
            PIPELINE_VERSION,
            row.revision,
          ],
        );
        await client.query(
          "update public.jobs set status='completed',progress=100,result=$2,error=null where id=$1",
          [
            id,
            {
              width: output.width,
              height: output.height,
              orientation: output.orientation,
              backgroundFraction: output.backgroundFraction,
              pipelineVersion: PIPELINE_VERSION,
            },
          ],
        );
      });
      await job.updateProgress(100);

      return { pipelineVersion: PIPELINE_VERSION };
    } catch (error) {
      if (error instanceof JobCancelled || cancellation.signal.aborted) return { cancelled: true };
      await commitJob(pool, id, async (client) => {
        const final = job.attemptsMade + 1 >= 3;

        await client.query('update public.jobs set status=$2,error=$3 where id=$1', [
          id,
          final ? 'failed' : 'queued',
          'Image processing failed. Try again.',
        ]);
        await client.query(
          'update public.garment_images set process_status=$2,stage=$3,processing_error=$4 where id=$1 and revision=$5',
          [
            row.image_id,
            final ? 'failed' : 'queued',
            final ? 'Processing failed' : 'Waiting for processing',
            error instanceof Error ? error.message : 'Image processing error',
            row.revision,
          ],
        );
      });
      logger.error(
        {
          jobId: id,
          attempt: job.attemptsMade + 1,
          error: error instanceof Error ? error.message : 'unknown',
        },
        'Image processing failed',
      );
      throw error;
    } finally {
      cancellation.stop();
    }
  };
}

export function createAiProcessor({ pool, storage, logger }: Dependencies): Processor<Payload> {
  return async (job) => {
    const id = z.uuid().parse(job.data.id);
    const found = await pool.query(
      "select j.*,i.original_path,i.path,i.rotation,i.revision as image_revision,g.updated_at::text as garment_version from public.jobs j join public.garment_images i on i.id=j.image_id and i.garment_id=j.garment_id and i.wardrobe_id=j.wardrobe_id join public.garments g on g.id=j.garment_id where j.id=$1 and j.status in ('queued','processing')",
      [id],
    );
    const row = found.rows[0];

    if (!row) return { cancelled: true };

    if (row.revision !== row.image_revision) {
      await pool.query(
        "update public.jobs set status='completed',progress=100,result='{\"superseded\":true}' where id=$1 and status in ('queued','processing')",
        [id],
      );

      return;
    }

    const cancellation = watchCancellation(pool, id);

    try {
      const membership = await pool.query(
        "select 1 from public.wardrobe_members where wardrobe_id=$1 and user_id=$2 and role in ('owner','editor')",
        [row.wardrobe_id, row.requested_by],
      );

      if (!membership.rowCount) throw Error('Wardrobe access has been revoked.');
      await commitJob(pool, id, (client) =>
        client.query(
          "update public.jobs set status='processing',progress=10,attempts=attempts+1 where id=$1",
          [id],
        ),
      );
      // Check configuration before downloading private pixels when AI is not configured.
      if (
        (row.type === 'analyze_label' || !fashionEnabled()) &&
        (!process.env.OLLAMA_BASE_URL || !process.env.OLLAMA_VISION_MODEL)
      )
        throw new AiUnavailable('Waiting for AI host configuration.');

      const { data, error } = await storage.storage
        .from('garments')
        .download(row.original_path ?? row.path);

      if (error || !data) throw Error('Failed to download the image for analysis.');

      const image = await sharp(Buffer.from(await data.arrayBuffer()))
        .autoOrient()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      const result =
        row.type === 'analyze_garment' && fashionEnabled()
          ? await analyzeFashion(
              Buffer.from(await data.arrayBuffer()),
              row.rotation,
              cancellation.signal,
            )
          : await analyze(image, row.type === 'analyze_label', cancellation.signal);

      await commitJob(pool, id, async (client) => {
        if (row.type === 'analyze_garment') {
          const automatic = await client.query(
            'select private.apply_ai_metadata($1,$2,$3) as applied',
            [id, result.suggestions, row.garment_version],
          );
          const applied = automatic.rows[0]?.applied
            ? automatic
            : await client.query('select private.apply_initial_classification($1,$2) as applied', [
                id,
                result.suggestions,
              ]);

          result.auto_applied = applied.rows[0]?.applied === true;
        }

        if (row.type === 'analyze_garment' && result.suggestions.name && !result.auto_applied) {
          // RLS and trigger serialize allocation and refuse replacing manual/AI names.
          await client.query(
            `update public.garments g set name=$2,name_source='ai'
          where g.id=$1 and g.name_source='temporary'
          and exists(select 1 from public.garment_images i where i.id=$3 and i.garment_id=g.id and i.revision=$4)`,
            [row.garment_id, result.suggestions.name, row.image_id, row.revision],
          );
        }

        await client.query(
          'update public.garment_images set analysis=$2 where id=$1 and revision=$3',
          [row.image_id, result, row.revision],
        );
        if (row.type === 'analyze_label')
          await client.query(
            "update public.garment_images set process_status='completed',stage='Odczyt metki gotowy' where id=$1 and revision=$2",
            [row.image_id, row.revision],
          );
        await client.query(
          "update public.jobs set status='completed',progress=100,error=null,result=$2 where id=$1",
          [id, result],
        );
      });
    } catch (error) {
      if (error instanceof JobCancelled || cancellation.signal.aborted) return { cancelled: true };
      await commitJob(pool, id, async (client) => {
        if (error instanceof AiUnavailable) {
          await client.query(
            "update public.jobs set status='queued',progress=0,error=$2,available_at=now()+interval '60 seconds' where id=$1",
            [id, error.message],
          );

          return;
        }

        const final = job.attemptsMade + 1 >= 3;

        await client.query('update public.jobs set status=$2,error=$3 where id=$1', [
          id,
          final ? 'failed' : 'queued',
          'Analysis failed. Check the vision model and try again.',
        ]);
      });
      if (error instanceof AiUnavailable) return;
      logger.warn({ jobId: id }, 'AI response failed validation or processing');
      throw error;
    } finally {
      cancellation.stop();
    }
  };
}
