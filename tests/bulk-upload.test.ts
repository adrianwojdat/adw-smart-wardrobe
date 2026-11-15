import { describe, expect, it } from 'vitest';

import {
  BATCH_LIMIT,
  fileError,
  runUploads,
} from '../apps/web/src/features/bulk-upload/lib/bulk-queue.ts';

describe('bulk upload', () => {
  it('allows 200 lightweight uploads with at most three concurrent requests', async () => {
    let active = 0,
      maximum = 0;
    const completed: number[] = [];

    await runUploads(
      Array.from({ length: BATCH_LIMIT }, (_, i) => i),
      async (id) => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        completed.push(id);
        active--;
      },
      0,
    );
    expect(completed).toHaveLength(200);
    expect(new Set(completed).size).toBe(200);
    expect(maximum).toBeLessThanOrEqual(3);
  });
  it('continues independent files after a handled upload failure', async () => {
    const failures: number[] = [],
      completed: number[] = [];

    await runUploads(
      [1, 2, 3, 4],
      async (id) => {
        try {
          if (id === 2) throw new Error('network');
          completed.push(id);
        } catch {
          failures.push(id);
        }
      },
      0,
    );
    expect(completed.sort()).toEqual([1, 3, 4]);
    expect(failures).toEqual([2]);
  });
  it('validates formats, empty files and the 10 MB limit', () => {
    expect(fileError({ type: 'image/jpeg', size: 10 * 1024 * 1024 })).toBeUndefined();
    expect(fileError({ type: 'image/png', size: 1 })).toBeUndefined();
    expect(fileError({ type: 'image/webp', size: 1 })).toBeUndefined();
    expect(fileError({ type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 })).toBe('fileTooLarge');
    expect(fileError({ type: 'text/plain', size: 1 })).toBe('invalidType');
    expect(fileError({ type: 'image/jpeg', size: 0 })).toBe('fileEmpty');
  });
});
