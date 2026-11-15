import { geminiTaskSchema } from '@wardrobe/shared';

import { HttpError, type sessions } from '../auth/session.js';

type SessionManager = ReturnType<typeof sessions>;
export const storedTaskSchema = geminiTaskSchema;
export const safeTaskColumns =
  'id,kind,status,result,error_code,error_message,created_at,updated_at';

export function requestError(error: { code?: string | null; message?: string | null }): never {
  if (error.code === '53000')
    throw new HttpError(429, 'The Gemini queue is full. Try again later.');
  if (error.code === '42501')
    throw new HttpError(403, 'You do not have permission to configure Gemini.');
  if (error.code === 'P0002') throw new HttpError(404, 'Nie znaleziono zadania Gemini.');
  throw new HttpError(400, 'Failed to save the Gemini configuration.');
}

export async function readTask(sb: Awaited<ReturnType<SessionManager['load']>>['sb'], id: string) {
  const result = await sb.from('gemini_tasks').select(safeTaskColumns).eq('id', id).maybeSingle();

  if (result.error || !result.data) throw new HttpError(404, 'Nie znaleziono zadania Gemini.');

  return storedTaskSchema.parse(result.data);
}
