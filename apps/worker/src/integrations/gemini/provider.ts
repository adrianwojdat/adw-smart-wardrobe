import { z } from 'zod';

import { GeminiProviderError, publicError } from './errors.js';
import { type LimiterRedis, waitForGeminiSlot } from './limiter.js';

export { GeminiProviderError } from './errors.js';
export { decryptGeminiKey } from './credentials.js';
export { quotaRedisKey, waitForGeminiSlot, type LimiterRedis } from './limiter.js';

const modelRecord = z.object({
  name: z.string().regex(/^models\/[a-zA-Z0-9._-]{1,120}$/),
  displayName: z.string().default(''),
  supportedGenerationMethods: z.array(z.string()).default([]),
});
const modelsResponse = z.object({
  models: z.array(modelRecord).default([]),
  nextPageToken: z.string().optional(),
});
const contentResponse = z.object({ candidates: z.array(z.unknown()).min(1) });

export type GeminiCallOptions = {
  apiKey: string;
  model: string;
  redis: LimiterRedis;
  rateKey: string;
  rpm: number;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  onRetry?: () => Promise<void> | void;
  random?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

export type GeminiRequestOptions = GeminiCallOptions & {
  kind: 'connection_test' | 'list_models' | 'outfit_recommendation' | 'travel_packing';
  prompt?: string;
};

/** Shared authenticated transport for future Gemini features; every HTTP attempt consumes a Redis RPM slot. */
export async function callGemini(
  options: GeminiCallOptions,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const random = options.random ?? Math.random;

  for (let attempt = 0; ; attempt++) {
    if (options.signal.aborted) throw new GeminiProviderError('cancelled', 'Zadanie anulowano.');
    await waitForGeminiSlot(options.redis, options.rateKey, options.rpm, options.signal, random);

    let response: Response;

    try {
      const headers = new Headers(init.headers);

      headers.set('x-goog-api-key', options.apiKey);
      response = await fetchImpl(url, {
        ...init,
        headers,
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(45000)]),
      });
    } catch (error) {
      if (options.signal.aborted) throw new GeminiProviderError('cancelled', 'Zadanie anulowano.');
      if (error instanceof Error && error.name === 'TimeoutError')
        throw new GeminiProviderError(
          'timeout',
          'Gemini timed out. The request may have consumed quota.',
        );
      throw new GeminiProviderError('provider_unavailable', 'Could not connect to Gemini.');
    }

    if (response.ok) return response;

    let payload: unknown;

    try {
      payload = await response.clone().json();
    } catch {
      payload = {};
    }

    const error = publicError(response.status, payload, response.headers.get('retry-after'));
    const canRetry =
      (error.code === 'rate_limited' || error.code === 'provider_unavailable') && attempt < 2;

    if (!canRetry) throw error;
    await options.onRetry?.();

    const jitter = Math.floor(random() * 300);
    const backoff = Math.min(30000, 1000 * 2 ** attempt) + jitter;

    await (options.sleep ?? delay)(Math.max(error.retryAfterMs, backoff), options.signal);
  }
}

export async function runGeminiTask(options: GeminiRequestOptions): Promise<unknown> {
  if (options.kind === 'connection_test') {
    const response = await callGemini(
      options,
      `https://generativelanguage.googleapis.com/v1beta/${options.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply exactly: OK' }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
      },
    );

    contentResponse.parse(await response.json());

    return { message: 'The Gemini connection is working.' };
  }

  if (options.kind === 'outfit_recommendation' || options.kind === 'travel_packing') {
    if (!options.prompt)
      throw new GeminiProviderError(
        'invalid_response',
        'Brakuje danych do wygenerowania stylizacji.',
      );

    const response = await callGemini(
      options,
      `https://generativelanguage.googleapis.com/v1beta/${options.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: options.prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            ...(options.kind === 'travel_packing' ? { maxOutputTokens: 8192 } : {}),
            responseSchema:
              options.kind === 'travel_packing'
                ? undefined
                : {
                    type: 'OBJECT',
                    required: ['outfits'],
                    properties: {
                      outfits: {
                        type: 'ARRAY',
                        items: {
                          type: 'OBJECT',
                          required: ['id', 'name', 'garment_ids', 'rationale', 'missing_items'],
                          properties: {
                            id: { type: 'STRING' },
                            name: { type: 'STRING' },
                            garment_ids: { type: 'ARRAY', items: { type: 'STRING' } },
                            rationale: { type: 'STRING' },
                            missing_items: {
                              type: 'ARRAY',
                              items: {
                                type: 'OBJECT',
                                required: ['category', 'description'],
                                properties: {
                                  category: {
                                    type: 'STRING',
                                    enum: [
                                      'tops',
                                      'bottoms',
                                      'dresses',
                                      'outerwear',
                                      'shoes',
                                      'accessories',
                                    ],
                                  },
                                  description: { type: 'STRING' },
                                },
                              },
                            },
                            wearing_tips: { type: 'STRING' },
                          },
                        },
                      },
                    },
                  },
            temperature: 0.35,
          },
        }),
      },
    );
    const parsed = contentResponse.parse(await response.json());
    const candidate = parsed.candidates[0] as { content?: { parts?: { text?: string }[] } };
    const jsonText = candidate.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!jsonText)
      throw new GeminiProviderError('invalid_response', 'Gemini returned an empty response.');

    try {
      return JSON.parse(jsonText) as unknown;
    } catch {
      throw new GeminiProviderError(
        'invalid_response',
        'Gemini returned an invalid outfit response format.',
      );
    }
  }

  const all: { name: string; displayName: string }[] = [];
  let pageToken = '';

  for (let page = 0; page < 10; page++) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');

    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await callGemini(options, url.toString(), { method: 'GET' });
    const parsed = modelsResponse.parse(await response.json());

    all.push(
      ...parsed.models
        .filter((model) => model.supportedGenerationMethods.includes('generateContent'))
        .map(({ name, displayName }) => ({ name, displayName: displayName || name })),
    );
    if (!parsed.nextPageToken) break;
    pageToken = parsed.nextPageToken;
  }

  return { models: all };
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new GeminiProviderError('cancelled', 'Zadanie anulowano.'));

    const timer = setTimeout(
      () => {
        signal.removeEventListener('abort', abort);
        resolve();
      },
      Math.min(ms, 2147483647),
    );
    const abort = () => {
      clearTimeout(timer);
      reject(new GeminiProviderError('cancelled', 'Zadanie anulowano.'));
    };

    signal.addEventListener('abort', abort, { once: true });
    timer.unref?.();
  });
}
