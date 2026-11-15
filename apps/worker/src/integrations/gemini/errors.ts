export type GeminiErrorCode =
  | 'invalid_key'
  | 'model_unavailable'
  | 'rate_limited'
  | 'daily_quota'
  | 'provider_unavailable'
  | 'timeout'
  | 'cancelled'
  | 'encryption_error'
  | 'invalid_response';
export class GeminiProviderError extends Error {
  constructor(
    readonly code: GeminiErrorCode,
    message: string,
    readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function publicError(
  status: number,
  payload: unknown,
  retryAfter: string | null,
): GeminiProviderError {
  const record = isRecord(payload) ? payload : {};
  const error = isRecord(record.error) ? record.error : {};
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const statusText = typeof error.status === 'string' ? error.status.toLowerCase() : '';
  const detailText = JSON.stringify(error.details ?? '').toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /api_key_invalid|invalid api key|api key (?:is )?not valid/.test(`${statusText} ${message}`)
  )
    return new GeminiProviderError(
      'invalid_key',
      'The Gemini API key is invalid or has no API access.',
    );
  if (status === 404)
    return new GeminiProviderError(
      'model_unavailable',
      'The selected model is unavailable for this API key or project.',
    );

  if (status === 429) {
    const daily = /quota_exceeded|per.day|requestsperday|rpd/.test(
      `${statusText} ${message} ${detailText}`,
    );
    let retryMs = 0;

    if (retryAfter) {
      const seconds = Number(retryAfter);

      retryMs = Number.isFinite(seconds)
        ? seconds * 1000
        : Math.max(0, Date.parse(retryAfter) - Date.now());
    }

    const retryDelay = /"retrydelay"\s*:\s*"([0-9.]+)s"/.exec(detailText);

    if (retryDelay) retryMs = Math.max(retryMs, Number(retryDelay[1]) * 1000);

    return new GeminiProviderError(
      daily ? 'daily_quota' : 'rate_limited',
      daily
        ? 'The daily Gemini quota is exhausted. Try again after the quota resets.'
        : 'Gemini is temporarily rate limiting requests.',
      retryMs,
    );
  }

  if (status >= 500)
    return new GeminiProviderError(
      'provider_unavailable',
      'Gemini servers are temporarily unavailable.',
    );

  return new GeminiProviderError(
    'invalid_response',
    'Gemini rejected the request. Check the model and try again.',
  );
}
