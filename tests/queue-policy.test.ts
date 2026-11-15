import { expect, it, vi } from 'vitest';

import type { Queue } from '../apps/worker/node_modules/bullmq';
import { dispatchJob, JOB_RETENTION } from '../apps/worker/src/app/queue-policy.ts';

const row = { id: 'job-id', type: 'analyze_garment' };

function fixture(state?: string) {
  const remove = vi.fn(async () => {}),
    add = vi.fn(async () => ({}));
  const queue = {
    getJob: vi.fn(async () => (state ? { getState: async () => state, remove } : undefined)),
    add,
  };

  return { queue: queue as unknown as Pick<Queue, 'getJob' | 'add'>, remove, add };
}

it('keeps up to 1000 jobs within seven days', () => {
  expect(JOB_RETENTION).toEqual({ age: 604800, count: 1000 });
});
it.each(['completed', 'failed'])(
  'allows a DB-authorized retry over a retained %s job',
  async (state) => {
    const f = fixture(state);

    await dispatchJob(f.queue, row, async () => true);
    expect(f.remove).toHaveBeenCalledOnce();
    expect(f.add).toHaveBeenCalledWith(row.type, { id: row.id }, { jobId: row.id });
  },
);
it.each(['completed', 'failed', 'active', 'waiting', 'delayed'])(
  'preserves a retained or live %s job without a DB retry',
  async (state) => {
    const f = fixture(state);

    await dispatchJob(f.queue, row, async () => false);
    expect(f.remove).not.toHaveBeenCalled();
    expect(f.add).not.toHaveBeenCalled();
  },
);
it('enqueues a new ID normally', async () => {
  const f = fixture();

  await dispatchJob(f.queue, row, async () => true);
  expect(f.add).toHaveBeenCalledOnce();
});

it('does not resurrect an ID cancelled after the dispatcher fetched its batch', async () => {
  const f = fixture();

  await dispatchJob(f.queue, row, async () => false);
  expect(f.add).not.toHaveBeenCalled();
});
