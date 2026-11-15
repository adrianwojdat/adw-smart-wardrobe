import { ApiError } from './client';

export function userErrorMessage(error: unknown, translate: (key: string) => string) {
  if (error instanceof ApiError) {
    const keys: Record<string, string> = {
      UNAUTHORIZED: 'errors.unauthorized',
      FORBIDDEN: 'errors.forbidden',
      NOT_FOUND: 'errors.notFound',
      RATE_LIMITED: 'errors.rateLimited',
      VALIDATION_FAILED: 'errors.request',
      SERVICE_UNAVAILABLE: 'errors.server',
      REQUEST_FAILED: 'errors.request',
    };

    const key = error.code ? keys[error.code] : undefined;

    if (key) return translate(key);
    if (error.status === 401) return translate('errors.unauthorized');
    if (error.status === 403) return translate('errors.forbidden');
    if (error.status === 404) return translate('errors.notFound');
    if (error.status === 429) return translate('errors.rateLimited');
    if (error.status >= 500) return translate('errors.server');
    if (error.status === 0) return translate('errors.network');

    return translate('errors.request');
  }

  if (error instanceof TypeError) return translate('errors.network');

  return translate('state.unexpectedError');
}
