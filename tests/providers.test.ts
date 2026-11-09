import { afterEach, it, expect, vi } from 'vitest';
import { analyze, orient, AiUnavailable } from '../apps/worker/src/providers';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('does not contact localhost or download models when LAN AI is unconfigured', async () => {
  vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434');
  vi.stubEnv('OLLAMA_VISION_MODEL', 'existing-vision');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(orient(Buffer.from('image'))).rejects.toBeInstanceOf(AiUnavailable);
  expect(fetch).not.toHaveBeenCalled();
});
it('classifies an offline LAN PC as retryable', async () => {
  vi.stubEnv('OLLAMA_BASE_URL', 'http://192.168.1.80:11434');
  vi.stubEnv('OLLAMA_VISION_MODEL', 'existing-vision');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(analyze(Buffer.from('image'), false)).rejects.toBeInstanceOf(AiUnavailable);
});
it('validates suggestions and removes photo guesses about material or size', async () => {
  vi.stubEnv('OLLAMA_BASE_URL', 'http://192.168.1.80:11434');
  vi.stubEnv('OLLAMA_VISION_MODEL', 'existing-vision');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            source: 'photo',
            confidence: 0.4,
            uncertainties: ['Sprawdź kolor'],
            suggestions: {
              name: 'Marynarka',
              category: 'outerwear',
              material: 'wełna',
              size: 'M',
            },
          }),
        },
      }),
    }),
  );
  const result = await analyze(Buffer.from('image'), false);
  expect(result.suggestions.name).toBe('Marynarka');
  expect(result.suggestions.material).toBeUndefined();
  expect(result.suggestions.size).toBeUndefined();
});
it('propagates explicit cancellation instead of treating it as an offline AI retry', async () => {
  vi.stubEnv('OLLAMA_BASE_URL', 'http://192.168.1.80:11434');
  vi.stubEnv('OLLAMA_VISION_MODEL', 'existing-vision');
  const controller = new AbortController(),
    reason = new Error('cancelled');
  controller.abort(reason);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) => {
      options.signal.throwIfAborted();
    }),
  );
  await expect(analyze(Buffer.from('image'), false, controller.signal)).rejects.toBe(reason);
});
