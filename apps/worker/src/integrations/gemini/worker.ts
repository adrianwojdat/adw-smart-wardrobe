import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import type { Logger } from 'pino';
import { z } from 'zod';

import { geminiTaskKindSchema, outfitRecommendationRequestSchema } from '@wardrobe/shared';

import {
  buildOutfitPrompt,
  validateGeminiOutfits,
} from '../../jobs/outfit-generation/gemini-outfits.js';
import {
  buildPackingPrompt,
  generatePackingWithFallback,
} from '../../jobs/travel-packing/generate.js';

import { decryptGeminiKey, GeminiProviderError, quotaRedisKey, runGeminiTask } from './provider.js';

interface GeminiWorkerConfig {
  GEMINI_ENCRYPTION_KEY: string;
  GEMINI_RPM_LIMIT: number;
  GEMINI_SHARED_QUOTA_ID: string;
  GEMINI_TASK_TIMEOUT_MS: number;
}

interface GeminiWorkerDependencies {
  connection: Redis;
  pool: pg.Pool;
  config: GeminiWorkerConfig;
  logger: Logger;
}

export async function createGeminiWorker({
  connection,
  pool,
  config,
  logger,
}: GeminiWorkerDependencies) {
  const geminiCancellation = connection.duplicate();
  const geminiControllers = new Map<string, AbortController>();
  const geminiRateRedis = {
    eval: async (script: string, keyCount: number, ...args: (string | number)[]) =>
      Number(await connection.eval(script, keyCount, ...args.map(String))),
  };

  await geminiCancellation.subscribe('gemini:cancel');
  geminiCancellation.on('message', (channel, taskId) => {
    if (channel === 'gemini:cancel') geminiControllers.get(taskId)?.abort('cancelled');
  });

  const geminiWorker = new Worker(
    'gemini',
    async (job) => {
      const taskId = z.uuid().parse(job.data.taskId);
      const found = await pool.query(
        `select t.id,t.user_id,t.kind,t.status,t.created_at,t.request,c.encrypted_key,c.model
         from public.gemini_tasks t left join public.gemini_credentials c on c.user_id=t.user_id
        where t.id=$1 and (t.status in ('queued','retrying') or (t.status='running' and t.updated_at<now()-interval '2 minutes'))`,
        [taskId],
      );
      const task = found.rows[0];

      if (!task) return { cancelled: true };

      const controller = new AbortController();

      geminiControllers.set(taskId, controller);

      const remainingMs =
        config.GEMINI_TASK_TIMEOUT_MS - (Date.now() - new Date(task.created_at).getTime());
      const taskTimeout = setTimeout(
        () => controller.abort('task_timeout'),
        Math.max(0, remainingMs),
      );

      try {
        if (remainingMs <= 0)
          throw new GeminiProviderError('timeout', 'Gemini queue wait time exceeded.');
        if (!task.encrypted_key)
          throw new GeminiProviderError('invalid_key', 'Save a Gemini API key in settings.');
        if (!config.GEMINI_ENCRYPTION_KEY)
          throw new GeminiProviderError(
            'encryption_error',
            'Gemini key encryption has not been configured by the administrator.',
          );
        if (task.kind !== 'list_models' && !task.model)
          throw new GeminiProviderError('model_unavailable', 'Select a Gemini model in settings.');

        const claimed = await pool.query(
          `update public.gemini_tasks set status='running',started_at=coalesce(started_at,now()),updated_at=now()
          where id=$1 and (status in ('queued','retrying') or (status='running' and updated_at<now()-interval '2 minutes'))`,
          [taskId],
        );

        if (!claimed.rowCount) return { cancelled: true };

        const apiKey = decryptGeminiKey(task.encrypted_key, config.GEMINI_ENCRYPTION_KEY);
        const kind = geminiTaskKindSchema.parse(task.kind);
        let prompt: string | undefined;
        let outfitContext: { request: unknown; profile: unknown; garments: unknown[] } | undefined;

        if (kind === 'outfit_recommendation') {
          const loaded = await pool.query(
            'select private.load_gemini_outfit_context($1) as context',
            [taskId],
          );

          outfitContext = z
            .object({ request: z.unknown(), profile: z.unknown(), garments: z.array(z.unknown()) })
            .parse(loaded.rows[0]?.context);

          const request = outfitRecommendationRequestSchema.parse(outfitContext.request);

          prompt = buildOutfitPrompt({
            request,
            profile: outfitContext.profile,
            garments: outfitContext.garments,
          });
        }

        if (kind === 'travel_packing')
          prompt = buildPackingPrompt(z.object({ request: z.unknown() }).parse(task).request);

        const execute = () =>
          runGeminiTask({
            apiKey,
            model: task.model ?? 'models/unused-for-listing',
            kind,
            prompt,
            redis: geminiRateRedis,
            rateKey: quotaRedisKey(
              apiKey,
              config.GEMINI_ENCRYPTION_KEY,
              config.GEMINI_SHARED_QUOTA_ID,
            ),
            rpm: config.GEMINI_RPM_LIMIT,
            signal: controller.signal,
            onRetry: async () => {
              await pool.query(
                `update public.gemini_tasks set status='retrying',updated_at=now()
              where id=$1 and status in ('running','retrying')`,
                [taskId],
              );
            },
          });
        const result =
          kind === 'travel_packing'
            ? await generatePackingWithFallback(
                z.object({ request: z.unknown() }).parse(task).request,
                execute,
                controller.signal,
              )
            : await execute();
        const validatedResult =
          kind === 'travel_packing'
            ? result
            : outfitContext
              ? validateGeminiOutfits(result, {
                  request: outfitRecommendationRequestSchema.parse(outfitContext.request),
                  profile: outfitContext.profile,
                  garments: outfitContext.garments,
                })
              : result;
        const completed = await pool.query(
          `update public.gemini_tasks set status='completed',result=$2,request=null,error_code=null,error_message=null,
            updated_at=now(),completed_at=now()
          where id=$1 and status in ('running','retrying')`,
          [taskId, validatedResult],
        );

        return { cancelled: !completed.rowCount };
      } catch (error) {
        const cancelled = controller.signal.reason === 'cancelled';
        const timedOut = controller.signal.reason === 'task_timeout';
        const providerError = error instanceof GeminiProviderError ? error : undefined;
        const code = cancelled
          ? 'cancelled'
          : timedOut
            ? 'timeout'
            : (providerError?.code ?? 'provider_unavailable');
        const message = cancelled
          ? 'Task cancelled.'
          : timedOut
            ? 'Gemini task timeout exceeded.'
            : (providerError?.message ?? 'Gemini is temporarily unavailable.');

        await pool.query(
          `update public.gemini_tasks set status=$2,request=null,error_code=$3,error_message=$4,updated_at=now(),completed_at=now()
          where id=$1 and status in ('queued','running','retrying')`,
          [taskId, cancelled ? 'cancelled' : 'failed', code, message],
        );
        logger.warn({ taskId, code }, 'Gemini task finished with an error');

        return { cancelled };
      } finally {
        clearTimeout(taskTimeout);
        geminiControllers.delete(taskId);
      }
    },
    { connection, concurrency: 1, lockDuration: 190000, maxStalledCount: 1 },
  );

  geminiWorker.on('error', () => logger.error('Gemini queue connection error'));

  return { worker: geminiWorker, cancellation: geminiCancellation };
}
