import { HttpError } from '../modules/auth/session.js';

export function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string')
    return error.code;
}

function isPresent<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function checked<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) {
    const code = errorCode(result.error);

    throw new HttpError(
      code === 'PGRST116' ? 404 : code === '42501' ? 403 : 400,
      'The operation could not be completed. Check the input and permissions.',
    );
  }

  if (!isPresent(result.data)) throw new HttpError(404, 'Resource not found.');

  return result.data;
}
