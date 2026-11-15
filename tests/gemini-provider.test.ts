import { describe, expect, it } from 'vitest';

import { encryptGeminiKey } from '../apps/api/src/modules/gemini/gemini-crypto.ts';
import {
  decryptGeminiKey,
  type LimiterRedis,
  quotaRedisKey,
  runGeminiTask,
  waitForGeminiSlot,
} from '../apps/worker/src/integrations/gemini/provider.ts';

const encryptionKey = '37'.repeat(32);

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedLimiter(): LimiterRedis {
  return { eval: async () => 0 };
}

describe('Gemini server configuration and provider', () => {
  it('encrypts credentials with authenticated AES-GCM and rejects a changed secret', () => {
    const apiKey = 'AIzaSy_test-user-secret-key-123456789';
    const ciphertext = encryptGeminiKey(apiKey, encryptionKey);

    expect(ciphertext).not.toContain(apiKey);
    expect(decryptGeminiKey(ciphertext, encryptionKey)).toBe(apiKey);
    expect(() => decryptGeminiKey(ciphertext, '91'.repeat(32))).toThrow(
      'Could not decrypt the API key. Save the key again.',
    );
  });

  it('isolates per-key rate scopes and shares a configured project scope', () => {
    const first = quotaRedisKey('key-1', encryptionKey);
    const second = quotaRedisKey('key-2', encryptionKey);

    expect(first).not.toBe(second);
    expect(first).not.toContain('key-1');
    expect(quotaRedisKey('key-1', encryptionKey, 'project-a')).toBe(
      quotaRedisKey('key-2', encryptionKey, 'project-a'),
    );
    expect(quotaRedisKey('key-1', encryptionKey, 'project-a')).not.toBe(
      quotaRedisKey('key-1', encryptionKey, 'project-b'),
    );
  });

  it('waits for a shared Redis reservation instead of rejecting over the RPM cap', async () => {
    let calls = 0;
    const redis: LimiterRedis = {
      eval: async () => (++calls === 1 ? 7 : 0),
    };

    await waitForGeminiSlot(redis, 'gemini:rpm:test', 12, new AbortController().signal, () => 0);
    expect(calls).toBe(2);
  });

  it('uses one atomic limiter reservation for twelve concurrent requests', async () => {
    let reservations = 0;
    const redis: LimiterRedis = {
      eval: async () => {
        reservations++;

        return 0;
      },
    };

    await Promise.all(
      Array.from({ length: 12 }, () =>
        waitForGeminiSlot(redis, 'gemini:rpm:shared', 12, new AbortController().signal),
      ),
    );
    expect(reservations).toBe(12);
  });

  it('retries 429 and 5xx at most three total times and respects Retry-After', async () => {
    let calls = 0;
    let retries = 0;
    let rateReservations = 0;
    const waits: number[] = [];
    const result = await runGeminiTask({
      apiKey: 'user-key',
      model: 'models/gemini-test',
      kind: 'connection_test',
      redis: {
        eval: async () => {
          rateReservations++;

          return 0;
        },
      },
      rateKey: 'gemini:rpm:test',
      rpm: 12,
      signal: new AbortController().signal,
      random: () => 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
      onRetry: () => {
        retries++;
      },
      fetchImpl: async () => {
        calls++;
        if (calls === 1)
          return response(
            429,
            { error: { status: 'RATE_LIMIT_EXCEEDED' } },
            { 'Retry-After': '2' },
          );
        if (calls === 2) return response(503, { error: { status: 'UNAVAILABLE' } });

        return response(200, { candidates: [{ content: { parts: [{ text: 'OK' }] } }] });
      },
    });

    expect(result).toEqual({ message: 'The Gemini connection is working.' });
    expect(calls).toBe(3);
    expect(retries).toBe(2);
    expect(rateReservations).toBe(3);
    expect(waits[0]).toBeGreaterThanOrEqual(2000);
  });

  it('does not retry permanent errors or exhausted daily quota', async () => {
    for (const [status, payload, expected] of [
      [400, { error: { message: 'bad request' } }, 'invalid_response'],
      [
        429,
        { error: { status: 'RESOURCE_EXHAUSTED', message: 'Requests per day quota exceeded' } },
        'daily_quota',
      ],
    ] as const) {
      let calls = 0;

      await expect(
        runGeminiTask({
          apiKey: 'key',
          model: 'models/gemini-test',
          kind: 'connection_test',
          redis: allowedLimiter(),
          rateKey: 'test',
          rpm: 12,
          signal: new AbortController().signal,
          fetchImpl: async () => {
            calls++;

            return response(status, payload);
          },
        }),
      ).rejects.toMatchObject({ code: expected });
      expect(calls).toBe(1);
    }
  });

  it('maps invalid credentials, unavailable models, and transport timeouts without leaking details', async () => {
    const run = (status: number, payload: unknown) =>
      runGeminiTask({
        apiKey: 'secret-key',
        model: 'models/not-available',
        kind: 'connection_test',
        redis: allowedLimiter(),
        rateKey: 'test',
        rpm: 12,
        signal: new AbortController().signal,
        fetchImpl: async () => response(status, payload),
      });

    await expect(run(403, { error: { message: 'private key data' } })).rejects.toMatchObject({
      code: 'invalid_key',
    });
    await expect(
      run(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }),
    ).rejects.toMatchObject({ code: 'invalid_key' });
    await expect(run(404, { error: { message: 'private model data' } })).rejects.toMatchObject({
      code: 'model_unavailable',
    });
    await expect(
      runGeminiTask({
        apiKey: 'secret-key',
        model: 'models/gemini-test',
        kind: 'connection_test',
        redis: allowedLimiter(),
        rateKey: 'test',
        rpm: 12,
        signal: new AbortController().signal,
        fetchImpl: async () => {
          throw new DOMException('network details', 'TimeoutError');
        },
      }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('lists only models that support generateContent', async () => {
    const result = await runGeminiTask({
      apiKey: 'key',
      model: 'models/unused',
      kind: 'list_models',
      redis: allowedLimiter(),
      rateKey: 'test',
      rpm: 12,
      signal: new AbortController().signal,
      fetchImpl: async () =>
        response(200, {
          models: [
            {
              name: 'models/gemini-text',
              displayName: 'Gemini tekst',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-embed',
              displayName: 'Embedding',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
        }),
    });

    expect(result).toEqual({
      models: [{ name: 'models/gemini-text', displayName: 'Gemini tekst' }],
    });
  });

  it('requests one structured JSON outfit response through the shared limiter', async () => {
    let reservations = 0;
    let requestBody: Record<string, unknown> | undefined;
    const result = await runGeminiTask({
      apiKey: 'key',
      model: 'models/gemini-test',
      kind: 'outfit_recommendation',
      prompt: 'Polski prompt z listą garderoby',
      rateKey: 'test',
      rpm: 12,
      redis: {
        eval: async () => {
          reservations++;

          return 0;
        },
      },
      signal: new AbortController().signal,
      fetchImpl: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

        return response(200, {
          candidates: [{ content: { parts: [{ text: '{"outfits":[]}' }] } }],
        });
      },
    });

    expect(result).toEqual({ outfits: [] });
    expect(reservations).toBe(1);
    expect(JSON.stringify(requestBody)).toContain('application/json');
    expect(JSON.stringify(requestBody)).toContain('Polski prompt');
  });

  it('aborts queued limiter wait when cancellation is requested', async () => {
    const controller = new AbortController();
    const redis: LimiterRedis = { eval: async () => 30000 };
    const promise = waitForGeminiSlot(redis, 'test', 12, controller.signal);

    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('aborts an active HTTP request when the task is cancelled', async () => {
    const controller = new AbortController();
    const promise = runGeminiTask({
      apiKey: 'secret-key',
      model: 'models/gemini-test',
      kind: 'connection_test',
      redis: allowedLimiter(),
      rateKey: 'test',
      rpm: 12,
      signal: controller.signal,
      fetchImpl: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('cancelled', 'AbortError')),
            { once: true },
          );
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
  });
});
