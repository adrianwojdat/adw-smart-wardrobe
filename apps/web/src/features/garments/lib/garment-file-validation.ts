const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_COUNT = 12;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateGarmentFileSelection(
  selected: File[],
  pendingCount: number,
  existingCount: number,
): 'unsupportedFile' | 'tooManyFiles' | undefined {
  if (selected.some((file) => file.size > MAX_FILE_SIZE || !IMAGE_TYPES.has(file.type))) {
    return 'unsupportedFile';
  }

  if (selected.length + pendingCount + existingCount > MAX_IMAGE_COUNT) {
    return 'tooManyFiles';
  }
}
