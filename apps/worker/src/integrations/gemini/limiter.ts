import { createHash, createHmac, randomBytes } from 'node:crypto';

import { GeminiProviderError } from './errors.js';

const acquireScript = `
local key=KEYS[1]
local now=tonumber(ARGV[1])
local rpm=tonumber(ARGV[2])
local member=ARGV[3]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now-60000)
local count=redis.call('ZCARD', key)
if count < rpm then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, 70000)
  return 0
end
local first=redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
return math.max(1, tonumber(first[2])+60000-now)
`;

export function quotaRedisKey(apiKey: string, encryptionSecret: string, sharedScope = ''): string {
  const scope = sharedScope.trim() || createHash('sha256').update(apiKey).digest('hex');
  const digest = createHmac('sha256', Buffer.from(encryptionSecret, 'hex'))
    .update(scope)
    .digest('hex');

  return `gemini:rpm:${digest}`;
}

export type LimiterRedis = {
  eval(script: string, keyCount: number, ...args: (string | number)[]): Promise<number>;
};

export async function waitForGeminiSlot(
  redis: LimiterRedis,
  redisKey: string,
  rpm: number,
  signal: AbortSignal,
  random = Math.random,
): Promise<void> {
  while (true) {
    if (signal.aborted) throw new GeminiProviderError('cancelled', 'Zadanie anulowano.');

    const delay = Number(
      await redis.eval(
        acquireScript,
        1,
        redisKey,
        Date.now(),
        rpm,
        randomBytes(16).toString('hex'),
      ),
    );

    if (delay <= 0) return;
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new GeminiProviderError('cancelled', 'Zadanie anulowano.'));

        return;
      }

      const timer = setTimeout(
        () => {
          signal.removeEventListener('abort', abort);
          resolve();
        },
        delay + Math.floor(random() * 100),
      );
      const abort = () => {
        clearTimeout(timer);
        reject(new GeminiProviderError('cancelled', 'Zadanie anulowano.'));
      };

      signal.addEventListener('abort', abort, { once: true });

      if (signal.aborted) {
        abort();

        return;
      }

      timer.unref?.();
    });
  }
}
