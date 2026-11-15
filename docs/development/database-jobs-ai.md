# Database, background jobs and AI

[Guide contents](README.md)

## Database and Supabase development

Supabase runs inside the root Compose stack. Auth manages identities; PostgreSQL stores business data; PostgREST exposes authorized SQL resources; private Storage keeps image objects and metadata. The BFF uses the signed-in user's JWT for normal Supabase operations. Session storage uses a restricted PostgreSQL role. The internal worker has controlled SQL operations and privileged Storage access for persisted, authorized jobs; it must recheck access and never accept arbitrary object paths or garment IDs from a model.

Table definitions, foreign keys, indexes, functions, grants and RLS policies are in `supabase/migrations/`. Read the full migration sequence to understand a table's current shape. Core wardrobe/image/job schema starts in `0001_wardrobe.sql` (verify the directory when adding a migration); later migrations extend it. Style profiles, Gemini and packing are introduced in `0016_style_profile.sql`, `0017_gemini_configuration.sql`, `0021_gemini_outfit_generation.sql`, and `0025_travel_packing.sql`, with corrective migrations in between.

The project uses **its own Node/pg migrator**, `apps/api/src/app/migrate.ts`, not a Supabase CLI migration workflow. It sorts `.sql` filenames lexicographically, takes PostgreSQL advisory lock `173450001`, checks SHA-256 in `private.schema_migrations`, and executes each new file and its ledger insert in a transaction. Applied files are immutable; any changed checksum aborts startup. The migrator also provisions the restricted session/worker role passwords. Compose runs it as the one-shot `migrate` service before dependent API/worker services.

TypeScript domain contracts are handwritten Zod schemas under `packages/shared/src/`, with types inferred from those schemas. There is no checked-in generated Supabase database type regeneration command. Update relevant schemas and API parsing explicitly when the database shape changes; do not claim `supabase gen types` is part of this project's workflow.

### How to add a database migration

1. Read the latest ordered SQL and the existing table's policies/functions. Check `private.schema_migrations` in your isolated development database; determine what is applied before touching files.
2. Create the next unused four-digit sequence with a descriptive suffix, for example **proposed** `supabase/migrations/0026_wardrobe_reminders.sql` if `0025` remains the latest. Never reuse a number or rename/edit an applied file.
3. Prefer additive tables/nullable columns. Define foreign keys and intentional delete behavior, constraints and indexes for access patterns. Do not duplicate transaction wrappers unnecessarily; the migrator supplies them.
4. Enable RLS on every new business table. Grant only required operations to appropriate roles and define authenticated ownership/membership policies for both `USING` and `WITH CHECK`. Test member roles, cross-user denial and attempts to reassign ownership/wardrobe IDs.
5. Review functions with elevated privileges: constrain `search_path`, grant execution narrowly, validate caller identity, and do not expose encrypted credential columns. Reuse established authorization functions such as `has_wardrobe_access` only with the correct read/edit requirement.
6. Add shared schemas/types and API tests. Write SQL authorization tests under `tests/` using existing `*-rls.sql` files as references. These files are **not automatically run by Vitest**.
7. Rehearse on an explicitly disposable isolated stack with its own database, Redis, Storage directory, ports and secrets. A Compose project name alone does not isolate the host bind mount `data/storage/`. Inspect the resolved configuration and mount paths before starting tests.
8. Build the API/migrator image for that isolated environment and run its `migrate` service. In an already configured **isolated** Compose checkout the actual command is `docker compose run --rm migrate`; it writes schema/roles and must never be used casually against the existing account database. Compose startup with `docker compose up -d --build` also runs required migrations.
9. Inspect `docker compose logs --tail=100 migrate`. Verify the ledger through `docker compose exec -T db psql -U supabase_admin -d postgres -c 'select name, checksum, applied_at from private.schema_migrations order by name;'`. Confirm new columns/policies with read-only SQL and exercise both authorized and denied API operations.
10. Before deployment, back up and rehearse using [operations](../operations.md), review pending migrations and plan application/schema compatibility. Apply only with environment-owner authorization. Never run a migration merely to validate documentation.
11. If a migration fails, inspect its logs. The current file's SQL/ledger transaction rolls back; earlier successful files remain applied. Fix an **unapplied** file after investigation, or append a corrective migration if already recorded. Do not remove ledger entries, alter checksums or reset the database to force startup.

Example SQL test invocation, **only after selecting and verifying an isolated test checkout/stack** (this inserts disposable fixtures inside a transaction):

```sh
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres < tests/travel-packing-rls.sql
```

Review each SQL file before execution; do not assume every script has the same cleanup behavior. This guide does not authorize running it on an existing account database.

### Database migration safety

A migration evolves schema while preserving data under its designed changes. A reset destroys and recreates state and is not a repair technique for an installation containing valuable data. Never delete volumes, PGDATA or Storage to resolve schema drift. Do not translate historical SQL messages by editing checksum-protected files.

