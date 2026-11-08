import { createServer } from 'node:http';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import sharp from 'sharp';
import pino from 'pino';
import { z } from 'zod';
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
    removeOnComplete: true,
    removeOnFail: true,
  },
});
// Privileged key exists only in this internal worker. Object paths are loaded from
// a persisted, authorized job and membership is rechecked before each operation.
const storage = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) },
});
const worker = new Worker(
  'wardrobe',
  async (job) => {
    const id = z.uuid().parse(job.data.id);
    const result = await pool.query(
      "select j.*, i.path from public.jobs j join public.garment_images i on i.id=j.image_id and i.garment_id=j.garment_id and i.wardrobe_id=j.wardrobe_id where j.id=$1 and j.status in ('queued','processing')",
      [id],
    );
    if (!result.rowCount) return;
    const row = result.rows[0];
    try {
      const membership = await pool.query(
        "select 1 from public.wardrobe_members where wardrobe_id=$1 and user_id=$2 and role in ('owner','editor')",
        [row.wardrobe_id, row.requested_by],
      );
      if (!membership.rowCount) throw new Error('Dostęp do garderoby został cofnięty.');
      await pool.query(
        "update public.jobs set status='processing',progress=20,attempts=attempts+1,error=null where id=$1",
        [id],
      );
      await job.updateProgress(20);
      const { data, error } = await storage.storage.from('garments').download(row.path);
      if (error || !data) throw new Error('Nie można pobrać obrazu.');
      const meta = await sharp(Buffer.from(await data.arrayBuffer()), {
        limitInputPixels: 40_000_000,
      }).metadata();
      const output = {
        width: meta.width,
        height: meta.height,
        format: meta.format,
        hasAlpha: meta.hasAlpha,
        processedAt: new Date().toISOString(),
      };
      await pool.query(
        "update public.jobs set status='completed',progress=100,result=$2,error=null where id=$1",
        [id, output],
      );
      await job.updateProgress(100);
      return output;
    } catch (error) {
      const final = job.attemptsMade + 1 >= 3;
      await pool.query('update public.jobs set status=$2,error=$3 where id=$1', [
        id,
        final ? 'failed' : 'queued',
        'Przetwarzanie obrazu nie powiodło się. Spróbuj ponownie.',
      ]);
      logger.error(
        {
          jobId: id,
          attempt: job.attemptsMade + 1,
          error: error instanceof Error ? error.message : 'unknown',
        },
        'Image processing failed',
      );
      throw error;
    }
  },
  { connection, concurrency: 2, lockDuration: 60000, maxStalledCount: 2 },
);
worker.on('error', (error) => logger.error({ message: error.message }, 'Worker connection error'));
worker.on('failed', (job) => {
  if (job && job.attemptsMade >= 3)
    void pool
      .query(
        "update public.jobs set status='failed',error='Zadanie zakończone błędem.' where id=$1 and status<>'completed'",
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
      "select id from public.jobs where status='queued' or (status='processing' and updated_at<now()-interval '5 minutes') order by created_at limit 100",
    );
    for (const row of rows.rows)
      await queue.add('process_image', { id: row.id }, { jobId: row.id });
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
  await queue.close();
  await connection.quit();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
logger.info('Smart Wardrobe worker ready; image processing does not require AI');
