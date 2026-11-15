import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function encrypt(text: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

  return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]).toString(
    'base64url',
  );
}

export function decrypt(text: string, key: string) {
  const bytes = Buffer.from(text, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));

  cipher.setAuthTag(bytes.subarray(-16));

  return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString();
}

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
