import { createClient } from '@supabase/supabase-js';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createServer } from 'node:http';
import pg from 'pg';
import pino from 'pino';
import { z } from 'zod';

import { createGeminiWorker } from '../integrations/gemini/worker.js';
import { JobCancelled } from '../jobs/job-cancellation.js';
import { createOutboxDispatcher } from '../jobs/outbox/outbox-dispatcher.js';
import { createAiProcessor, createImageProcessor } from '../jobs/processors.js';
import { JOB_RETENTION } from './queue-policy.js';

const config = z
  .object({
    WORKER_DATABASE_URL: z.string().min(1),
    REDIS_URL: z.url(),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    GEMINI_ENCRYPTION_KEY: z
      .string()
      .default('')
      .refine((value) => !value || /^[a-f0-9]{64}$/.test(value)),
    GEMINI_RPM_LIMIT: z.coerce.number().int().min(1).max(60).default(12),
    GEMINI_SHARED_QUOTA_ID: z.string().max(120).default(''),
    GEMINI_TASK_TIMEOUT_MS: z.coerce.number().int().min(60000).max(1800000).default(900000),
    GEMINI_TPM_LIMIT: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    GEMINI_RPD_LIMIT: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
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
const geminiQueue = new Queue('gemini', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 86400, count: 1000 },
  },
});
const worker = new Worker('wardrobe', createImageProcessor({ pool, storage, logger }), {
  connection,
  concurrency: 1,
  lockDuration: 180000,
  maxStalledCount: 2,
});
const aiWorker = new Worker('wardrobe-ai', createAiProcessor({ pool, storage, logger }), {
  connection,
  concurrency: 1,
  lockDuration: 180000,
});
const { worker: geminiWorker, cancellation: geminiCancellation } = await createGeminiWorker({
  connection,
  pool,
  config,
  logger,
});

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
        "update public.jobs set status='failed',error='Job failed.' where id=$1 and status in ('queued','processing')",
        [job.data.id],
      )
      .catch((e) => logger.error({ message: e.message }, 'Persist failure'));
});

const outbox = createOutboxDispatcher({
  pool,
  storage,
  wardrobeQueue: queue,
  aiQueue,
  geminiQueue,
  logger,
});
const timer = setInterval(() => void outbox.dispatch(), 5000);

void outbox.dispatch();

const health = createServer(async (_req, res) => {
  try {
    await pool.query('select 1');
    await queue.getJobCounts();
    await geminiQueue.getJobCounts();
    res.statusCode = Date.now() - outbox.lastPoll() < 60000 ? 200 : 503;
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
  await geminiWorker.close();
  await geminiCancellation.quit();
  await geminiQueue.close();
  await aiQueue.close();
  await queue.close();
  await connection.quit();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
logger.info('Smart Wardrobe worker ready; image processing does not require AI');
