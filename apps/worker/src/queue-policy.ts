import type { Queue } from 'bullmq';
export const JOB_RETENTION = { age: 7 * 24 * 60 * 60, count: 1000 };
/** PostgreSQL authorizes retries. Retained terminal Redis IDs must not block them. */
export async function dispatchJob(
  queue: Pick<Queue, 'getJob' | 'add'>,
  row: { id: string; type: string },
  stillQueued: () => Promise<boolean>,
) {
  const existing = await queue.getJob(row.id);
  if (existing) {
    const state = await existing.getState();
    if (!['completed', 'failed'].includes(state) || !(await stillQueued())) return;
    await existing.remove();
  }
  if (!(await stillQueued())) return;
  await queue.add(row.type, { id: row.id }, { jobId: row.id });
}
