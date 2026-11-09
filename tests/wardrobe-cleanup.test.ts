import { expect, it, vi } from 'vitest';
import { cleanupWardrobe } from '../apps/worker/src/wardrobe-cleanup';
it('removes only durable scoped paths and job IDs, then acknowledges cleanup', async () => {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.startsWith('select') ? [{ wardrobe_id: 'owned', job_ids: ['job-one'] }] : [],
  }));
  const client = { query, release: vi.fn() };
  const pool = { connect: async () => client };
  const list = vi.fn(async (prefix: string) => ({
    data:
      prefix === 'owned'
        ? [{ name: 'garment', id: null }]
        : [
            { name: 'original.jpg', id: 'object' },
            { name: 'catalog.webp', id: 'processed' },
          ],
    error: null,
  }));
  const remove = vi.fn(async () => ({ error: null }));
  const storage = { storage: { from: vi.fn(() => ({ list, remove })) } };
  const jobRemove = vi.fn();
  const queue = { getJob: vi.fn(async () => ({ remove: jobRemove })) };
  await cleanupWardrobe(pool as never, storage as never, [queue as never]);
  expect(queue.getJob).toHaveBeenCalledWith('job-one');
  expect(jobRemove).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith(['owned/garment/original.jpg', 'owned/garment/catalog.webp']);
  expect(query).toHaveBeenCalledWith(
    'delete from private.wardrobe_deletions where wardrobe_id=$1',
    ['owned'],
  );
  expect(query).toHaveBeenLastCalledWith('commit');
});
it('keeps cleanup durable when an active Redis job cannot be removed', async () => {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.startsWith('select') ? [{ wardrobe_id: 'owned', job_ids: ['active'] }] : [],
  }));
  const release = vi.fn();
  const pool = { connect: async () => ({ query, release }) };
  const queue = {
    getJob: async () => ({
      remove: async () => {
        throw Error('locked');
      },
    }),
  };
  await expect(cleanupWardrobe(pool as never, {} as never, [queue as never])).rejects.toThrow(
    'locked',
  );
  expect(query).toHaveBeenLastCalledWith('rollback');
  expect(release).toHaveBeenCalledOnce();
  expect(query.mock.calls.some(([sql]) => sql.startsWith('delete'))).toBe(false);
});
