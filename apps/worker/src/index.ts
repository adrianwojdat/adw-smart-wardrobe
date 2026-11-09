import { cleanupWardrobe } from './wardrobe-cleanup.js';
import { createServer } from 'node:http';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import sharp from 'sharp';
import pino from 'pino';
import { z } from 'zod';
import { processImage, PIPELINE_VERSION } from './pipeline.js';
import { analyzeFashion, fashionEnabled } from './fashion.js';
import { analyze, AiUnavailable } from './providers.js';
import { JOB_RETENTION, dispatchJob } from './queue-policy.js';
import { JobCancelled, commitJob, watchCancellation } from './job-cancellation.js';
const config = z
  .object({
    WORKER_DATABASE_URL: z.string().min(1),
    REDIS_URL: z.url(),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  })
  .parse(process.env);
const logger = pino();
const pool = new pg.Pool({
  connectionString: config.WORKER_DATABASE_URL,
  max: 4,
  connectionTimeoutMillis: 5000,
});
pool.on('error', () => logger.error('Worker database connection lost; pool will reconnect'));
const redis = new URL(config.REDIS_URL);
const connection = new Redis({
  host: redis.hostname,
  port: Number(redis.port || 6379),
  password: redis.password,
  maxRetriesPerRequest: null,
});
connection.on('error', (error) =>
  logger.error({ message: error.message }, 'Redis connection failed'),
);
const queue = new Queue('wardrobe', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: JOB_RETENTION,
    removeOnFail: JOB_RETENTION,
  },
});
// Privileged key exists only in this internal worker. Object paths are loaded from
// a persisted, authorized job and membership is rechecked before each operation.
const storage = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) },
});
const aiQueue = new Queue('wardrobe-ai', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: JOB_RETENTION,
    removeOnFail: JOB_RETENTION,
  },
});
const worker = new Worker(
  'wardrobe',
  async (job) => {
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
      if (!membership.rowCount) throw new Error('Dostęp do garderoby został cofnięty.');
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
      if (error || !data) throw new Error('Nie można pobrać oryginału.');
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
          if (error) throw Error('Nie można zapisać wariantu zdjęcia.');
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
          'Przetwarzanie obrazu nie powiodło się. Spróbuj ponownie.',
        ]);
        await client.query(
          'update public.garment_images set process_status=$2,stage=$3,processing_error=$4 where id=$1 and revision=$5',
          [
            row.image_id,
            final ? 'failed' : 'queued',
            final ? 'Przetwarzanie nie powiodło się' : 'Oczekuje na przetwarzanie',
            error instanceof Error ? error.message : 'Błąd obróbki',
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
  },
  { connection, concurrency: 1, lockDuration: 180000, maxStalledCount: 2 },
);
const aiWorker = new Worker(
  'wardrobe-ai',
  async (job) => {
    const id = z.uuid().parse(job.data.id);
    const found = await pool.query(
      "select j.*,i.original_path,i.path,i.rotation,i.revision as image_revision from public.jobs j join public.garment_images i on i.id=j.image_id and i.garment_id=j.garment_id and i.wardrobe_id=j.wardrobe_id where j.id=$1 and j.status in ('queued','processing')",
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
      if (!membership.rowCount) throw Error('Dostęp do garderoby został cofnięty.');
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
        throw new AiUnavailable('Oczekuje na konfigurację komputera AI.');
      const { data, error } = await storage.storage
        .from('garments')
        .download(row.original_path ?? row.path);
      if (error || !data) throw Error('Nie można pobrać zdjęcia do analizy.');
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
          const applied = await client.query(
            'select private.apply_initial_classification($1,$2) as applied',
            [id, result.suggestions],
          );
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
          'Analiza nie powiodła się. Sprawdź model vision i spróbuj ponownie.',
        ]);
      });
      if (error instanceof AiUnavailable) return;
      logger.warn({ jobId: id }, 'AI response failed validation or processing');
      throw error;
    } finally {
      cancellation.stop();
    }
  },
  { connection, concurrency: 1, lockDuration: 180000 },
);
for (const processor of [worker, aiWorker]) {
  processor.on('completed', (job, result) => {
    if (result?.cancelled)
      void job.remove().catch(() => logger.warn('Cancelled Redis job cleanup deferred'));
  });
  processor.on('failed', (job, error) => {
    if (job && error instanceof JobCancelled)
      void job.remove().catch(() => logger.warn('Cancelled Redis job cleanup deferred'));
  });
}
aiWorker.on('error', () => logger.error('AI queue connection error'));
worker.on('error', (error) => logger.error({ message: error.message }, 'Worker connection error'));
worker.on('failed', (job) => {
  if (job && job.attemptsMade >= 3)
    void pool
      .query(
        "update public.jobs set status='failed',error='Zadanie zakończone błędem.' where id=$1 and status in ('queued','processing')",
        [job.data.id],
      )
      .catch((e) => logger.error({ message: e.message }, 'Persist failure'));
});
let polling = false;
let lastPoll = Date.now();
async function dispatch() {
  if (polling) return;
  polling = true;
  try {
    // PostgreSQL is the durable outbox. Rebuild Redis jobs after queue data loss.
    const rows = await pool.query(
      "select id,type from public.jobs where (status='queued' and available_at<=now()) or (status='processing' and updated_at<now()-interval '5 minutes') order by created_at limit 100",
    );
    for (const row of rows.rows)
      await dispatchJob(row.type === 'process_image' ? queue : aiQueue, row, async () => {
        const current = await pool.query(
          "select 1 from public.jobs where id=$1 and ((status='queued' and available_at<=now()) or (status='processing' and updated_at<now()-interval '5 minutes'))",
          [row.id],
        );
        return !!current.rowCount;
      });
    await cleanupWardrobe(pool, storage, [queue, aiQueue]).catch(() =>
      logger.warn('Wardrobe file cleanup pending; retrying later'),
    );
    lastPoll = Date.now();
  } catch (error) {
    logger.error(
      { message: error instanceof Error ? error.message : 'unknown' },
      'Outbox dispatch failed',
    );
  } finally {
    polling = false;
  }
}
const timer = setInterval(() => void dispatch(), 5000);
void dispatch();
const health = createServer(async (_req, res) => {
  try {
    await pool.query('select 1');
    await queue.getJobCounts();
    res.statusCode = Date.now() - lastPoll < 60000 ? 200 : 503;
    res.end('ok');
  } catch {
    res.statusCode = 503;
    res.end('unavailable');
  }
}).listen(3001, '0.0.0.0');
async function shutdown() {
  clearInterval(timer);
  health.close();
  await worker.close();
  await aiWorker.close();
  await aiQueue.close();
  await queue.close();
  await connection.quit();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
logger.info('Smart Wardrobe worker ready; image processing does not require AI');
