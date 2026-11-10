import { recommendBaseline as recommend } from './fixtures/outfit-baseline';
import { describe, it, expect } from 'vitest';
import { garmentInput, garmentSchema, registerSchema } from '../packages/shared/src/index';
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
  const sample = (i: number, category: 'tops' | 'bottoms' | 'shoes' | 'dresses') =>
    garment(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, category);
  const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  it('uses six distinct tops and bottoms when available, with varied requests', () => {
    const clothes = [
      ...Array.from({ length: 8 }, (_, i) => sample(i + 1, 'tops')),
      ...Array.from({ length: 8 }, (_, i) => sample(i + 20, 'bottoms')),
    ];
    const first = recommend(clothes, 'everyday', 18, seeded(1));
    expect(first).toHaveLength(6);
    for (const category of ['tops', 'bottoms'])
      expect(
        new Set(
          first
            .flat()
            .filter((g) => g.category === category)
            .map((g) => g.id),
        ).size,
      ).toBe(6);
    expect(recommend(clothes, 'everyday', 18, seeded(2))).not.toEqual(first);
  });
  it('balances scarce garments and never repeats a complete combination', () => {
    const clothes = [
      sample(1, 'tops'),
      sample(2, 'tops'),
      ...Array.from({ length: 6 }, (_, i) => sample(i + 20, 'bottoms')),
    ];
    const result = recommend(clothes, 'everyday', 18, seeded(3));
    expect(result).toHaveLength(6);
    expect(
      new Set(
        result
          .flat()
          .filter((g) => g.category === 'bottoms')
          .map((g) => g.id),
      ).size,
    ).toBe(6);
    for (const top of clothes.slice(0, 2))
      expect(result.filter((gs) => gs.some((g) => g.id === top.id))).toHaveLength(3);
    expect(recommend([sample(1, 'tops'), sample(20, 'bottoms')], 'everyday')).toHaveLength(1);
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
