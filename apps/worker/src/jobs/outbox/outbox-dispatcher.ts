import type { SupabaseClient } from '@supabase/supabase-js';
import type { Queue } from 'bullmq';
import type { Pool } from 'pg';
import type { Logger } from 'pino';

import { dispatchJob } from '../../app/queue-policy.js';

import { cleanupWardrobe } from '../cleanup/wardrobe-cleanup.js';

interface OutboxDependencies {
  pool: Pool;
  storage: SupabaseClient;
  wardrobeQueue: Queue;
  aiQueue: Queue;
  geminiQueue: Queue;
  logger: Logger;
}

export function createOutboxDispatcher({
  pool,
  storage,
  wardrobeQueue,
  aiQueue,
  geminiQueue,
  logger,
}: OutboxDependencies) {
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
        await dispatchJob(row.type === 'process_image' ? wardrobeQueue : aiQueue, row, async () => {
          const current = await pool.query(
            "select 1 from public.jobs where id=$1 and ((status='queued' and available_at<=now()) or (status='processing' and updated_at<now()-interval '5 minutes'))",
            [row.id],
          );

          return !!current.rowCount;
        });

      const geminiRows = await pool.query(
        "select id from public.gemini_tasks where status='queued' order by created_at limit 50",
      );

      for (const row of geminiRows.rows) {
        const existing = await geminiQueue.getJob(row.id);

        if (!existing) await geminiQueue.add('execute', { taskId: row.id }, { jobId: row.id });
      }

      await cleanupWardrobe(pool, storage, [wardrobeQueue, aiQueue]).catch(() =>
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

  return { dispatch, lastPoll: () => lastPoll };
}
