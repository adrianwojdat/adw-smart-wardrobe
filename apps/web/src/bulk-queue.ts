export const BATCH_LIMIT = 200;
export const UPLOAD_CONCURRENCY = 3;
export function fileError(file: Pick<File, 'size' | 'type'>): string | undefined {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Wybierz plik JPEG, PNG lub WebP.';
  if (file.size > 10 * 1024 * 1024) return 'Zdjęcie przekracza limit 10 MB.';
  if (!file.size) return 'Plik jest pusty.';
}
/** Bounded uploads, spaced to stay below the existing BFF rate limit. */
export async function runUploads<T>(
  items: T[],
  process: (item: T) => Promise<void>,
  spacing = 750,
) {
  let cursor = 0;
  let nextStart = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++]!;
        const start = nextStart;
        nextStart += spacing;
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, start - Date.now())));
        await process(item);
      }
    }),
  );
}