Before risky changes preserve PostgreSQL including roles/Auth/private schemas, Storage **with xattrs**, `db-config` encryption keys, `.env`, image versions and repository revision. The [backup runbook](../operations.md#consistent-backups) provides concrete commands and restoration precautions; keep dumps encrypted and off-host, and rehearse a restore. Neither an untested archive nor a volume snapshot is proof of recovery.

For an existing column, add a compatible replacement first, deploy readers supporting both, backfill deliberately with reviewed scope, then switch writers. Remove old fields only in a separately approved release after old clients/workers are gone. Add defaults/constraints only after considering existing rows and lock duration. The migrator wraps files in a transaction, so operations incompatible with transactions (such as a concurrent index build) need a separately designed procedure. Code rollback does not undo SQL migrations; keep old application versions compatible or plan an explicit corrective migration/verified restore.

## Background jobs and worker

`apps/worker/src/app/worker.ts` configures PostgreSQL, Redis, storage, workers and health monitoring. `jobs/outbox/outbox-dispatcher.ts` reconstitutes queued work from SQL. Image jobs use `wardrobe`; garment analysis uses `wardrobe-ai`; Gemini tasks use `gemini`. Their policies differ: image and garment-analysis jobs have bounded BullMQ attempts/exponential backoff, while Gemini has its own provider/limiter/retry handling and one queue-level attempt. Do not copy retry settings indiscriminately or change another feature's queue configuration.

The outbox dispatches persisted job IDs, not untrusted business payloads. It polls queued work and stale image/analysis processing; Gemini has separate task lifecycle and recovery rules. Job processors reload required state and update SQL progress/status. Cancellation uses the existing job/task controls, abort signals and ownership checks; an explicit cancellation must not be converted into successful fallback generation.

### How to add a new background job

1. Define validated input/output and stable task types in shared contracts where needed. Keep credential and internal SQL details out of public payloads.
2. Add a durable SQL record/authorized producer function in a new migration, following the existing `jobs` or `gemini_tasks` flow. The BFF authenticates the request and checks access before creating work.
3. Enqueue the stable record ID from the API. Handle enqueue failure without claiming work completed; preserve the existing cancellation/recovery semantics. See `modules/gemini/task-routes.ts` and `modules/travel-packing/routes.ts`.
4. Add the processor under `apps/worker/src/jobs/<feature>/`. Validate the loaded input, recheck access and resource existence, implement idempotence/version checks, and write only validated results. Avoid doing expensive work inside database transactions.
5. Extend `jobs/processors.ts` or `integrations/gemini/worker.ts` for the relevant task family. If introducing a distinct queue, explicitly wire its producer, worker, retention, health and shutdown handling in `app/worker.ts`, rather than silently reusing an unrelated queue.
6. Extend `jobs/outbox/outbox-dispatcher.ts` and queue policy only where required. Design bounded retries and transient/permanent error classification; preserve cancellation, locks and cleanup.
7. Mock providers, PostgreSQL, Storage and queue interfaces in unit tests. Test cancellation, retry exhaustion, duplicate dispatch, stale jobs and unauthorized/deleted resources. Real SQL/queue integration belongs in an isolated environment.

Monitor `docker compose logs --tail=100 worker`, task/job polling endpoints and the admin Bull Board at `/api/admin/queues/`. Access requires an authenticated account listed in `QUEUE_ADMIN_USER_IDS`. Read [queue administration](../queue-board.md) before cancelling or bulk-managing jobs. Never flush Redis as a first diagnostic step.

## AI and Gemini integration

Reuse `apps/worker/src/integrations/gemini/provider.ts`, `credentials.ts`, `limiter.ts`, `errors.ts` and `worker.ts`. The BFF settings code encrypts a user's Gemini key; the worker decrypts it internally using `GEMINI_ENCRYPTION_KEY`. No key goes to the browser after saving, prompts, logs or task result JSON. Redis-backed limiting coordinates quotas; configured shared quota identity can group keys belonging to one upstream project. Reserved TPM/RPD options are not a promise that all upstream quotas are enforced locally.

Outfit prompts and output checking live in `jobs/outfit-generation/gemini-outfits.ts`; shared contracts in `packages/shared/src/gemini.ts`. The worker provides bounded wardrobe metadata and the shared interpreted style profile. Hard constraints filter/validate candidates; soft preferences influence ranking. Model garment IDs must be verified against the authorized input wardrobe; a plausible UUID is not proof of ownership. Do not send images when metadata suffices.

Packing uses `jobs/travel-packing/generate.ts`, shared `travel-packing.ts` and `travel-packing/{catalog,rules}.ts`. Gemini enriches a deterministic individual-item baseline. Zod validates the response; normalization deduplicates types, bounds quantities and restores omitted essentials. A labelled baseline can remain useful on provider failure. No normalization runs on saved-list reads to overwrite manual edits. See [completeness rules and limitations](../travel-packing.md).

### How to add a new AI-powered feature

1. Define minimal, bounded input, explicit content language and a validated output contract. Avoid unnecessary private notes/photos or entire account exports.
2. Put English technical instructions with the feature job; treat user input as data, not a source of overriding instructions. Specify JSON structure and the language of user-visible prose separately.
3. Reuse the provider, encrypted credentials, limiter and durable task flow. Honor timeout/abort behavior, quota errors and existing retry bounds. Never instantiate a second Gemini client or bypass limits to fix a failed call.
4. Parse JSON as unknown and validate through Zod before persistence. Check identifiers, quantities, cross-field rules, authorization and business completeness after schema validation. A schema-valid response can still be wrong.
5. Define behavior for malformed/missing data and provider failure: a truthful fallback only when meaningful, otherwise a safe typed failure. Cancellation remains cancellation; never loop indefinitely or manufacture a claim of real AI success.
6. Add an authenticated BFF producer, task polling/cancellation and frontend loading/error/retry flow. Persist generated content independently of UI translations; changing the UI language must not rewrite saved results.
7. Mock fetch/provider replies in Vitest and browser routes in Playwright. Cover valid output, omissions, duplicate/fabricated IDs, wrong language instructions, quota errors, timeout and cancellation. Tests must not make paid Gemini calls or modify a real user's account.
