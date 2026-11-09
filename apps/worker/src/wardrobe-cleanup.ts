import type { Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Queue } from 'bullmq';
/** Scope is persisted by the owner-authorized RPC, never supplied by a Redis job. */
export async function cleanupWardrobe(pool: Pool, storage: SupabaseClient, queues: Queue[]) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      'select * from private.wardrobe_deletions where available_at<=now() order by created_at limit 1 for update skip locked',
    );
    const row = rows[0];
    if (row) {
      for (const queue of queues)
        for (const id of row.job_ids) {
          const job = await queue.getJob(id);
          if (job) await job.remove(); // An active job leaves the durable cleanup pending.
        }
      const bucket = storage.storage.from('garments');
      async function removeFolder(prefix: string) {
        const files: string[] = [];
        const folders: string[] = [];
        for (let offset = 0; ; offset += 100) {
          const { data, error } = await bucket.list(prefix, {
            limit: 100,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          });
          if (error) throw error;
          for (const item of data ?? []) {
            if (item.id) files.push(prefix + '/' + item.name);
            else folders.push(prefix + '/' + item.name);
          }
          if (!data || data.length < 100) break;
        }
        for (const folder of folders) await removeFolder(folder);
        for (let i = 0; i < files.length; i += 100) {
          const { error } = await bucket.remove(files.slice(i, i + 100));
          if (error) throw error;
        }
      }
      await removeFolder(row.wardrobe_id);
      await client.query('delete from private.wardrobe_deletions where wardrobe_id=$1', [
        row.wardrobe_id,
      ]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
