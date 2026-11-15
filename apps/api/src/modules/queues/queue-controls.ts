import type { Queue } from 'bullmq';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Pool } from 'pg';
import { z } from 'zod';

import { HttpError } from '../auth/session.js';

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Queue controls — Smart Wardrobe</title><style>body{font:16px/1.6 system-ui;background:#f8f7f4;color:#2d332e;margin:0;padding:24px}main{max-width:640px;margin:40px auto;background:white;border:1px solid #e5e6df;border-radius:16px;padding:28px}button,select{font:inherit;padding:12px;border-radius:8px;border:1px solid #314c40}button{background:#314c40;color:white;cursor:pointer}button:disabled{opacity:.5}label{display:block;margin:20px 0}a{color:#314c40}#result{white-space:pre-wrap}</style><script src="/api/admin/queue-control.js" defer></script></head><body><main><h1>Queue controls</h1><p><a href="/api/admin/queues/">View Bull Board</a> · <a href="/wardrobe">Back to wardrobe</a></p><p>Cancel queued and active jobs. Photos, garments, existing suggestions and history will be preserved. The worker can remain running.</p><label>Queue <select id="queue"><option value="ai">AI analysis</option><option value="images">Image processing</option><option value="all">Both queues</option></select></label><label><input type="checkbox" id="confirm"> I confirm cancellation of all queued and active jobs in the selected queue.</label><button id="cancel" disabled>Cancel queued jobs</button><p id="result" role="status" aria-live="polite"></p><p>Active analysis receives an abort signal. A running ONNX step may finish computing, but its cancelled result will not be committed. The Ollama host may take a moment to release processing resources.</p><p>To run a single analysis, cancel the AI queue, open the selected garment and choose Retry AI analysis. New imports add jobs again.</p></main></body></html>`;
const script = `const button=document.getElementById('cancel'),confirmation=document.getElementById('confirm'),result=document.getElementById('result');confirmation.addEventListener('change',()=>button.disabled=!confirmation.checked);button.addEventListener('click',async()=>{button.disabled=true;result.textContent='Cancelling jobs…';try{const csrf=await fetch('/api/auth/csrf',{cache:'no-store'});if(!csrf.ok)throw Error('Sign in again.');const {token}=await csrf.json();const response=await fetch('/api/admin/queue-control/cancel',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':token},body:JSON.stringify({queue:document.getElementById('queue').value})});const data=await response.json();if(!response.ok)throw Error(data.message||'Failed to cancel jobs.');result.textContent='Cancelled: '+data.cancelled+'. Removed from Redis: '+data.removed+'. Active or awaiting cleanup: '+data.cleanupPending+'. Cancelled jobs will not be enqueued again.';confirmation.checked=false;}catch(error){result.textContent=error.message;}finally{button.disabled=!confirmation.checked;}});`;

export async function registerQueueControls(
  app: FastifyInstance,
  queues: Queue[],
  pool: Pool,
  authorize: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
) {
  await app.register(async (scope) => {
    scope.addHook('onRequest', async (req, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      await authorize(req, reply);
    });
    scope.get('/api/admin/queue-control', async (_req, reply) =>
      reply.type('text/html; charset=utf-8').send(page),
    );
    scope.get('/api/admin/queue-control.js', async (_req, reply) =>
      reply.type('application/javascript; charset=utf-8').send(script),
    );
    scope
      .withTypeProvider<ZodTypeProvider>()
      .post(
        '/api/admin/queue-control/cancel',
        { schema: { body: z.object({ queue: z.enum(['all', 'images', 'ai']) }) } },
        async (req) => {
          const result = await pool.query('select private.cancel_queue_jobs($1) as jobs', [
            req.body.queue,
          ]);
          const jobs = result.rows[0].jobs as { id: string; type: string }[];
          let removed = 0;
          let absent = 0;

          // The durable cancellation happens first. Locked jobs are aborted cooperatively.
          for (let offset = 0; offset < jobs.length; offset += 10)
            await Promise.all(
              jobs.slice(offset, offset + 10).map(async (row) => {
                const queue = queues.find(
                  (q) => q.name === (row.type === 'process_image' ? 'wardrobe' : 'wardrobe-ai'),
                );

                if (!queue) throw new HttpError(503, 'The queue is unavailable.');

                try {
                  const job = await queue.getJob(row.id);

                  if (!job) absent++;

                  if (job && (await job.getState()) !== 'active') {
                    await job.remove();
                    removed++;
                  }
                } catch {
                  app.log.warn(
                    'Cancelled Redis job cleanup deferred; durable cancellation preserved',
                  );
                }
              }),
            );

          return {
            cancelled: jobs.length,
            removed,
            cleanupPending: jobs.length - removed - absent,
          };
        },
      );
  });
}
