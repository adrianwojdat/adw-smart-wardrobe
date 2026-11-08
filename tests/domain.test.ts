import { describe, it, expect } from 'vitest';
import {
  garmentInput,
  garmentSchema,
  recommend,
  registerSchema,
} from '../packages/shared/src/index';
import { encrypt, decrypt, hash } from '../apps/api/src/session';
const base = {
  wardrobe_id: '2fd58432-9442-4190-9e2b-e1cab47b7cc7',
  owner_id: '55828b54-e64e-4da6-91b7-985dd1481e48',
  created_at: '2026-11-08T10:00:00Z',
  updated_at: '2026-11-08T10:00:00Z',
  name: 'Ubranie',
};
const garment = (id: string, category: 'tops' | 'bottoms' | 'shoes' | 'dresses', extra = {}) =>
  garmentSchema.parse({ ...base, id, category, ...extra });
describe('owned wardrobe recommendations', () => {
  const top = garment('9cd2f856-56f2-4b14-bc57-3b8d609e1f81', 'tops');
  const bottom = garment('f3d945bd-b8cb-488a-9f30-55b9c80ebd06', 'bottoms');
  it('uses exact IDs and never invents missing garments', () => {
    const result = recommend([top, bottom], 'everyday');
    expect(result).toEqual([[top, bottom]]);
    expect(recommend([top], 'everyday')).toEqual([]);
  });
  it('excludes unavailable clothes and incompatible occasions', () => {
    expect(recommend([top, { ...bottom, cleanliness: 'dirty' }], 'everyday')).toEqual([]);
    expect(recommend([top, { ...bottom, archived: true }], 'everyday')).toEqual([]);
    expect(recommend([{ ...top, occasions: ['office'] }, bottom], 'date')).toEqual([]);
  });
  it('caps combinations and allows dresses without fabricated shoes', () => {
    const dress = garment('55dab414-e03e-4797-a160-9fef20800d42', 'dresses');
    expect(recommend([dress], 'everyday')).toEqual([[dress]]);
  });
});
describe('boundary validation', () => {
  it('rejects weak passwords and invalid states', () => {
    expect(
      registerSchema.safeParse({ email: 'x@example.com', name: 'X', password: 'short' }).success,
    ).toBe(false);
    expect(
      garmentInput.safeParse({ ...base, category: 'tops', cleanliness: 'unknown' }).success,
    ).toBe(false);
  });
  it('does not accept visual material estimates as verified composition', () => {
    expect(
      garmentInput.safeParse({ ...base, category: 'tops', material_source: 'ai' }).success,
    ).toBe(false);
  });
  it('strips ownership fields from updates', () => {
    const parsed = garmentInput.parse({ ...base, category: 'tops', owner_id: 'attacker' });
    expect(parsed).not.toHaveProperty('owner_id');
  });
});
describe('encrypted opaque sessions', () => {
  const key = 'ab'.repeat(32);
  it('round trips without retaining plaintext', () => {
    const token = 'sensitive-provider-refresh-token';
    const ciphertext = encrypt(token, key);
    expect(ciphertext).not.toContain(token);
    expect(decrypt(ciphertext, key)).toBe(token);
    expect(hash(token)).toHaveLength(64);
  });
  it('rejects tampering and wrong keys', () => {
    const encrypted = encrypt('token', key);
    const bytes = Buffer.from(encrypted, 'base64url');
    bytes[15] = bytes[15]! ^ 1;
    expect(() => decrypt(bytes.toString('base64url'), key)).toThrow();
    expect(() => decrypt(encrypted, 'cd'.repeat(32))).toThrow();
  });
});
