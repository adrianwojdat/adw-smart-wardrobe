import type { FastifyInstance } from 'fastify';

import { geminiCredentialInputSchema, geminiModelUpdateSchema } from '@wardrobe/shared';

import type { Config } from '../../app/config.js';

import { HttpError, type sessions } from '../auth/session.js';
import { encryptGeminiKey } from './gemini-crypto.js';
import { requestError, safeTaskColumns, storedTaskSchema } from './route-utils.js';

type SessionManager = ReturnType<typeof sessions>;

export function registerGeminiSettingsRoutes(
  app: FastifyInstance,
  config: Config,
  session: SessionManager,
) {
  app.get('/api/gemini/settings', async (req, reply) => {
    const { sb, user } = await session.load(req, reply);
    const [credentialResult, taskResult] = await Promise.all([
      sb.from('gemini_credentials').select('key_hint,model').eq('user_id', user.id).maybeSingle(),
      sb
        .from('gemini_tasks')
        .select(safeTaskColumns)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (credentialResult.error || taskResult.error)
      throw new HttpError(
        503,
        'Gemini settings could not be loaded. Apply the application migration.',
      );

    return {
      configured: !!credentialResult.data,
      key_hint: credentialResult.data?.key_hint ?? null,
      model: credentialResult.data?.model ?? null,
      rpm_limit: config.GEMINI_RPM_LIMIT,
      queue_limit: config.GEMINI_MAX_QUEUE,
      active_task: taskResult.data ? storedTaskSchema.parse(taskResult.data) : null,
    };
  });

  app.put('/api/gemini/settings', async (req, reply) => {
    const { user } = await session.load(req, reply);
    const body = geminiCredentialInputSchema.parse(req.body);

    if (!config.GEMINI_ENCRYPTION_KEY)
      throw new HttpError(
        503,
        'Gemini key encryption has not been configured by the administrator.',
      );

    const encrypted = encryptGeminiKey(body.apiKey, config.GEMINI_ENCRYPTION_KEY);
    let saved: { key_hint: string; model: string | null } | undefined;

    try {
      const result = await session.pool.query(
        'select key_hint,model from private.save_gemini_credential_for_user($1,$2,$3)',
        [user.id, encrypted, body.apiKey.slice(-4)],
      );

      saved = result.rows[0] as typeof saved;
    } catch (error) {
      requestError(error as { code?: string; message?: string });
    }

    if (!saved) throw new HttpError(503, 'Failed to save the Gemini API key.');

    return {
      configured: true,
      key_hint: saved.key_hint,
      model: saved.model,
    };
  });

  app.patch('/api/gemini/settings/model', async (req, reply) => {
    const { user } = await session.load(req, reply);
    const body = geminiModelUpdateSchema.parse(req.body);

    try {
      const updated = await session.pool.query(
        'select key_hint,model from private.update_gemini_model_for_user($1,$2)',
        [user.id, body.model],
      );
      const data = updated.rows[0] as { key_hint: string; model: string } | undefined;

      if (!data) throw new HttpError(400, 'Save a Gemini API key first.');

      return { configured: true, key_hint: data.key_hint, model: data.model };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if ((error as { code?: string }).code === 'P0002')
        throw new HttpError(400, 'Save a Gemini API key first.');
      requestError(error as { code?: string; message?: string });
    }
  });

  app.delete('/api/gemini/settings', async (req, reply) => {
    const { user } = await session.load(req, reply);

    try {
      await session.pool.query('select private.delete_gemini_credential_for_user($1)', [user.id]);
    } catch (error) {
      requestError(error as { code?: string; message?: string });
    }

    return { ok: true };
  });
}
