# Development operations and verification

[Guide contents](README.md)

## Testing and quality checks

Commands run from the repository root. Versions are pinned in `package.json`, `pnpm-lock.yaml` and workspace package manifests. CI (`.github/workflows/quality.yml`) installs the pinned environment and runs `pnpm check`; it does not provision a real account or run paid AI tests.

| Tool / command                                                   | Purpose and configuration                                                                                        | When to run                                                                     |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm test`                                                      | Vitest; `vitest.config.ts`, root `tests/*.test.ts`, colocated web tests; jsdom/RTL setup in `apps/web/src/test/` | Changed pure rules, components, API orchestration and mocked providers          |
| `pnpm exec vitest run tests/travel-packing-completeness.test.ts` | Example focused regression file                                                                                  | While iterating on that feature                                                 |
| `pnpm test:e2e`                                                  | Playwright; `playwright.config.ts`, `tests/e2e/`                                                                 | Browser workflows after checking each scenario's isolation requirements         |
| `pnpm test:stack`                                                | `tsx tests/stack.ts`; real API/RLS/Storage integration                                                           | Only against an explicitly isolated test installation                           |
| `pnpm typecheck`                                                 | Strict TypeScript across workspace packages; `tsconfig.base.json` and package configs                            | Contract, component and server changes                                          |
| `pnpm lint`                                                      | Typed ESLint against reviewed legacy baseline; `eslint.config.js`, `scripts/lint-baseline.mjs`                   | Code changes; no new baseline violations                                        |
| `pnpm style:fix`                                                 | Prettier and stylistic ESLint autofix across authored files                                                      | An authorized repository-wide style cleanup; use targeted tools for local edits |
| `pnpm style:check`                                               | Formatting and stylistic lint; `.prettierrc.json`, `.prettierignore`, `eslint.style.config.js`                   | Before completing changes                                                       |
| `pnpm deps:check`                                                | dependency-cruiser boundaries/cycles; `.dependency-cruiser.mjs` and known violations                             | Imports, module relocation or feature dependencies                              |
| `pnpm knip:check`                                                | Knip unused code/dependency baseline; `knip.json`, `scripts/knip-baseline.mjs`                                   | Exports, dependencies and entry-point changes                                   |
| `pnpm check:layout`                                              | `scripts/check-src-layout.mjs` protects feature-first source roots                                               | New/moved files                                                                 |
| `pnpm language:check`                                            | Lightweight source/documentation language policy; `scripts/language-check.mjs` and reviewed exceptions           | Source prose and documentation changes                                          |
| `pnpm check:i18n`                                                | `scripts/i18n-check.mjs` checks locale resources                                                                 | Any translation changes                                                         |
| `pnpm build`                                                     | Web production bundle; API/worker/shared type-only build checks                                                  | Before release; not a substitute for runtime tests                              |
| `pnpm check`                                                     | Root quality gate chaining style, language, lint, types, tests, boundaries, layout, i18n, Knip and build         | Every completed milestone                                                       |

Baseline files describe existing debt, not permission to add new violations. Read [quality policy](../CODE_QUALITY.md) before any baseline update. Do not mass-fix architecture/type problems or use unsafe casts to make a formatting task pass.

### How to test a new feature

Test pure schema/interpretation logic with Vitest, especially empty/partial/legacy inputs and boundary quantities. Test UI behavior with RTL: submit validation, disabled/loading states, editable drafts, checkbox/count/progress behavior and errors. API tests should exercise session requirements, invalid input, database failure and safe error mapping. Use two distinct users in isolated SQL/API integration tests for RLS denial, including updates that attempt to transfer ownership.

Use Playwright mocked API routes for safe end-to-end UI workflows and explicitly test English default plus Polish selection. Mock Gemini responses and failure states; do not call paid AI. Validate generated content separately from UI language. Test reload/reopen and persistence using isolated fixtures rather than a real account. Review each test before running: some historical browser/stack scripts create accounts, garments or outfits and are not read-only demos. SQL test files require an explicitly chosen isolated database and are not part of `pnpm test`.

Install Chromium using `pnpm exec playwright install chromium` if needed. `playwright.config.ts` defines the base URL and projects; inspect it before assuming a server is started automatically. Use `pnpm exec playwright test tests/e2e/travel-packing.spec.ts` to select a mocked scenario. Never supply existing-account credentials to data-writing tests.

## Local development and Docker

Use Node 26.13.0 (26 LTS line), pnpm 12.18.0, Docker Engine/Compose on Linux, or the verified OrbStack setup on macOS. CPU model files must be prepared as described in [model setup](../../infra/models/README.md) and [FashionSigLIP](../../infra/models/fashion-siglip/README.md). Git does not include weights. Do not assume the full stack fits in 4 GB RAM.

For a **new installation**, run `node scripts/setup.mjs`, review the generated local `.env`, then `docker compose up -d --build`. Setup will not overwrite an existing `.env`; do not replace secrets on an existing data volume. Compose owns the whole Supabase stack. The `migrate` service exits after success and is not a daemon. Follow the root [getting started](../../README.md#getting-started) section for addresses and Mac xattr prerequisites.

Install dependencies with `pnpm install --frozen-lockfile`. `pnpm dev` starts only Vite on 5173. Its `/api` proxy targets `http://localhost:3000`; it does not start the API/worker. `pnpm --filter @wardrobe/api dev` and `pnpm --filter @wardrobe/worker dev` watch their process entries, but require complete process environment and reachable infrastructure. The root `.env` is primarily Compose input and these commands do not automatically load/translate every Compose variable. Inspect `apps/api/src/app/config.ts`, worker startup validation, and the generated Compose environment. In host mode, container service names such as `db`, `api-gw` and `redis` need deliberately configured reachable addresses. Do not publish privileged services to the LAN to make host development work.

For the simplest consistent development environment, rebuild affected Compose services with the existing full stack. A local-only debugging override may publish API port 3000 on **127.0.0.1** for Vite; do not add a public bind to committed Compose. API origin checks must include the exact development frontend origin. No checked-in dev override or universal host-mode env-loader script is provided.

### Common development commands

| Task                          | Command                                             | Description                                                                           |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Install dependencies          | `pnpm install --frozen-lockfile`                    | Use pinned lockfile                                                                   |
| Generate initial local config | `node scripts/setup.mjs`                            | New installation only; inspect `.env`                                                 |
| Start full stack              | `docker compose up -d --build`                      | Builds services and runs pending migrations; review before an existing-install update |
| Inspect services              | `docker compose ps`                                 | Includes one-shot migrator status                                                     |
| Inspect application logs      | `docker compose logs --tail=100 api worker migrate` | Safe operational diagnosis; do not publish secrets                                    |
| Follow worker logs            | `docker compose logs -f worker`                     | Observe task processing                                                               |
| Stop without deleting data    | `docker compose stop`                               | Retains containers/volumes                                                            |
| Start existing images         | `docker compose up -d`                              | Does not intentionally rebuild images                                                 |
| Start frontend watch          | `pnpm dev`                                          | Requires reachable API on port 3000                                                   |
| Start API watch               | `pnpm --filter @wardrobe/api dev`                   | Requires validated process environment                                                |
| Start worker watch            | `pnpm --filter @wardrobe/worker dev`                | Requires isolated/reachable infrastructure                                            |
| Regenerate Compose            | `node scripts/compose.mjs`                          | After changing generator inputs                                                       |
| Validate Compose              | `docker compose config --quiet`                     | Do not print resolved secrets                                                         |
| Health check                  | `curl --fail http://localhost:8080/api/health`      | Verifies BFF/session database reachability                                            |
| Quality gate                  | `pnpm check`                                        | Full repository verification                                                          |

## Configuration and environment variables

Use [`.env.example`](../../.env.example) as the configuration inventory, not as production credentials. `scripts/setup.mjs` generates random secrets; `scripts/compose.mjs` maps root variables to process variables. Never put server secrets into `VITE_*`, browser storage or public artifacts. The table groups related settings; review upstream Supabase settings in the template before changing them.

| Variable(s)                                                                                             | Purpose / consumer                                     | Required and configuration location                           |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `APP_ORIGIN`, `APP_ADDITIONAL_ORIGINS`                                                                  | BFF exact-origin allowlist, CSRF                       | Main origin required in root `.env`; extra origins optional   |
| `SITE_ADDRESS`, `HTTP_PORT`, `HTTPS_PORT`                                                               | Caddy bind/domain and host ports                       | Root `.env`; match deployment/HTTPS                           |
| `SITE_URL`, `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `ADDITIONAL_REDIRECT_URLS`                       | Auth links and external routing                        | Root `.env`; consistent valid public URLs                     |
| `COOKIE_SECURE`                                                                                         | Secure session cookies                                 | Required BFF setting; true on HTTPS                           |
| `POSTGRES_PASSWORD`, `SESSION_DB_PASSWORD`, `WORKER_DB_PASSWORD`                                        | Database and restricted-role credentials               | Required generated secrets, root `.env`                       |
| `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`         | Supabase authentication/gateway                        | Generated server configuration; never expose privileged keys  |
| `SESSION_ENCRYPTION_KEY`                                                                                | Encrypt session tokens                                 | Required 64-hex server secret; preserve with backups          |
| `REDIS_PASSWORD`                                                                                        | Internal Redis auth                                    | Required generated secret; Redis is not publicly published    |
| `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`                                                              | Studio basic authentication                            | Root `.env`; distinct from application account                |
| `QUEUE_ADMIN_USER_IDS`                                                                                  | Queue admin allowlist                                  | Optional comma-separated Auth UUIDs; empty disables dashboard |
| `ENABLE_EMAIL_AUTOCONFIRM`, `DISABLE_SIGNUP`, `ENABLE_EMAIL_SIGNUP`                                     | GoTrue registration behavior                           | Root `.env`; review production confirmation policy            |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`              | GoTrue email delivery                                  | Required for real delivery; do not log credentials            |
| `GARMENT_ANALYSIS_PROVIDER`                                                                             | Worker classifier selection                            | Defaults to local FashionSigLIP configuration                 |
| `OLLAMA_BASE_URL`, `OLLAMA_VISION_MODEL`                                                                | Optional LAN analysis provider                         | Required only when selected/used                              |
| `GEMINI_ENCRYPTION_KEY`                                                                                 | Encrypt per-user Gemini credentials                    | Required to enable Gemini tasks; API and worker must match    |
| `GEMINI_RPM_LIMIT`, `GEMINI_MAX_QUEUE`, `GEMINI_TASK_TIMEOUT_MS`                                        | Gemini rate/queue/timeout bounds                       | Optional defaults in validated server code; root `.env`       |
| `GEMINI_SHARED_QUOTA_ID`                                                                                | Group credentials sharing upstream quota               | Optional server identifier, not an API key                    |
| `GEMINI_TPM_LIMIT`, `GEMINI_RPD_LIMIT`                                                                  | Reserved accounting settings                           | Optional; do not imply full enforcement                       |
| `DEV_SMTP_*`                                                                                            | Optional development mail relay                        | Local profile only; see auth-email documentation              |
| `SECRET_KEY_BASE`, `REALTIME_DB_ENC_KEY`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY`, `S3_PROTOCOL_ACCESS_*` | Internal Supabase service secrets                      | Generated root `.env`; preserve and protect                   |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SESSION_DATABASE_URL`, `REDIS_URL`, `PORT`                        | API process connection settings                        | Derived by Compose; configure explicitly for host-mode API    |
| `WORKER_DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `REDIS_URL`                         | Worker process connections and internal Storage access | Derived by Compose; server-only                               |
| `DATABASE_URL`                                                                                          | Custom migration process connection                    | Derived for `migrate`; privileged schema execution only       |

For a new variable, add a non-secret template/comment to `.env.example`, validation/defaults in the consuming process, Compose-generator mapping, and setup generation only when a new secret is necessary. Regenerate Compose, run `docker compose config --quiet`, update this table and tests. Do not silently change existing encryption keys or user settings.

## Deployment and updates

Deployment uses the root Compose stack on a self-hosted server; [Proxmox guide](../deployment-proxmox.md) covers that supported host setup. `infra/Dockerfile.node` builds the shared/API/worker sources and copies immutable SQL/model assets. `infra/Dockerfile.web` builds the SPA and Caddy image. There is no implemented automatic application rollback service.

Before updating, record the current commit and image IDs, take a consistent verified backup using [operations](../operations.md), review pending SQL and rehearse on an isolated copy. Keep old compatible image versions available. Then use `docker compose up -d --build`; the migrator must succeed before dependent services start. Inspect `docker compose ps`, migration/API/worker logs and `/api/health`, then validate login, several images, owned/foreign-data access, queues and the changed feature. Health alone does not prove every dependency or recommendation is working.

On failure, stop further changes and inspect which migrations committed. Reverting application images/code does not revert schema. Restart a previous application version only if compatible with the current schema; otherwise deploy a reviewed corrective release or follow the rehearsed recovery procedure. Never erase migration history, replace entire tables, regenerate secrets or delete volumes to make an older image start. PostgreSQL major-version changes require their own upstream upgrade plan.

## Troubleshooting

| Symptom                            | Likely cause / logs                                                                               | Safe diagnosis                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frontend cannot reach API          | Vite proxy points at 3000; API not exposed locally; Caddy routing; API logs                       | Inspect Network status, `docker compose ps`, API health and exact proxy/origin config; do not expose DB/Redis publicly       |
| Login fails or writes return 403   | Auth unavailable, confirmation, expired session, origin/CSRF or missing membership; API/Auth logs | Check URL consistency, cookie secure setting, confirmation/SMTP, allowed origins; never print tokens or regenerate secrets   |
| Database unavailable               | DB readiness, disk space, wrong restricted-role credentials; db/API logs                          | Inspect service health/disk and connection config; preserve volumes and `.env`                                               |
| Schema/table/function missing      | Migrator failed or old image lacks SQL; migrate logs                                              | Read ledger and checksums, inspect pending SQL/image; rehearse correction, no reset                                          |
| Worker leaves tasks queued         | Worker unhealthy, outbox/queue state, missing model/provider; worker logs                         | Compare persisted job state with queue state, health and selected provider; retain IDs and retry only permitted failures     |
| Redis unavailable                  | Internal credentials/network or Redis service unhealthy                                           | Inspect Redis/worker logs and resolved service wiring without printing passwords; do not flush data                          |
| Gemini invalid response or failure | Output contract, timeout, quota, credential/model configuration                                   | Check safe task error codes and worker/provider logs; mock reproduction and validate JSON; no unbounded retries              |
| Missing environment variable       | Startup Zod validation; API/worker logs                                                           | Compare `.env.example`, validated config and generator mapping; set a reviewed value, never arbitrary new encryption keys    |
| `pnpm check` fails                 | First failed style/lint/type/test/boundary/unused-code step                                       | Run that exact subcommand, inspect baseline delta; avoid baseline inflation and unsafe casts                                 |
| Playwright cannot launch           | Browser not installed, wrong executable/dependencies or no app server                             | `pnpm exec playwright install chromium`, inspect config/base URL and process permissions; keep test environment isolated     |
| Images fail with `ENOTSUP`         | Mac Docker file-sharing xattr limitation; Storage logs                                            | Verify OrbStack context and [native Storage guide](../../infra/storage/README.md); copying image bytes alone is insufficient |
| Old UI after deployment            | Cached static shell/PWA update pending                                                            | Use the app's update notification; API/private images must remain NetworkOnly                                                |

For additional operational procedures and explicit recovery limitations, use [operations](../operations.md). Never reset the database as routine troubleshooting.
