# Gemini AI — developer configuration

## Sekret backendu

`GEMINI_ENCRYPTION_KEY` was generated locally in `.env` as 32 random bytes (64 hexadecimal characters). It is an encryption secret, not a Google API key. It is passed only to API/worker; `.env` is ignored by Git.

Keep this value with deployment secret backups. Do not rotate it without planning decryption/re-encryption of every stored key. A missing/changed secret makes the worker refuse saved credentials; the user must save their key again in settings.

## Database migration

Additive Gemini configuration/permission migrations `0017`–`0020` were applied to the local development database. A PostgreSQL archive in `investigation/backups/gemini-migration/postgres-before-0017.dump` was created and verified first; migration history was checked before each step. Two synthetic users tested RLS, queueing, BFF save/delete, and denial of ciphertext access successfully in a rolled-back transaction. Direct PostgREST DML on `gemini_credentials` is revoked; API changes use private SQL functions accessible only to `wardrobe_session`. The historical `0017` draft is archived at [`archive/sql-proposals/gemini-configuration.sql`](archive/sql-proposals/gemini-configuration.sql); deployed migrations and later permission fixes are authoritative.

Only `api`, `worker`, and `web` were built/recreated. Other services, accounts, user data, and volumes were unchanged. Ollama and the outfit generator did not require changes.

## Limitations Gemini

- `GEMINI_RPM_LIMIT=12` is a distributed Redis request-start limiter shared by workers. Google accounts for RPM/TPM/RPD per project/model; check visible quotas in AI Studio. The single 12/min value is a conservative application limit, not a guarantee of Google quota.
- Identical keys share the limit automatically. For different keys in one project, configure the same `GEMINI_SHARED_QUOTA_ID` across all installation instances. Its value is HMAC-derived and is never exposed directly in logs or Redis keys.
- The queue allows at most `GEMINI_MAX_QUEUE` active tasks (default 100), with only one active Gemini task per user. BullMQ FIFO and this cap limit queue monopolization. Statuses are durable in PostgreSQL.
- `GEMINI_TPM_LIMIT` and `GEMINI_RPD_LIMIT` are reserved for future token/day limiting and are not currently enforced. A provider response indicating exhausted daily quota stops retries.
- Every attempt, retry, and model-list page reserves a Redis slot. Up to three attempts are made; 400/401/403, model errors, timeouts, and daily-quota exhaustion are not retried. Timeouts may still consume Google quota.
- Local task timeout: `GEMINI_TASK_TIMEOUT_MS=900000` (15 minutes including queue wait). Individual HTTP requests are limited to 45 seconds.

## Setup and test

1. Open **Settings → Gemini AI** and paste your Google AI Studio key. The key is visible only in the input before saving; the server returns configuration status and the last four characters.
2. Click **Load available models**, wait for completion, and select a model returned for that key. The list includes only models with `generateContent`; the connection test verifies actual account availability.
3. Click **Save model**, then **Check connection**. The test queues a short request without wardrobe/profile data, consumes quota, and displays status. Pending or active tasks can be cancelled.
4. Replace or delete the key from the same section.

Deployed application/worker services are healthy. Credential persistence changes required recreating only API; its health endpoint returns 200, anonymous access returns 401, Gemini UI is in the active web build, and ACL checks confirm no ciphertext reads or direct DML. A real Google connection had not yet been tested because the user had not saved a Gemini key.

Google provides dynamic `models.list` discovery; quotas depend on project, model, and plan, so the application does not hardcode a default model. Sources: [Gemini Models API](https://ai.google.dev/api/models), [Gemini API quotas](https://ai.google.dev/gemini-api/docs/rate-limits).
