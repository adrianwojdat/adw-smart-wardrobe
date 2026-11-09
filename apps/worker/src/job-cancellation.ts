import type { Pool, PoolClient } from 'pg';
import { UnrecoverableError } from 'bullmq';
export class JobCancelled extends UnrecoverableError {
  constructor() {
    super('Anulowano zadanie.');
  }
}
/** Locks the durable job while committing effects, so cancellation cannot be overwritten. */
export async function commitJob<T>(
  pool: Pool,
  id: string,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const state = await client.query('select status from public.jobs where id=$1 for update', [id]);
    if (!state.rowCount || !['queued', 'processing'].includes(state.rows[0].status))
      throw new JobCancelled();
    const result = await action(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
export function watchCancellation(pool: Pool, id: string) {
  const controller = new AbortController();
  let checking = false;
  const timer = setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      const state = await pool.query('select status from public.jobs where id=$1', [id]);
      if (!state.rowCount || state.rows[0].status === 'cancelled')
        controller.abort(new JobCancelled());
    } catch {
      /* A DB outage must not silently accept an unguarded result. commitJob still checks. */
    } finally {
      checking = false;
    }
  }, 1000);
  timer.unref();
  return { signal: controller.signal, stop: () => clearInterval(timer) };
}
