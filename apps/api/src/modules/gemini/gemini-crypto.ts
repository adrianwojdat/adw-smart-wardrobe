import { createCipheriv, randomBytes } from 'node:crypto';

export function encryptGeminiKey(apiKey: string, secret: string): string {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Gemini encryption is not configured');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);

  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}
