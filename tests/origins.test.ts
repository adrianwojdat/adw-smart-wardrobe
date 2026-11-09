import { expect, it } from 'vitest';
import { allowedOrigins } from '../apps/api/src/origins';
it('requires explicit origins and keeps the canonical localhost origin', () => {
  const allowed = allowedOrigins(
    'http://localhost:8080',
    ' http://192.168.0.217:8080,https://wardrobe.example ',
  );
  expect(allowed.has('http://localhost:8080')).toBe(true);
  expect(allowed.has('http://192.168.0.217:8080')).toBe(true);
  for (const origin of [
    'http://192.168.0.218:8080',
    'http://192.168.0.217:8000',
    'https://192.168.0.217:8080',
    'null',
    'https://evil.example',
  ])
    expect(allowed.has(origin)).toBe(false);
});
it('rejects wildcard/path/credential configuration and defaults to one origin', () => {
  expect(allowedOrigins('http://localhost:8080').size).toBe(1);
  for (const extra of [
    '*',
    'http://user:pass@host',
    'https://host/path',
    'ftp://host',
    'https://host/?x=1',
  ])
    expect(() => allowedOrigins('http://localhost:8080', extra)).toThrow();
});
