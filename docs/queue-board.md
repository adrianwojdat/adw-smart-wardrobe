# Panel kolejek

Bull Board belongs to Fastify BFF. After signing into Smart Wardrobe, open `/api/admin/queues/` in the same browser. It shows `wardrobe` (images) and `wardrobe-ai` (Ollama analysis) queues.

`QUEUE_ADMIN_USER_IDS` controls access through a comma-separated list of Supabase Auth user UUIDs; empty disables the dashboard. Wardrobe owner/editor membership alone is insufficient. Application session is required for dashboard HTML, static assets, and API. Responses are not cached; Redis remains private without new ports/containers.

Dashboard is read-only. Retry jobs from garment details to keep PostgreSQL/BullMQ consistent. Mutations are blocked server-side, not merely hidden. Do not enable delete/retry operations without integration with durable job state.

Worker retains completed/failed Redis jobs up to seven days, at most 1000 per state/queue (`age: 604800, count: 1000`); the count limit may evict oldest entries sooner. Cleanup happens as subsequent jobs finish. Policy applies to newly submitted jobs; existing jobs may retain immediate removal settings. Dashboard is not a full archive: Redis jobs appear there, while history/business results remain in PostgreSQL/application. Jobs waiting for Ollama may briefly exist only in durable PostgreSQL and appear in BullMQ on redispatch. Bull Board counts are not total application job counts.

`node scripts/compose.mjs` generates Compose configuration. After deployment approval, rebuild/recreate only API with `--no-deps`, without running migrations. Do not change SMTP, Ollama models, or worker for this feature.
