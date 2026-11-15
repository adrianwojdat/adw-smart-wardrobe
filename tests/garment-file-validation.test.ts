import { describe, expect, it } from 'vitest';

import { validateGarmentFileSelection } from '../apps/web/src/features/garments/lib/garment-file-validation';

const file = (name: string, type: string, size = 100) =>
  new File(['x'.repeat(size)], name, { type });

describe('validateGarmentFileSelection', () => {
  it('accepts supported image formats within the size limit', () => {
    expect(validateGarmentFileSelection([file('top.webp', 'image/webp')], 2, 1)).toBeUndefined();
  });

  it('rejects unsupported formats and files larger than 10 MB', () => {
    expect(validateGarmentFileSelection([file('photo.gif', 'image/gif')], 0, 0)).toBe(
      'unsupportedFile',
    );
    expect(
      validateGarmentFileSelection([file('large.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1)], 0, 0),
    ).toBe('unsupportedFile');
  });

  it('limits pending and existing images together to twelve', () => {
    expect(validateGarmentFileSelection([file('new.jpg', 'image/jpeg')], 8, 3)).toBeUndefined();
    expect(validateGarmentFileSelection([file('new.jpg', 'image/jpeg')], 8, 4)).toBe(
      'tooManyFiles',
    );
  });
});
