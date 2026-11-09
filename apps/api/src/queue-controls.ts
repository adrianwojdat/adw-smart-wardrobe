import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { HttpError } from './session.js';
const page = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sterowanie kolejkami — Smart Wardrobe</title><style>body{font:16px/1.6 system-ui;background:#f8f7f4;color:#2d332e;margin:0;padding:24px}main{max-width:640px;margin:40px auto;background:white;border:1px solid #e5e6df;border-radius:16px;padding:28px}button,select{font:inherit;padding:12px;border-radius:8px;border:1px solid #314c40}button{background:#314c40;color:white;cursor:pointer}button:disabled{opacity:.5}label{display:block;margin:20px 0}a{color:#314c40}#result{white-space:pre-wrap}</style><script src="/api/admin/queue-control.js" defer></script></head><body><main><h1>Sterowanie kolejkami</h1><p><a href="/api/admin/queues/">Zobacz Bull Board</a> · <a href="/wardrobe">Wróć do garderoby</a></p><p>Anuluj oczekujące i aktywne zadania. Zdjęcia, ubrania, dotychczasowe sugestie i historia pozostaną zachowane. Worker może nadal działać.</p><label>Kolejka <select id="queue"><option value="ai">Analiza AI</option><option value="images">Przetwarzanie zdjęć</option><option value="all">Obie kolejki</option></select></label><label><input type="checkbox" id="confirm"> Potwierdzam anulowanie wszystkich oczekujących i aktywnych zadań w wybranej kolejce.</label><button id="cancel" disabled>Anuluj zadania w kolejce</button><p id="result" role="status" aria-live="polite"></p><p>Aktywna analiza otrzyma sygnał przerwania. Trwający krok ONNX może dokończyć obliczenia, ale anulowany wynik nie zostanie zatwierdzony. Komputer z Ollamą może potrzebować chwili na zwolnienie obliczeń.</p><p>Aby wykonać tylko jedną analizę, anuluj kolejkę AI, następnie otwórz wybrane ubranie i kliknij „Powtórz analizę AI”. Nowe importy ponownie dodają zadania.</p></main></body></html>`;
const script = `const button=document.getElementById('cancel'),confirmation=document.getElementById('confirm'),result=document.getElementById('result');confirmation.addEventListener('change',()=>button.disabled=!confirmation.checked);button.addEventListener('click',async()=>{button.disabled=true;result.textContent='Anulowanie zadań…';try{const csrf=await fetch('/api/auth/csrf',{cache:'no-store'});if(!csrf.ok)throw Error('Zaloguj się ponownie.');const {token}=await csrf.json();const response=await fetch('/api/admin/queue-control/cancel',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':token},body:JSON.stringify({queue:document.getElementById('queue').value})});const data=await response.json();if(!response.ok)throw Error(data.message||'Nie udało się anulować zadań.');result.textContent='Anulowano: '+data.cancelled+'. Usunięto z Redis: '+data.removed+'. Aktywne lub oczekujące na porządkowanie: '+data.cleanupPending+'. Anulowane zadania nie zostaną ponownie dodane do kolejki.';confirmation.checked=false;}catch(error){result.textContent=error.message;}finally{button.disabled=!confirmation.checked;}});`;
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
                if (!queue) throw new HttpError(503, 'Kolejka jest niedostępna.');
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
