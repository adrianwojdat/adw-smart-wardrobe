import { createDecipheriv } from 'node:crypto';

import { GeminiProviderError } from './errors.js';

export function decryptGeminiKey(ciphertext: string, secret: string): string {
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new GeminiProviderError('encryption_error', 'Encryption is not configured.');

  const [version, ivPart, tagPart, dataPart] = ciphertext.split('.');

  if (version !== 'v1' || !ivPart || !tagPart || !dataPart)
    throw new GeminiProviderError(
      'encryption_error',
      'Could not decrypt the API key. Save the key again.',
    );

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(secret, 'hex'),
      Buffer.from(ivPart, 'base64url'),
    );

    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new GeminiProviderError(
      'encryption_error',
      'Could not decrypt the API key. Save the key again.',
    );
  }
}
