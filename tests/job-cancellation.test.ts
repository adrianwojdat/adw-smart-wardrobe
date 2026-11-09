import { afterEach, expect, it, vi } from 'vitest';
import type { Pool } from '../apps/worker/node_modules/pg';
import { commitJob, JobCancelled, watchCancellation } from '../apps/worker/src/job-cancellation';
afterEach(() => vi.useRealTimers());
function database(status: string) {
  const query = vi.fn(async (sql: string) =>
    sql.startsWith('select') ? { rowCount: 1, rows: [{ status }] } : { rowCount: 0, rows: [] },
  );
  const release = vi.fn();
  const client = { query, release };
  return { pool: { connect: async () => client, query } as unknown as Pool, query, release };
}
it('rolls back without publishing suggestions or images if a job was cancelled', async () => {
  const db = database('cancelled'),
    action = vi.fn();
  await expect(commitJob(db.pool, 'id', action)).rejects.toBeInstanceOf(JobCancelled);
  expect(action).not.toHaveBeenCalled();
  expect(db.query).toHaveBeenCalledWith('rollback');
  expect(db.release).toHaveBeenCalledOnce();
});
it('holds a row lock while publishing an eligible result atomically', async () => {
  const db = database('processing'),
    action = vi.fn(async () => 42);
  expect(await commitJob(db.pool, 'id', action)).toBe(42);
  expect(db.query.mock.calls[1]?.[0]).toContain('for update');
  expect(db.query).toHaveBeenCalledWith('commit');
});
it('aborts in-flight work when the durable cancellation is observed', async () => {
  vi.useFakeTimers();
  const db = database('cancelled');
  const monitor = watchCancellation(db.pool, 'id');
  await vi.advanceTimersByTimeAsync(1000);
  expect(monitor.signal.aborted).toBe(true);
  expect(monitor.signal.reason).toBeInstanceOf(JobCancelled);
  monitor.stop();
});
