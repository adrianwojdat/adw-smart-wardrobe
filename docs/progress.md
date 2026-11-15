# Progress — Phase 1

## 2026-11-12 — English and Polish UI

- Added `i18next` and `react-i18next`; `en` is the explicit default/fallback, `pl` is selectable in Settings, and `smart-wardrobe-language` persists the choice without a page reload or form reset. The active language updates `html lang` and document description.
- Added 3 shared resource pairs (`common`, `navigation`, `validation`) and 11 feature-local pairs (auth, bulk upload, catalog, dashboard, family, garments, image analysis, laundry, outfits, settings, style profile): 878 semantic keys / 1,756 translated values. No API enums or database fields were translated.
- Localized user-facing static copy, status labels, prompts, validation feedback, and accessibility labels across the SPA. Dates, currency, and search normalization follow the active locale. API errors are mapped to local messages by status.
- Added i18n unit tests and a language E2E spec. `scripts/i18n-check.mjs` checks all 14 pairs for missing/extra keys, empty strings, and interpolation parity; `pnpm check:i18n` is in `pnpm check`.
- Verification: `pnpm check` passed (format baseline: 10 pre-existing / 0 new; ESLint: 626 baseline diagnostics / 0 new; typecheck all 4 workspaces; 156/156 tests; dependency cruiser; source layout; Knip: 32 baseline / 0 new; all builds). Web build reports pre-existing daisyUI CSS and large-chunk warnings. The expanded translation check passed all 14 pairs.
- Playwright desktop: fresh-visit English default passed (1); Settings switching/persistence skipped (1) because `E2E_LANGUAGE_EMAIL`/`E2E_LANGUAGE_PASSWORD` are not configured for an isolated development account. The selector and immediate language/persistence behavior are covered by unit tests. The first browser launch was sandbox-blocked; the approved local rerun passed.
- Limitation: Gemini-generated prose, text transcribed from labels, and arbitrary user-entered values remain source content. Prompts/API contracts were not changed, so their language is not guaranteed by this static UI translation task.

## 2026-11-12 — formatting and garment form

Added import grouping via `eslint-plugin-simple-import-sort` and the native ESLint logical-spacing rule without a competing stylistic plugin. Prettier still controls formatting. A global trial found 603 existing violations, so rules were enabled for the reviewed extracted garment form and planned for gradual module rollout; the baseline was unchanged. Import, spacing, JSX, and feature-first guidelines were added to AGENTS.md and CODE_QUALITY.md.

Split the garment form into page/composition, basic fields, classification, status, photos, persistence hook, and file validator. Preserved save/upload order, ID persistence before image upload for duplicate-safe retries, removal of successfully uploaded files only, cache invalidation, and navigation. Removed garment-detail exports from the form module. Added image type/size/count validation tests. Labels/layout were unchanged.

Full `pnpm check` passed: Prettier baseline (10 existing/0 new), ESLint baseline (627/0 new/47 resolved), all-package typechecks, 154 tests, dependency-cruiser (183 modules/588 dependencies, no new violations), source layout, Knip (32 existing/0 new), and all workspace builds. Web retained the 804 kB bundle warning. Only web was built/recreated, returning HTTP 200; other containers remained healthy. E2E was not run because scenarios write data and a separate isolated environment was not confirmed.

Updated: 2026-11-08. Phase 1 working MVP implemented and verified locally.

## 2026-11-12 — daisyUI: theme and basic controls

Added daisyUI 5.7.50 compatible with Tailwind CSS and `@tailwindcss/vite` 4.3.5, plus a light `smartwardrobe` theme using the existing cream/forest-green palette. Shared `Button` uses daisyUI classes with small Tailwind additions preserving sizes/variants. Inputs, selects, textareas, checkboxes, and radios gained daisyUI classes; base fields moved to the Tailwind layer, and the application border token was renamed to avoid collision. Form/outfit cards, status badges, and errors use standard classes. Autocomplete, menus, dialogs, and navigation retain existing logic.

Added `docs/ui-guidelines.md` and its AGENTS.md link. Playwright saves 14 desktop/mobile screenshots in ignored `investigation/tmp/ui-daisyui/` and checks horizontal overflow. Menus, garment details, Gemini settings, and outfit generation were visually reviewed. No clean pre-change screenshots were available, so no pixel comparison is claimed. Repository ESLint, targeted Prettier, four-package typecheck, 144/144 Vitest, web build, and 6/6 desktop/mobile Playwright passed. Existing main bundle warning: approximately 792 kB.

## Implemented

- pnpm monorepo, strict TypeScript, React SPA, Fastify BFF, separate BullMQ worker.
- Pinned official self-hosted Supabase 0.8.4 (commit recorded in infra/supabase/provenance.json), all baseline services retained, one root Compose.
- Random first-run secrets, private internal network, Caddy front door, persistent volumes, healthchecks.
- User-scoped Supabase requests; encrypted server-side sessions and opaque HttpOnly cookies; CSRF, rate limits, validation.
- SQL migrations, RLS, private image Storage, wardrobe/member/garment/image/job/outfit/history models.
- Polish landing/auth/dashboard/catalog/detail/editor/family/laundry/settings/outfit screens.
- Private/family wardrobes, invitation links with email binding, owner/editor/viewer roles.
- Multi-image upload and labels, image decoding and metadata stripping, worker image processing.
- Durable PostgreSQL job outbox, retries/backoff, progress, restart recovery and manual retry.
- Deterministic recommendations using owned garment IDs, saved outfits and wear history foundations.
- PWA manifest, icons, static-only precache, NetworkOnly private API/images.

## Verification — 2026-11-08

- `docker compose up -d --build` succeeded. All 15 long-running services are healthy; migrations completed successfully.
- `docker compose config --quiet` passed.
- Strict typecheck, ESLint and production builds passed with TypeScript 6.0.3.
- 14 Vitest domain/API injection tests passed.
- Real-stack integration passed: registration/logout/login, wardrobe creation, image upload/download, catalog/details, cross-tenant SQL RLS and Storage isolation, CSRF, invitations, viewer/editor roles, revocation, BullMQ processing, saved outfit IDs and wear history.
- Restart integration passed: opaque session, garment metadata and private image remained readable after API/worker/PostgreSQL/Storage/Redis restart; worker completed its persisted job. Added safe pool error handlers for database disconnections.
- 4 Playwright tests passed on Chromium desktop and Pixel 7 emulation, including the complete register → login → wardrobe → upload → save → catalog → details flow. No horizontal overflow on the tested detail layouts.
- Local idle Docker memory after testing: about 1.9 GiB summed container usage, within a 7.65 GiB Docker VM. API about 96 MiB, worker 80 MiB. This is not a peak-load or Proxmox N100 benchmark; 8 GB deployment recommendation remains.
- Frontend build is about 800 KiB uncompressed. Vite warns about the main JS chunk exceeding 500 KiB; route-level splitting is a future performance improvement.

## Build/runtime failures fixed

- Added explicit `workbox-window` required by the PWA virtual import.
- Selected TypeScript 6.0.3 to satisfy typescript-eslint's supported peer range.
- Added explicit ioredis client for BullMQ 6; worker now starts and completes real jobs.
- Retained the official Edge Runtime memory-pressure module and allowed outbound dependency downloads.
- Added a migration allowing a wardrobe owner to read INSERT RETURNING before the membership AFTER trigger runs.
- Fixed sidebar scrolling and short-screen layout so logout remains reachable.
- Added a loopback health endpoint for Caddy that also works with HTTPS domain configuration.

## Scope boundaries

Phase 1 does not claim AI analysis, weather service integration, ComfyUI, or generated outfit visualizations. Provider contracts are prepared; no AI actions are faked. SMTP delivery requires actual operator configuration and has not been verified. Invite links are copied/shared manually. Garments with existing images cannot yet move between wardrobes.

## Next

Configure and verify real SMTP and HTTPS on the deployment host; perform a backup restore drill. Next product milestone: Ollama photo/label analysis with validated, editable suggestions. Additional verification still needed: real mobile installation/offline/logout behavior, forced token refresh, password recovery delivery, manual failed-job retry and queue-loss recovery.

## Local database access

PostgreSQL is now published on `127.0.0.1:54322` for Postico on the Docker host. The generator preserves this loopback-only binding. Use database/user `postgres` and `POSTGRES_PASSWORD` from the local `.env`.

Verified an authenticated SQL query from the Mac host to `127.0.0.1:54322` (database/user `postgres`). Docker Desktop required a dedicated bridge network in addition to the internal application network for publishing this port.

## ONNX alpha/crop regression fixed — 2026-11-08

Changed `apps/worker/src/pipeline.ts`, added `apps/worker/src/mask.ts` and `tests/mask.test.ts`. Model and Ollama configuration unchanged. Root causes reproduced with Sharp: resizing raw grayscale without an explicit grayscale output produced 3 channels, but bounding-box code indexed it as 1; `removeAlpha()` also removed the joined alpha from PNG output. Cropping and rotation in one lazy Sharp pipeline additionally allowed rotation before extraction. The correction explicitly resizes to one channel, builds RGBA preserving source RGB, and materializes the crop before rotating. Pipeline version is v2; LLM angles are never applied automatically.

Two focused Vitest regressions passed; worker typecheck and scoped ESLint passed. The actual existing blazer was run through the corrected modules in `/tmp` of the existing Linux worker container, without migrations, database writes, rebuilding images or replacing the running worker's application files. 0°: 1.812 s, RGBA 1385×1623. 90° clockwise: 2.838 s, RGBA 1623×1385. Both: 694,920 fully transparent pixels, 1,315,381 fully opaque pixels. Catalog output is 1200×1500. Pixel comparison of 1,425,094 foreground pixels against the source found zero RGB differences; the 90° output exactly equals a pixel rotation of the 0° cutout. Original SHA-256 was preserved; the private fingerprint is retained only in local investigation artifacts.

Visual inspection: floor removed, no black band, buttons/pockets/texture preserved; faint soft edge/halo remains in places, appropriate as an MVP cutout rather than a professional hand-retouched mask. No ONNX inference error; a warning about missing CA certificates for telemetry was emitted. Private artifacts and reports are in `/private/tmp/wardrobe-onnx-fixed/`, not Git. The source fix is tested but not yet rebuilt into the production worker image.

## Optional and automatic names — prepared, waiting for migration approval

Step 1 of the names/bulk/rotation request is implemented in source only. New garments accept a missing name; migration `0006_automatic_names.sql` assigns `Ubranie <full garment UUID>` immediately and adds `name_source` (`temporary`, `ai`, `manual`). Existing names are untouched and classified as manual. A security-definer trigger serializes allocation per owner using a transaction advisory lock, checks every wardrobe owned by that user, suffixes automatic collisions, and rejects new manual duplicates. Existing duplicate names are grandfathered without renaming user data. Worker update permissions only allow replacement of still-temporary names; manual edits and explicit acceptance of a name mark it manual. AI-unavailable/failed jobs leave the temporary name unchanged.

Added a small shared locale configuration, controlled Polish noun/color agreement, translation of enum labels and known styles, and a language-review fallback for unsupported/English generated prose. Brands and verbatim OCR remain unchanged. All vision prompts receive the active locale instruction and requests use keep_alive=-1; no model or Ollama environment changes were made. Existing AI suggestions are normalized for display without rewriting stored user data.

Verification: 17 focused naming/domain/provider tests passed, all workspace typechecks passed, ESLint passed. Database concurrency/RLS integration and real UI upload/AI rename tests remain pending: migration has NOT been applied, no services rebuilt or recreated, and no database records changed for this step. Bulk upload and rotation preview/save are deliberately not started until step 1 can be verified after approval, following the requested sequence.

## Local NodemailerApp delivery

Added an opt-in `dev-mail` Compose profile with a private Node/Nodemailer SMTP forwarder. GoTrue connects without authentication over the internal network; the relay uses authenticated LOGIN to NodemailerApp on the Mac. No SMTP ports are published. Secrets stay in ignored .env; production profile is disabled by default. This is only for a trusted local development machine. Existing accounts/passwords are preserved. Development registration confirmation is enabled via local ENABLE_EMAIL_AUTOCONFIRM=false.

## Branded Polish authentication emails — 2026-11-08

Added six versioned Polish templates under `infra/auth-email` for confirmation, recovery, invitations, email changes, magic links and reauthentication codes. Shared generator reuses the frontend cream/forest palette, restrained branding, serif headings and accessible dark-green buttons. GoTrue variables remain intact. Subjects and body copy are locale-specific JSON; no full i18n system added.

Rebuilt and recreated only Auth, preserving its pinned GoTrue version. A loopback-only static server provides read-only template files over HTTP. SMTP, relay, other services, users, passwords, database and volumes were not changed. Actual confirmation and password-reset messages arrived in NodemailerApp with the requested Polish subjects. Received HTML passed 600px/375px rendering checks and visual inspection; local token-bearing verification URLs and recovery redirect were validated without following or consuming them. Screenshots in `/tmp/wardrobe-auth-email-previews` have tokens redacted. Other four delivery flows remain untested. Plain-text assets are generated, but GoTrue v2.197.0 only sends HTML, so multipart fallback is not claimed.

## Bulk upload — implemented, awaiting deployment approval

Added `/garments/import` through “Add multiple garments” on catalog/dashboard. Up to 200 JPEG/PNG/WebP photos (10 MB each), file picker and drag/drop; one unnamed garment per image uses the existing temporary-name trigger. Three bounded uploads with 750 ms start spacing keep load below the existing API limit. Background processing and AI reuse existing database outbox/BullMQ paths; existing worker concurrency remains one for GPU requests. Batch state survives SPA navigation, but not page reload/closing; UI explains this. Uploaded records/jobs remain durable.

Each file retains garment/image UUIDs across retries. The authenticated creation endpoint reuses an existing same-owner garment on conflict without editing it. Image retries reuse the existing image or deterministic private Storage path with upsert disabled, including recovery after Storage succeeded but image insertion failed. No schema migration required; read-only verification confirms 0006 is already installed. Progress shows uploads, processing, completed and failures; per-file upload retries are available. Processing failures can be retried through the existing garment detail mechanism. Invalid files remain individually identified, without canceling valid files.

Verification: queue/validation tests include 200 simulated files with maximum concurrency three; mocked Fastify/Supabase tests cover duplicate create, different-owner rejection, duplicate image retry and orphan-original recovery. Playwright with mocked API verifies 201-file rejection, four independent garments, one failed upload and retry without duplicates, navigation during upload and mobile layout without horizontal overflow. No real database writes, AI calls or original-photo changes were made for these tests. Workspace typechecks, scoped ESLint and web production build passed (existing large-bundle warning remains). No Docker rebuild/deployment performed; end-to-end private Storage and real worker verification remains pending deployment approval.

Deployment scope: API + web, and worker to activate previously prepared automatic naming. Read-only inspection confirmed the running worker already serializes AI requests, but does not yet contain the name_source='ai' update. Rebuild/recreate these three services only after user approval; Auth/SMTP and all data services must remain untouched. Final focused verification: 21 tests passed across five files.

## Bulk upload deployed — 2026-11-08

User approved deployment. Rebuilt and recreated only api, web and worker with --no-deps --no-build; before/after container IDs confirm every other service remained untouched. All three report healthy, and startup logs have no error/fatal entries. API health and deployed OpenAPI confirm client-supplied garment IDs and upload_id retry parameters. Running worker contains automatic naming, serialized AI requests and u2netp-catalog-v2. Effective SMTP/confirmation and Ollama settings were verified unchanged; no migrations, volumes or original photos were modified.

Playwright ran against the deployed frontend at localhost:8080 with intercepted API requests: 201-file rejection, four separate garments, one upload failure and safe retry, navigation preserving the batch and mobile width checks passed. These browser records were mock-only. Real authenticated bulk upload through private Storage and live processing queues was not exercised; no test user data or expensive Ollama calls were created. Use “Add multiple garments” in catalog or /garments/import after refreshing the SPA/PWA.

## Bulk upload permission failure — fix prepared

Real import exposed a gap missed by mocked Supabase tests: the initial schema grants INSERT per column, and neither garments.id nor garment_images.id is included. Bulk upload supplies these UUIDs for idempotency, so authenticated inserts are denied before any photo upload. Prepared additive 0007_bulk_upload_ids.sql granting INSERT on those two UUID columns only; existing RLS and ownership/membership checks remain unchanged. Requires user approval before applying. No existing records or photos need changing. The open import tab retains UUIDs/files for safe retry after the grant. Previous mock-only verification was insufficient for this database permission boundary.

## Bulk upload permission correction applied — 2026-11-08

User explicitly approved migration 0007. Applied only its two INSERT(id) grants and PostgREST schema notification in a transaction under the migration advisory lock, recording the SHA-256 checksum in private.schema_migrations. No services rebuilt or restarted. Added tests/bulk-permissions.sql and ran against the actual installed database with role authenticated: explicit garment UUID insertion and temporary naming passed; explicit image UUID insertion queued the expected two jobs; an unrelated identity was denied by RLS. The entire test transaction rolled back, leaving no test garments/images/jobs. Existing originals and records were untouched. The open browser batch can retry immediately without refreshing or losing file/UUID state.

## Ollama model selection — 2026-11-08

At the user's request, changed only the local ignored .env OLLAMA_VISION_MODEL to qwen3-vl:8b and recreated worker without dependencies or rebuilding. LAN URL and provider keep_alive=-1 remain unchanged. No other services, models, database records or volumes were modified. Model selection alone does not establish that the previously failing analysis/JSON validation is resolved.

## Bull Board — prepared, awaiting API deployment approval

Added a read-only Bull Board at /api/admin/queues/ inside existing Fastify, using pinned @bull-board/api and @bull-board/fastify 9.12.0 with existing BullMQ/ioredis versions. It exposes wardrobe and wardrobe-ai. Only authenticated users explicitly allowlisted by UUID in QUEUE_ADMIN_USER_IDS can access HTML, static assets or dashboard API. Local allowlist includes the existing owner's account; no database roles/users changed. Empty allowlist disables the panel. Redis URL is provided only to the BFF over the internal network. No public Redis port or extra service. Mutating dashboard requests are denied server-side; retry remains in garment details to preserve PostgreSQL job state. Existing Redis retention is unchanged, so this is not a durable job-history screen. See docs/queue-board.md.

Verified 11 tests, including real Bull Board HTML/static rendering, anonymous and ordinary-user rejection, read-only enforcement and existing API security tests. API typecheck passed. No migrations, queue mutations, worker changes or container restarts performed for this feature yet. Only API requires rebuild/recreate after approval; live Redis/browser verification remains pending deployment.

## Bull Board deployed — 2026-11-09

After explicit user approval, built and recreated API only with --no-deps --no-build. Live read-only probe of the installed dashboard against the real Redis returned HTML 200 and queue API 200, both wardrobe and wardrobe-ai marked readOnlyMode=true. At verification, wardrobe was empty and wardrobe-ai had one active and 88 waiting jobs. Probe used a separate in-process Fastify instance, no public listener, no queue mutations or login bypass in the running application. The actual deployed routes through the existing web reverse proxy returned 401 for anonymous HTML and queue API. API health returned 200. Local administrator allowlist is configured. No migrations, worker/SMTP changes or job retries were performed. Full authenticated browser appearance remains unverified; actual HTML/assets were covered by prior adapter tests.

## Seven-day BullMQ retention — prepared, awaiting worker deployment approval

Both queues now use removeOnComplete/removeOnFail {age:604800,count:1000}: retain up to seven days, at most 1000 per terminal state per queue. Count is a cap, not a minimum; sixty recent jobs remain. Existing queued jobs keep their original options, and deleted history cannot be recovered. Added dispatchJob reconciliation so retained completed/failed Redis IDs cannot block PostgreSQL-authorized manual retry or delayed requeue after AI unavailability. Terminal history is preserved unless the durable DB explicitly queues that same job again. No database/Redis mutations or deployment performed for this step.

## 2026-11-09 — development account reset and CPU FashionSigLIP

At the owner’s explicit request, without a backup, deleted 92 garments, 92 image rows, 195 related job rows, 2 outfits, and 383 private Storage objects. Removed 91 BullMQ entries only by IDs linked to those garments. Fingerprints confirmed preservation of Auth account, profile, sessions, wardrobes, memberships, settings, and other users’ data. Schema/volumes were unchanged; existing investigation files were retained.

Default garment analysis provider: local FashionSigLIP (official quantized ONNX encoder, pinned SHA/revision, two CPU threads, queue concurrency 1). Existing upload/outbox automatically invokes it. Ollama remains optional for label OCR; its models/address are unchanged. The classifier proposes category, color, pattern, and a Polish name without guessing material, size, thickness, or warmth. Cosine scores are not confidence percentages. Manual names stay protected. Without manual rotation, four orientations are compared only for classification; images are not auto-rotated. ONNX background processing is preserved.

UI shows FashionSigLIP, duration, pattern, and top-five categories; metadata needs approval. Missing suggestions do not receive form defaults. Analysis retry depends on the existing RPC being available; migration 0008 was still not applied in this task.

Verification: 14 cosine/Polish classification, name, mask, and Ollama-provider tests; changed-file lint; real CPU-container ONNX inference on a preserved blazer copy produced a navy blazer name in 6.076 s at 446 MiB RSS. Original unchanged. This is neither an N100/N150 benchmark nor a whole-wardrobe assessment. Gitignored weights are 90 MiB; download instructions: infra/models/fashion-siglip/README.md. investigation is excluded from build context.

Deployed only worker, API, and web (`up --no-deps --no-build`), without migrations. Effective provider: fashion-siglip. Worker/API return HTTP 200; Ollama models/address preserved. Authorization and new-image uploads still require final user verification on the existing account; no artificial garments were added after clearing the wardrobe.

## 2026-11-09 — widoczny wynik pustych rekomendacji

“Suggest outfits” worked but an empty response left the initial screen unchanged. Read-only inspection found 89 clean, non-archived garments categorized as tops, with no bottoms/dresses. User categories/data were not changed. Empty results now explain outfit/category requirements and the need to approve FashionSigLIP suggestions, linking to the wardrobe. Result state is tied to wardrobe, occasion, and temperature.

Deployed the empty-recommendation message only in web. Typecheck, lint, build, and Playwright (one request, empty result, message and wardrobe link) passed. New request: auto-apply first classification, but require approval for subsequent analyses. Worker currently has UPDATE only on name/name_source; automatic category persistence needs additive permission/RLS changes. Review proposal: docs/pending-initial-classification.sql, NOT applied. Implementation must check revision, lock the row, require no previous analysis, and protect manual edits; a policy proposal alone is not a complete solution. Existing 89 garment categories remained unchanged.

## 2026-11-09 — initial classification and local Studio

Approved/applied only additive migrations 0009/0010 (0008 still skipped). A narrow worker function saves category/subcategory/colors and temporary name on first analysis of an untouched garment. It checks membership, job type/status, revision, no prior analysis, and unchanged updated_at, with a row lock. Manual names/nonempty metadata are preserved. Only function EXECUTE was granted, not general metadata UPDATE. Reanalysis and edited garments remain suggestions. No backfill touched the existing 89 garments. Rolled-back SQL tests covered initial save, repeat-save denial, and manual-edit protection; a real wardrobe_worker connection confirmed function access and rejection of a nonexistent job. Typecheck/lint/build passed; worker/web deployed.

Studio was already healthy in Compose without a host port. Official Envoy gateway was exposed at 127.0.0.1:8000 with existing Basic Auth (DASHBOARD_USERNAME/PASSWORD) through a dedicated studio-access network; default remains internal. Studio’s unless-stopped restart policy and lack of a profile ensure automatic startup. SMTP, Auth keys, data, and service versions were unchanged.

## 2026-11-09 — wardrobe deletion in settings (ready for deployment approval)

Added wardrobe listing in Settings, an owner-only Delete button, Cancel, and explicit confirmation that all garments/photos/outfits/history, including family members’ items, will be lost. Account remains. API uses user session and owner RPC, without service-role in BFF. Additive migration 0011 creates a durable private cleanup registry atomically with wardrobe deletion. After 30 seconds worker deletes only related job IDs and files under the exact deleted wardrobe UUID prefix, retaining cleanup state across retries/restarts until success. Global queues are not emptied. Variant persistence locks the durable job so active processing cannot recreate files after deletion. Cleanup retries do not block other jobs.

Verification: API/worker/web typechecks, changed-file lint, five cleanup/cancellation tests. Rolled-back SQL integration covered foreign-user deletion denial, garment/job cascade, account preservation, and durable cleanup record. No real wardrobe was deleted. Migration 0011 was NOT applied; services were NOT rebuilt/deployed. Migration and API/worker/web deployment approval remained pending; real-browser confirmation needed verification after deployment.

Deployment approved/completed: migration 0011 recorded its checksum; only API/worker/web rebuilt/recreated. No real wardrobes deleted. Deployed-UI Playwright with API mocks confirmed owner-only button, garment warning, Cancel without DELETE, one DELETE after confirmation, and refreshed listing. Real worker confirmed SELECT FOR UPDATE on cleanup registry and health HTTP 200; API healthy. Existing Fastify logging-option deprecation is nonblocking.

## 2026-11-09 — outfit diversity

Generator randomizes possible combinations, then chooses up to six outfits prioritizing least-used garments. With at least six matching tops/bottoms, both are distinct across outfits; shortages balance reuse without duplicate full bases. Footwear/outerwear are randomized and rotated too. Cleanliness, archive, occasion, and temperature filters remain; no new AI calls/data changes. Ten domain tests cover six unique tops/bottoms, different seeds, balanced use of two tops, and a single available combination. API typecheck/lint passed. Logic runs in BFF, so only API deployment is needed.

Deployed only API (`--no-deps --no-build`), without migrations/data changes. Running-image test on synthetic in-memory data returned six outfits with six distinct tops and bottoms; API health 200.

## 2026-11-09 — bulk wardrobe reanalysis (awaiting deployment)

Added “Retry AI analysis for all garments” in owned wardrobe settings, submission state, and new/pending/no-image counts. BFF uses the user session and public.reanalyze_wardrobe RPC, not admin credentials. Additive migration 0012 checks ownership, locks wardrobe/selected images, chooses one oldest garment image per garment, and preserves original/rotation/revision. It submits only analyze_garment to existing outbox, skipping queued/processing jobs for the same revision. ONNX background removal and label OCR do not repeat. Worker already passes saved rotation to FashionSigLIP with concurrency 1 and needs no changes. Existing garment reanalysis remains suggestions for approval.

Fully rolled-back synthetic-wardrobe SQL test covered foreign-user denial, one image despite multiple photos, no duplicates on a second call, no-image count, and preservation of 90° rotation, manual name/category. API/web typechecks and lint passed. Migration 0012 NOT applied; no real wardrobe jobs queued. Pending approval: apply 0012 and build/deploy only API/web. Browser button interactions remained to verify after deployment.

0012 deployment approved/completed: applied checksum-recorded migration and recreated only API/web (`--no-deps --no-build`); worker/Supabase not restarted. Deployed-UI Playwright with API mocks passed: correct wardrobe POST, button disabled during submission, queued/pending/missing-image counts. API health 200. No real analysis was submitted; the user starts it using the settings button.

## 2026-11-09 — durable analysis activity in UI

Added authenticated GET /api/analysis/activity using the user token/RLS to read all queued/processing analyses with keyset pagination instead of a 20-row history limit, aggregated by image/wardrobe. Frontend polls every three seconds. Settings spinner/remaining-count button stay disabled until activity ends, including after refresh. Read errors keep resubmission disabled and display an error. After submission, refetch occurs before releasing the request lock. Image details show a spinner/status; retry is disabled by durable activity too. Queued/processing image jobs also show spinners. Job history polls continuously to find work submitted elsewhere. No data/model/migration/worker changes. API/web typecheck and lint passed.

Deployed only API/web, without migrations or worker restart. Deployed-UI Playwright with API mocks verified spinner/locking during submission and active jobs, persistence after reload, and unlocking when activity ends, for both wardrobe settings and image details. API health 200, anonymous activity read 401. No real analyses submitted.

## 2026-11-09 — iPhone login over LAN

Diagnosis: mutations from http://192.168.0.217:8080 were rejected because Origin was compared only with APP_ORIGIN=http://localhost:8080. COOKIE_SECURE was already false for local HTTP. Added explicit APP_ADDITIONAL_ORIGINS (CSV), validated as exact HTTP(S) origins without paths, passwords, or wildcards. Local .env gained only the laptop origin; localhost remained. Host headers are not trusted and CSRF is not disabled. No SMTP, GoTrue, key, port, or user-data changes.

API typecheck, lint, and four tests passed: localhost/LAN plus valid CSRF reach credential validation without calling Auth; foreign origins/LAN without CSRF still return 403; invalid configuration rejected. No real-account/password test was run on a physical iPhone.

Deployed only API, healthy. Real localhost:8080 and 192.168.0.217:8080 HTTP checks: allowed Origin + CSRF reaches empty-form validation (400); missing CSRF/foreign Origin blocked (403). No account credentials sent or passwords changed. User should retry sign-in on the physical iPhone.

## 2026-11-09 — Git, Storage, and metadata cleanup

- Initially 65 tests/lint passed. Existing work was split into commits for data protection, infrastructure, schemas/rules, historical migrations, CPU/ONNX/FashionSigLIP, worker, BFF, frontend, and isolated tests. No reset, clean, amend, rebase, or push. Staged diffs were reviewed/scanned against local .env secret values. investigation/data, backups, and weights are ignored by Git/tools; no private photos/data were tracked, only the public .env.example.
- Storage backup: investigation/backups/storage-migration/2026-11-09T20-42-51.893Z; 548 files, 956513122 bytes. SHA256 manifest matched after test extraction; pg_restore read the full postgres.dump listing and decoded archive. Private configuration copy retained with mode 0600. PostgreSQL was not restored on a separate instance. Execution/rollback plan: investigation/reports/storage-migration/plan.md. Storage migration AWAITED APPROVAL; named volume/mounts unchanged.
- Warmth: shared 1–5 rules, vision values replaced by category rules, accessories thermally ignored. Form default updates on category/subcategory changes; manual correction takes priority in the current edit and is saved. Reopening preserves it; another category change recalculates the default. Added a manual-value marker without a second warmth scale. Existing garments were not bulk-updated.
- Profile AI option: disabled by default, per-user, durable, and does not submit jobs. Enabling it permits supported metadata overwrites on future analyses, including manual fields, while protecting manual names, notes, material/size, images, ownership, and relationships. Added stored pattern. Empty/null/unknown values and invalid enums are skipped. SQL locks the row and checks owner/requester/membership/revision/preference plus the exact pre-inference timestamp. Edits during analysis reject automatic persistence. Also fixed PATCH inserting empty defaults when editing one field.
- Applied only new additive migrations 0013/0014. Before/after fingerprints confirmed unchanged garment/profile metadata, images, Storage counts, and account passwords. Historical 0008 remains unapplied; the full migrator and cancellation-control changes were not run.
- Belts: optionally select only an available belt from the same wardrobe for compatible trousers/chinos/jeans. Consider color/style and prefer justified footwear coordination. Exclude tracksuits, leggings, joggers, skirts, and elastic-waist trousers. Belts do not replace outfit bases, invent accessories, or contribute warmth.
- Verification: 97 unit/API tests, lint, and all-package typechecks passed. Fully rolled-back two-user SQL/RLS covered uploads/permissions, names, deletion, bulk analysis, warmth, preferences, AI writes/conflicts. Mock-browser tests covered warmth defaults/manual correction/reopening, persistent checkbox, user isolation, error rollback, and no bulk auto-queueing. Initial tests found outdated polo warmth expectations and incorrect fixture selectors/names; fixed them and retained logs in investigation. No Ollama/GPU requests or new models.

## 2026-11-10 — resume after shutdown

Checked state without rerunning migrations/builds. Docker Desktop needed starting; existing services returned healthy. Confirmed 92 garments, 92 image rows, 548 Storage objects, and 0013/0014 with matching repository checksums. All three application containers used older images; only their deployment from previously built images was completed (`--no-deps --no-build --wait`). Supabase/mounts were not recreated or changed.

New API/worker/web healthy. Previously missing deployed-UI mock tests passed: warmth form/manual correction, category change after reopening, checkbox initially off, reload persistence, user isolation, error rollback, and no bulk analysis. Read one authorized image’s original/cutout/catalog/thumbnail through internal Storage API; all SHA256 values matched backup. No object writes/deletes. Earlier 97-test/lint/typecheck/build results were retained without unnecessary reruns. Real user-password sign-in and a full isolated PostgreSQL restore remain unverified.

Storage still uses `smart-wardrobe_storage-data`; ./data/storage does not exist. Backup/plan remain in ignored investigation. Moving into the project directory still requires approval. Historical 0008 and proposed path restrictions were not applied. No push, model changes, new experiments, or mass analysis.

Additional post-power-failure verification: read-only comparison of the entire old Storage volume tree with backup manifest confirmed 548/548 files with no missing/extra files or SHA256 changes. API health 200; anonymous account/preferences endpoints 401; empty form with valid Origin/CSRF reaches validation (400) without a password. API/worker/shared rules in containers match current repository files. Only api/web/worker containers were recreated.

## 2026-11-10 — approved Storage migration: macOS blocker and safe rollback

- With API/worker/Storage/imgproxy stopped, created fresh file/full-PostgreSQL backups: investigation/backups/storage-migration/2026-11-10T16-44-39.796Z. Stable source: 548 files / 956513122 bytes; image archive SHA256 verified and pg_restore read listing/full dump. Earlier backup retained.
- Created ./data/storage and copied the full tree. Checksums, sizes, UID/GID, and modes matched. Rewired only storage/imgproxy; both healthy.
- Real Storage API returned 500 ENOTSUP: fs-xattr does not support extended attributes on the current macOS/Docker Desktop bind mount. Installed backend v1.89.12 unconditionally reads/writes Linux user.supabase.content-type/cache-control attributes; no supported disable switch was found. Healthchecks alone miss this incompatibility. Image source, service versions, and global Docker Desktop settings were unchanged.
- Restored both exact previous named-volume mounts, recreated only storage/imgproxy, and started API/worker. All services healthy. Original/cutout/catalog/thumbnail reads worked again with SHA256 matching fresh backup. Account/password/profile/session/garment/image/job/wardrobe/relationship metadata comparison found no changes; 548 objects and nine accounts remained. The attempt stopped before creating a test account, wardrobe, or file.
- Added extended-attributes.json to the fresh backup: 1096 attributes for 548 files, required to restore the file backend on a supported filesystem. Previous SHA/mode/UID/GID checks omitted xattrs; image tar plus database alone was therefore not a complete metadata backup. No full separate-instance PostgreSQL restore was claimed.
- State: migration BLOCKED by filesystem incompatibility; rollback completed. Old volume/all backups retained. ./data/storage is inactive; new uploads still use the named volume. data/investigation are ignored. No chore(storage): use project-local storage directory commit was created because that mount was not deployed successfully. Application configuration remains unchanged; only the documentation report enters the repository.

## 2026-11-10 — real images in the project directory: migration completed

- At the user’s renewed request, prepared a narrow project adaptation of pinned Supabase Storage v1.89.12, using separate JSON files instead of xattrs. This is a project adaptation, not an upstream feature. Image pinned by digest; patch verifies the backend’s full SHA256 and modification count. No S3/cloud services added. API, RLS, database, and original image formats preserved.
- Active bind mount: `./data/storage:/var/lib/storage`; additional required metadata: `./data/storage-metadata:/var/lib/storage-metadata`. Imgproxy reads the same image directory read-only. Files remain real JPEG/PNG/WebP with unchanged bytes. Supabase version directories/names remain, including extensionless UUIDs.
- Fresh pre-switch backup: `investigation/backups/storage-migration/2026-11-10T17-18-05.465Z/`, containing full PostgreSQL dump, 548-photo archive, SHA256 manifests, 1096 xattrs, and private configuration. Source stable; pg_restore read the dump, without a separate full-instance restore. Old named volume, earlier backups, and former inactive copy (moved to `data/storage-before-sidecars-2026-11-10T17-20-31.242Z/`) retained.
- Isolated real macOS bind-mount tests covered upload, Content-Type/Cache-Control/Content-Encoding, range, ETag/304, copy/delete, multipart complete/abort, and new-container reads. Compiled backend read all 548 existing images with matching SHA256/types. Adapter regressions 5/5; full tests 102/102, lint, all-package typechecks passed. Only Storage image build and Compose validation were performed; React/API/worker unchanged.
- After switching, real Storage API read four existing image variants. An isolated temporary account uploaded/downloaded with SHA256 checks and deleted only its test file; foreign/anonymous access denied. Fixture account/wardrobe removed. Existing account/password/profile/session/wardrobe/garment/image/job data matched backup. Still 548 objects, all original SHA256 values matching, with 548 sidecars.
- Recreated only Storage/imgproxy; API/worker stopped during copying and restarted. Compose startup unexpectedly also started the existing migrator dependency; history confirmed no new migrations, including no 0008. Helper was corrected to start the two existing containers directly. All 16 services healthy, `/api/health` 200, no new Storage errors. Physical browser/user password was not reverified.
- Back up both active directories together with PostgreSQL. Adapter assumes one Storage instance; upstream upgrades need review/tests. Image and sidecar writes are not one filesystem transaction. After new uploads, rollback requires transferring current files/metadata, not simply returning to the old volume. Data remains ignored by Git.

## 2026-11-10 — OrbStack and standard Supabase Storage with native xattrs

- With explicit user permission, installed OrbStack 2.2.5 for Intel Mac; `orbstack` context is active. Docker Desktop was neither removed nor disabled; two other-project containers still run without moving their data. Old Smart Wardrobe containers are stopped and preserved.
- Official Storage v1.89.12 wrote/read four `user.supabase.*` xattrs correctly on an isolated bind mount, including from a fresh container; attributes are visible from macOS. The initial assertion incorrectly expected exactly four total attributes, but macOS adds its own. Corrected the test to check Supabase’s namespace without repeating completed writes.
- Copied 16 existing service images locally, without model downloads/rebuilds. Docker 29 represents image IDs and empty configuration fields differently; all RootFS layers, platform, creation dates, and effective launch parameters were compared. Service versions, Ollama configuration, and SMTP were unchanged.
- Before transfer, stopped only Smart Wardrobe and created full `postgres.dump`, `cluster.sql` with roles, configuration/photo/then-sidecar copies, and cold archives of seven volumes. Backup: `investigation/backups/orbstack-migration/2026-11-10T17-56-49.986Z/`. Compared archives file-by-file against SHA256 manifests; pg_restore read the dump. All seven volumes were restored in OrbStack and content/UID/GID/modes/symlinks compared again. PostgreSQL started from the restored cold copy, not a pg_restore SQL restoration.
- Restored 1096 real xattrs on 548 photos, checking SHA256 before/after. Active Storage now uses unmodified `supabase/storage-api:v1.89.12` and a single `./data/storage:/var/lib/storage` mount. Removed the adapter build/image from Compose, its code, and five obsolete tests. Former `data/storage-metadata/` remained untouched as an inactive safeguard; it is not mounted or updated.
- Real unmodified FileBackend isolation tests passed uploads, MIME/cache/encoding headers, range, ETag/304, copy/delete, multipart completion/abort, and reads after a new container start. Executable example retained at `infra/storage/native-smoke.cjs`. After Supabase startup: four existing image variants matched backup; authorized Storage API upload/download SHA256 and isolated-file deletion passed, denying foreign/anonymous access. Temporary test account/wardrobe cleaned up.
- Before allowing application writes, fingerprints confirmed unchanged existing accounts/passwords/profiles/sessions/wardrobes/relationships/garments/photos/Storage objects/jobs. Migration history is identical; migrator was not copied/run and historical 0008 remains unapplied. BFF/worker/web started through `--no-deps --no-build` after verification. Container environment comparison found no unexpected differences; FILE_STORAGE_METADATA_PATH was the only intentionally removed variable.
- All 16 services healthy, public `/api/health` 200, no new Storage/worker/API log errors. Tests 97/97, lint, and API/worker/web/shared typechecks passed; the five removed tests covered the retired adapter. No new AI requests/frontend rebuilds. Real-browser and existing-user password login remained unverified; temporary-account password login passed through GoTrue.
- Documentation now specifies OrbStack on macOS, standard backend, and xattr-preserving backups. Host BSD tar `--xattrs` round-trip on an isolated file preserved all four attributes, including container reads. Backups/old engine retained; returning after new writes requires current data synchronization, not simply starting the old database. No push or Proxmox operations.

## 2026-11-10 — removal of inactive copies from data

At the user’s explicit request, removed `data/storage-before-sidecars-2026-11-10T17-20-31.242Z/` (551 files including Finder files) and unused `data/storage-metadata/` (548 JSON files), about 913 MiB. First verified current mounts and an independent validated backup. Names/sizes of all 556 active files in `data/storage/` remained identical. No `investigation/backups/` archives, volumes, or SQL data were deleted; services were not started. At inspection, OrbStack had no containers and old Docker Desktop project containers were stopped, so no current health claim was made. Report: `investigation/reports/orbstack-migration/removed-inactive-copies.json`.

## 2026-11-10 — instrukcja aplikacji w README

Rebuilt README covering product, features, fresh/existing installation, screens and 200-image import, rotation, AI persistence, outfits, laundry, family, Mermaid architecture, configuration, queues, security, xattr backups, and limitations. Removed obsolete claims about missing analysis/inactive data/storage. Verified routing/limits, image configuration, and local links against code. Documentation-only; no containers, migrations, models, or unnecessary application tests were run.

## 2026-11-11 — garment details and navigation UX

Sidebar separates wardrobe selector/create button and scrollable navigation with pinned account panel. Garment details use a 35% photo / 65% properties layout, with full-width recommendations. Properties edit inline, suggestions use a compact accept/reject panel, and technical statuses collapse. Rotation provides immediate local preview, submits one absolute angle after an 800 ms debounce, and supports retry; originals remain unchanged. Added mocked Playwright for Enter/Escape editing, suggestions, double rotation, retries, fresh catalog cache, and desktop/mobile overflow. Verified 105/105 Vitest, ESLint, API/web typecheck, web build, and 2/2 Playwright. No API/schema/container/data changes.

## 2026-11-11 — garment property autocomplete

Brand, color, material, pattern, style, and subcategory fields suggest existing values from the same wardrobe. Suggestions use authenticated `GET /api/garments?wardrobe_id=...` including archived garments; normalization removes excess spaces/case-insensitive duplicates. New values are saved only on the current garment through existing PATCH and become future suggestions. Added filtering, arrows/Enter/Escape, and touch/mouse selection. No migrations/API changes. Web typecheck, ESLint, 105/105 Vitest, build, and 2/2 desktop/mobile Playwright passed with mocked API and no user-data writes.

## 2026-11-11 — custom fields deployed

Confirmed the old schema had no custom definitions/values; `cleanliness` is laundry status rather than wear condition. After approval, applied `0015_custom_garment_properties.sql`: three definition/option/JSONB-value tables with wardrobe-isolating foreign keys/RLS and system `wear_condition` (`unknown` for existing garments). API uses user sessions, validates types/options; garment UI creates fields, manages names/order/visibility, adds options, and saves individual values. Added rolled-back two-user RLS and mocked UI tests. 114/114 Vitest, ESLint, API/web/shared typecheck, builds, and 2/2 dev-server Playwright passed. Migrator confirmed `ebbbaa…a9b2414` checksum; RLS passed. Only API/web rebuilt/recreated, both healthy; worker/database stayed healthy. Active bundle includes UI and OpenAPI lists endpoints. Extra live CRUD stopped before endpoints because existing SMTP relay rejected test registration (`450 Development SMTP forwarding failed`); verified no test accounts were stored. SMTP unchanged.

## 2026-11-11 — garment readiness, navigation, and single-editor coordination

Added derived outfit-readiness status (category and at least one color) to cards/details beside cleanliness; archive/laundry remain separate availability states. Catalog route state stores filters, sorting, and visible ID order; details support previous/next, preserve scrolling, and show a deleted-record state. System/custom editors share a coordinator: field changes first save the previous field; errors keep drafts, Escape cancels, and outside clicks commit. Fixed suggestion focus, z-index, and overflow. No migrations/API changes. 117 Vitest tests, all-package typechecks, ESLint, web build, and 2/2 desktop/mobile Playwright passed.

## 2026-11-11 — questionnaire and style profile

Added 30 questions in seven sections, single/multiple selection, skipping, step progress, and autosave per change. Per-user local drafts synchronize with API when online again. “My style” derives a summary, missing information, and hard restrictions separately from preferences. Added navigation entry and nonblocking dashboard shortcut. API uses user sessions, Zod, and an own-profile-only RPC; RLS does not use service_role.

Migration `0016_style_profile.sql` applied transactionally to local OrbStack development database; checksum saved in `private.schema_migrations`. Two-user RLS passed with rollback. Only API/web rebuilt/recreated; all services remained healthy, anonymous style endpoint returned 401, page/API health 200. No production/user-data changes. Code verification: 122/122 Vitest, shared/API/worker/web typecheck, ESLint, web build, Playwright 1/1. Details: `docs/style-profile-migration.md`.

## 2026-11-11 — Gemini API settings deployed locally

Added Gemini AI settings: save/replace/delete key, discover/select models, and asynchronous queued connection test with cancellation. API encrypts keys using AES-256-GCM; full values never return to UI, while worker has narrow encrypted-column access. Added session/CSRF endpoints, BullMQ tasks with durable PostgreSQL status, deduplication, global queue cap, and RLS. Shared Redis Lua limiter defaults to 12 RPM; `GEMINI_SHARED_QUOTA_ID` links different keys in one project. At most three attempts for transient 429/5xx with Retry-After/backoff; permanent errors, daily limits, and timeouts are not retried. No real requests or wardrobe/profile data sent.

Additive `0017_gemini_configuration.sql` applied locally after PostgreSQL backup (`investigation/backups/gemini-migration/postgres-before-0017.dump`); history confirmed it was the only pending migration. RLS tests found an inherited Supabase table grant, so 0018 was added/applied to restrict `gemini_credentials` reads to safe columns. Two-user RLS confirmed isolation/deduplication/ciphertext denial; full transaction rolled back with 0 fixtures. Missing `GEMINI_ENCRYPTION_KEY` was set in ignored `.env` without revealing it. Only API/worker/web rebuilt/recreated; Auth/database/Storage/Redis/others retained containers/volumes and remained healthy. Smoke checks: API/worker health 200, anonymous Gemini settings 401, static Gemini UI present, RLS tables present, no Gemini errors. No Google key was saved, so no real Gemini request was sent. Earlier checks: 133/133 Vitest, shared/API/worker/web typecheck, ESLint, Compose validation, web build, mocked Playwright 1/1. TPM/RPD are reserved, not enforced. Details: `docs/gemini-setup.md`.

After “Gemini configuration permission denied,” reproduction showed PostgREST UPSERT needed table grants unsafe for ciphertext. Migrations 0019–0020 revoked direct API-role DML and routed writes/model changes/deletion through private SQL functions restricted to `wardrobe_session`, called after BFF authentication. RLS also found default Supabase DML grants; 0020 revoked them. Final `tests/gemini-rls.sql` passed BFF save/replace/model/delete, no direct DML/ciphertext reads, isolation, and deduplication in a rolled-back transaction (0 fixtures). Only API rebuilt/recreated; health 200, active container has new code. Other services/volumes unchanged.

Investigated model discovery failure: one `models.list` using saved settings and the shared Redis limiter returned Google HTTP 400 `INVALID_ARGUMENT`: “API key not valid. Please pass a valid API key.” This indicates rejection of the saved key, not model-list parsing; the key was not printed. Worker now classifies this 400 as `invalid_key` instead of a generic error. Ten tests, worker typecheck, and lint passed; only worker recreated and healthy.

## 2026-11-11 — Gemini jako generator stylizacji

Main `/api/recommendations` route now creates a durable Gemini task instead of running the local algorithm. Worker uses a narrow security-definer function to load only clean, non-archived wardrobe garments, structured profile, and criteria; no images, notes, or personal data enter the prompt. One `generateContent` call reuses Redis limiting/retries; Gemini worker is sequential. JSON is checked against catalog/hard restrictions; invalid, foreign, unavailable, or incomplete garment IDs never reach UI.

Outfit UI supports occasion, temperature, optional weather/requirements, count, polling, cancellation, actual garment photos, rationales, and separately identified missing items with user acknowledgement. Garment details display already saved outfits containing that item without hidden AI generation. Added prompt, restriction, ID, missing-item, retry/provider, and authentication tests. At initial verification, `0021_gemini_outfit_generation.sql` was unapplied and Docker unavailable; after a reported error it was deployed with fixes 0022/0023.

Code verification: 141/141 Vitest, repository ESLint, API/worker/web/shared typechecks passed. Vite production build passed with only the 789 kB main-bundle warning. No Google Gemini requests. `0021` needed applying through the local migrator once Docker access returned; the old algorithm remains shared code but is not used by generation endpoint/screen.

After deployment of the reported “Failed to save Gemini configuration” error, a transactional test found an ambiguous `wardrobe_id` variable and context aggregation missing `GROUP BY` in outfit SQL. Applied 0021 was not edited; additive 0022/0023 fixed them. `tests/gemini-rls.sql` passed with `ROLLBACK`; readback confirmed 0 test accounts. Migrator applied 0021–0023, API/web returned 200, all Compose services healthy. No real Gemini requests.

After saved outfit descriptions disappeared, added durable `rationale`, `wearing_tips`, `missing_items` fields to favorites. Updated shared validation, `save_outfit` persistence, reads, and UI; existing rows receive safe `null`/empty-list values. Applied additive `0024_persist_saved_outfit_descriptions.sql`; transactional `tests/saved-outfit-rls.sql` verified text, tips, missing items, and IDs before `ROLLBACK`. All-package typechecks and 18 focused tests passed; API/web 200, services healthy.

## 2026-11-12 — consistent dropdowns

Added shared `DropdownSelect` for single-choice catalog/form/settings/generator lists, using the same appearance, selection, shadow, and rounding as wardrobe selection, with keyboard/typeahead and positioning outside clipping containers. Multi-select remains native. E2E covers sorting/category choice on desktop/mobile. Web typecheck, ESLint, and 2/2 Playwright passed; only `web` recreated and healthy, `http://localhost:8080/` returns 200 with new assets.

Custom selection failed because the inline coordinator treated portaled menu clicks as outside clicks and ended editing before selection. Menus now receive the active editor ID, keeping selection active; cancelling `mousedown` preserves focus without blocking clicks. E2E adds low/medium/high options, clicks medium, and verifies saved values on desktop/mobile. Playwright 2/2, web typecheck, ESLint, and `git diff --check` pass. Only `web` recreated.

## 2026-11-12 — UI regression fixes after daisyUI migration

Using `docs/ui-regressions.png`, fixed layout causes: daisyUI `inline-flex` controls appeared beside label titles; fields are now block-level and full-width. Unified field grid widths, bounded outfit generator panel width, and responsive controls. Gemini fields stay within settings columns; long model names truncate within controls. Wardrobe selector has a separate create-button column; active navigation no longer has a doubled border, while keyboard focus remains visible.

Added E2E control-width/selector-navigation separation assertions. Desktop/mobile Playwright 4/4 passed; web TypeScript/build, ESLint, and `git diff --check` passed. Generated/reviewed 16 screenshots in ignored `investigation/tmp/ui-daisyui/`: aligned fields, no doubled active-menu border, no mobile horizontal overflow. Detail screenshots use mocked test data with unavailable images; this is not a layout or production-image error.

After updated `docs/ui-regressions.png` feedback, replaced wardrobe selection with a custom arrows/Escape/Enter menu that closes when focus leaves, isolating the create button’s styles. Entire garment cards now navigate to details while favorites remain separate actions. Sorting has a consistent field appearance, navigation focus is not clipped, and saved-outfit deletion has clear spacing from missing-item responses. Desktop/mobile Playwright 2/2 passed; menu/catalog/saved screenshots reviewed again. TypeScript, ESLint, and formatting pass.

At the user’s request, refined catalog sorting: replaced filter icon with a sorting icon, added “Sort”, and integrated the selected ordering into one lightweight bordered control. Desktop/mobile E2E 2/2 passed; catalog screenshots reviewed.

## 2026-11-12 — monorepo quality system

Configured ESLint 10 flat config with typed linting, strict shared/API/web/worker TypeScript, React Hooks, Prettier, Vitest/React Testing Library, dependency-cruiser cycles/boundaries, explicit Knip baseline, Husky/lint-staged, and GitHub Actions. `pnpm check` runs formatting, lint, typecheck, tests, dependencies, and builds. Baselines retain existing debt without automatically fixing it or deleting reported files.

Verification: pnpm 12.18.0 frozen install; `pnpm check` passed. Vitest 29 files/145 tests; all-package typecheck/builds; 110 modules/261 dependencies, 13 known cycles, zero new boundary violations; Knip 33 existing/0 new; Prettier 11 existing/0 new; ESLint 686 existing/0 new. Existing 799 kB web-bundle warning remains. `core.hooksPath=.husky/_` hook active. No application logic, data, or Supabase changes.

## 2026-11-12 — editor and survey refactoring

Extracted standard inline editors, custom fields, and management modules; survey now has a question component. Added multi-select/skip test and safer amount/list editing. Full Vitest 31 files/151 tests; all-package typecheck; mocked desktop/mobile Playwright 10 PASS/2 safe skips; ESLint 646 (0 new, 40 fewer than 686); dependency graph clean; Knip 32 baseline, Prettier 11 existing. Web build/restart passed with the approximately 802 kB warning. Overall refactoring ongoing, no commits.

Continuation: extracted inline-edit coordinator into its own hook/context; detail statuses/async actions use explicit guards. Custom-property API now separates validation, definitions/options, and values with Zod validation of database results. Final checks: Vitest 151/151, mock Playwright 10 passed/2 skips, four-workspace typecheck, graph 0 violations (162/541), ESLint 631 (0 new), Knip 32 baseline. Only API/web rebuilt/restarted; both healthy, HTTP 200.

Extracted image rotation into `use-garment-rotation.ts` (preview, debounce, serialization, retries, processing state). Verification: 151 Vitest PASS, four-workspace typecheck, 10 mock E2E PASS/2 skips, graph 0 violations (163 modules/546 edges), ESLint 631/0 new. Web built/restarted; API/web healthy.

Shared style profile split into schemas/constraints and survey content/labels with public imports preserved. A static 30-key tuple is tested against schema/questions. Verification: Vitest 151/151, four-workspace typecheck, graph 0 violations (165/549), ESLint 627/0 new. Shared changes require rebuilding web/API/worker.

After shared rebuild, `web`, `api`, and `worker` containers are healthy; API health returns 200; full mock Playwright 10 passed/2 skips. No migrations/data changes.

## Monorepo directory reorganization — 2026-11-12

- Web source moved into `app/`, `components/`, `features/`, `lib/`, `styles/`; domain modules no longer sit flat in `src/`.
- Grouped Fastify into `app/`, `modules/<domain>/` and `lib/`; retained the `apps/api/src/index.ts` entry point.
- Worker grouped into `app/`, `jobs/`, `pipelines/`, `integrations/`; `apps/worker/src/index.ts` remains a compatible entry point.
- Imports, tests, and Knip baseline updated for new paths; `scripts/check-src-layout.mjs` added to `pnpm check`.
- API/web/worker TypeScript and Vitest 151/151 pass; dependency-cruiser finds no cycles. Playwright 10 passed/2 safely skipped write flows; complete local-binary verification passes against existing lint/Knip/Prettier baselines.
- `pnpm` was unavailable on the host; checks used local binaries from `node_modules`.

- Migrator paths in Compose/generator were also updated; API/worker entry points stayed compatible.

- Final state: `docker compose config --quiet` valid; only `web`, `api`, `worker` recreated; all services healthy and `/api/health` returns `ok`. No worker errors after restart. `git diff --check` clean.

# EN/PL internationalization

- Added i18next/react-i18next, English default, and Polish selection in Settings; choice persists in localStorage and updates `html lang`.
- Added shared `common`, `navigation`, `validation` resources and 11 feature-local resource pairs. Completeness checks are included in `pnpm check`.
- Pages, forms, navigation, catalog, garments, uploads, analysis, outfits, survey, family, laundry, and settings use translations. Dates/custom monetary values follow the active language.
- Added tests/E2E for default language, switching, localStorage, `html lang`, interpolation/plurals, and preservation of entered text.
- Limitation at this stage: Gemini prose and verbatim care-label OCR are source data. Prompts/API contracts were unchanged; generated-language handling remained separate work.

## 2026-11-14 — Travel Packing

Added separate `/travel-packing` navigation page, RHF/Zod form with optional date, generation through existing Gemini queue/worker, and named-list save/reopen. Existing outfit generator/prompts preserved. New prompt separates typical climate from forecasts and assumes no season without a date. AI output is validated; the application assigns item IDs and sends no wardrobe/photos to the model.

Garment matching reads real wardrobe metadata through user token/RLS. Checklist separates required/assigned/missing/packed quantities and supports quantity edits, partial packing, checkboxes, custom rows, deletion, intentional garment reuse, and progress. Editing does not call AI. Added complete EN/PL, job states, cancellation/retry, empty wardrobe, and no-match states.

Migration `0025_travel_packing.sql` adds lists with owner/membership RLS, assignment validation, and a narrow task-creation function. Tested with two users in a temporary schema-only database, automatically removed afterward. Garment deletion preserves lists/progress. Migration was not applied to the existing application database; running containers were not rebuilt/restarted at that stage.

Verification: full `pnpm check` PASS, 36 files/175 Vitest tests, all-package typechecks, no new ESLint/dependency/layout/i18n/Knip findings, all builds. Travel Packing E2E 4/4 PASS (desktop/mobile × EN/PL), Gemini/HTTP mocked without application writes. Scenario covers Japan/10 days, assignment, partial packing, save/reload, and one generation call. API tests cover sessions/CSRF; SQL tests verify read/delete isolation and foreign-garment rejection. Existing bundle warning remains. Documentation: `docs/travel-packing.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`. No commits/baseline changes.

### Travel Packing deployment — 2026-11-14

After approval, rebuilt `migrate`, `api`, `worker`, `web`. Standard checksum migrator applied only `0025_travel_packing.sql` (SHA-256 `bc15490e0be1d545128c677ae8e5f768a5bab088097ecc68846125aa1b84f296`). Recreated only API/worker/web; all services healthy, `/api/health` 200, anonymous `/api/travel-packing` 401, `/travel-packing` served, `packing_lists` RLS active. Existing garment count (92) and saved-outfit count (8) unchanged before/after. No real Gemini calls or commits.

E2E against deployed web (`http://localhost:8080`): 4/4 PASS (EN/PL, desktop/mobile). API/Gemini mocked, with no application writes or quota use. Documentation formatting and `git diff --check` pass.

## 2026-11-14 — Travel Packing completeness

Traced form, API contracts, Gemini transport, worker, validation, normalization, persistence, and UI. Missing deterministic baseline/semantic checks caused incomplete lists: structurally valid JSON containing one item or a generic underwear row passed validation. API/UI did not truncate rows; the 80-row cap and lack of an explicit token budget did not guarantee completeness.

Added typed 13-group/item catalog in `packages/shared/src/travel-packing/catalog.ts`, quantity rules in `rules.ts`, a pre-Gemini baseline, and post-response merging/repair. AI proposes justified adjustments/additions rather than replacing the baseline. Validation removes generic bundles, merges duplicates, restores correct types/names, and protects daily-clothing minima. Provider/validation failure yields a labelled baseline without additional AI loops; explicit cancellation remains cancellation. Existing limiter/retry/queue reused. Travel Packing output budget: 8192 tokens. Outfit prompts unchanged.

Matching requires a specific garment type; no match does not imply non-ownership. EN/PL UI groups independent checkboxes and separates required/packed labels from names. Optional metadata stays in existing JSON, without migrations or rewriting saved lists. Japan/November/10 days/no laundry baseline: 30 separate items including 12 underpants, 8 short/4 long socks, 7 T-shirts, 2 optional shirts, 3 trousers, 2 sweatshirts, 1 optional sweater, 2 sleepwear sets, and individual toiletries. Full table/limits: `docs/travel-packing.md`; reproducible JSON in ignored `investigation/reports/travel-packing-completeness/japan-10-days.json`.

Verification: `pnpm check` PASS — 37 files/191 tests, all builds/typechecks, no new lint findings, graph 234 modules/738 dependencies clean, complete i18n/Knip. Vite E2E 6/6 PASS (EN/PL, desktop/mobile, complete fallback, groups, no overflow, save/reload progress); mobile screenshot reviewed. Gemini mocked.

Rebuilt/deployed only API/worker/web; all healthy, `/api/health` 200, anonymous lists 401. Existing saved list (one row) has identical pre/post fingerprint `e960a8693e9ae949ae332b1508f55d34`. Latest migration remains `0025_travel_packing.sql`. No reset, data migration, or commits.

Post-deployment E2E against `http://localhost:8080`: 6/6 PASS with API/Gemini mocks and no user-data writes. Documentation formatting and `git diff --check` pass.

## 2026-11-14 — saved-list read error and Travel Packing appearance

Diagnosed page-open 500 against a real row: strict `packingListSchema` rejected Supabase `user_id` and `wardrobe_id` columns returned by `select('*')` and saves. Response schema now strips extra database columns while save requests stay strict. Earlier mocks omitted these columns. Added contract regression and GET/PUT tests with stubbed sessions and real Supabase client over mocked transport; full-row reads/writes return 200. Also validated the existing row with deployed API schema without exposing content or writing it.

Replaced “Saved lists” heading with a working counted tab, saved-trip cards, continue action, progress, and retry after load failure. Form/heading reuse outfit-generator PageHeading, Button, panels, responsive layout, and spacing. Planning/saved/edit views are separate; “New trip” opens an empty form. All new text has EN/PL. Reviewed desktop/mobile planner and saved-list screenshots.

Verification: `pnpm check` PASS, 37 files/193 tests; no new lint/graph/layout/i18n/Knip findings, all builds/typechecks. Vite E2E 6/6 PASS with complete database fields and tab switching. API/worker/web rebuilt/deployed, all healthy. Saved list fingerprint unchanged (`e960a8693e9ae949ae332b1508f55d34`). No migrations/commits.

Post-deployment E2E against `http://localhost:8080`: 6/6 PASS (EN/PL, desktop/mobile), API/Gemini mocks, no user database writes. Documentation formatting and `git diff --check` pass.

## 2026-11-14 — Remember me and persistent sign-in

Added default-checked, accessible “Remember me” with EN/PL and lifetime explanation. Optional login `rememberMe` stays in BFF; Supabase still receives only email/password. Checked gives a 30-day HttpOnly cookie, renewed on authenticated activity when fewer than 29 days remain. Unchecked gives a browser-session cookie with a 12-hour server record. Choice lives in encrypted `private.sessions.tokens` payload and survives token rotation. Old payloads without the flag remain compatible/persistent, without migration or rewriting records.

Audit found the existing cookie already lasted 30 days, but transient refresh/user-lookup errors were mapped to 401 and cleared it. Transient 429/5xx/unavailable errors now return 503 and preserve sessions. Definitively rejected/expired sessions still require sign-in; logout removes row/cookie. Supabase’s one-hour JWT remains unchanged, refreshed automatically under a PostgreSQL row lock. Tokens do not enter localStorage or API responses.

Verification: `pnpm check` PASS — 38 files/205 tests, including 12 new session tests for both cookie modes, encryption, renewal, rotation, transient-error preservation, old payloads, expiration, and logout. API-local Vitest enabled. No new lint/i18n/graph/layout/Knip findings; all workspace typechecks/builds pass. Mocked remember-true/false desktop/mobile form E2E 4/4 PASS against Vite; mobile screenshot reviewed. No real credentials/accounts used or changed.

Rebuilt/deployed API/web. All services healthy, API health 200; active session-row count stayed 12. Existing sessions were not revoked; no migrations/commits. Details: `docs/auth-sessions.md`.

Post-deployment E2E against `http://localhost:8080`: 4/4 PASS (both Remember me choices, desktop/mobile). Documentation formatting and `git diff --check` pass.

## 2026-11-14 — demonstracja Playwright READ-ONLY

Audited explicit/automatic writes, AI jobs, and session refresh. Recorded in a fresh browser context using an isolated local preview of account data read in RLS-protected READ ONLY transactions. All API requests intercepted locally; generators labelled as examples without Gemini. MP4/WebM, report, and endpoint policy remain in private ignored `investigation/reports/readonly-demo/`. No data/photos published.

Before/after identifiers and field fingerprints confirmed identical account, wardrobe, favorites, outfits, packing lists, assignments, packing status, preferences, and sessions. No backend API calls, account writes, migrations, or restore mechanism. Saved data unchanged. Verified forbidden POST blocking, MP4 validity with ffprobe, and control frames. Application/configuration unchanged; no commits.

## 2026-11-15 — outfit generator additional requirements layout

Moved optional additional requirements into a full-width row below temperature/weather/count. Three primary controls retain equal 45 px heights. Multiline notes have dedicated space and bounded vertical resizing; generate/cancel actions sit below, right-aligned on desktop and full-width on mobile. Validation, 500-character cap, and generation behavior unchanged.

Verification: web typecheck and full `pnpm check` PASS (205 tests); local Playwright geometry/overflow checks and screenshots on desktop/mobile. API fully mocked; no Gemini/account writes. Rebuilt/deployed only web. No migrations/commits.

## 2026-11-15 — remove garment-addition section from outfits

Removed the initial “Time for a good combination” card and single/bulk add actions from `/outfits`. View starts with the generator; results/no-match state appear after generation. Preserved empty saved-outfit and generated missing-item messages. Removed unused AddButton import.

Verification: web typecheck, `pnpm check` PASS (205 tests), Playwright confirms removed section and correct desktop/mobile layout. Mocked API, no account/Gemini access. Only web rebuilt/deployed. No migrations/data changes/commits.

## 2026-11-15 — shared full page width

Removed the style profile/survey 1040 px cap and outfit/trip-planner panel 1180 px cap. Views now use full shared `.main-content` width like Overview, preserving margins/responsiveness. Only existing CSS rules changed.

Playwright compared widths/left edges of Overview, My style, survey, Outfits, and Travel Packing at 1920/1440/390 px: all 15 comparisons PASS without horizontal overflow. Reviewed wide Travel Packing screenshot. API mocked without account operations. `pnpm check` PASS (205 tests). Only web rebuilt/deployed; no migrations/commits.

## 2026-11-15 — style survey 2.0 and shared style profile

Preserved q01–q30 and JSON version 1; added only four optional fields:
dominant style, specific colors, everyday formality, and independent strengths
for style/color/fit preferences. The survey has 34 questions in seven logical
steps, dominant-style cards, color swatches, and a formality scale. Old
local progress maps to new steps without resetting answers. The profile
shows separate 30-question base progress and a four-question extension; dashboard does not
mark an old completed profile incomplete because new questions exist.

Added deterministic `StyleProfileSummary` separating preferences,
restrictions, context, and recommendations. Missing answers are not guessed,
and `false` remains distinct from unanswered. Conflicting preferences
yield to restrictions while original answers remain saved. “My style”
shows a large style card, supporting influences, concrete colors, characteristics,
contextual rules, and restrictions; full answers are expandable. Gemini
receives the same interpretation, while shared validation/ranking rejects recognized
hard-rule violations and orders valid alternatives by soft preferences.
Expanded EN/PL and disambiguated reused option identifiers
(for example, office formality versus formal footwear).

Verification: `pnpm check` (223/223 Vitest tests, 41 files; types, builds,
15 i18n pairs, module boundaries, layout, and baseline without new violations),
Playwright 8/8 (EN/PL desktop/mobile, save and reopen, legacy profile
30/30 without PATCH, complete profile with 34 answers). Screenshots in ignored
`investigation/tmp/ui-daisyui/`. Real RPC and two-user RLS verification
ran in a temporary schema-only database, without copying account data;
confirmed additive writes, preserved old fields, `false`, and skips. The
test database was removed. No migrations or write tests ran against
the existing account; Gemini was not called. Existing warnings remain for
Vite bundle size, daisyUI CSS, and Fastify deprecation. Audit, questions,
interpretation, and limitations are documented in `docs/style-profile.md`.

## 2026-11-15 — style survey 2.0 in the running stack

Reports of `sections.aesthetics`, the old counter, and missing colors were caused by
old web/API/worker images remaining in Compose after the earlier
implementation was tested on Vite. Container inspection confirmed
missing q32_colors and shared profile interpretation. Built current images and
replaced only those three services with `up --no-deps --no-build`, without
running the migrator, changing account data, or altering volumes. All three
services are healthy; file inspection confirmed new fields and interpretation.

The main counter now includes all 34 questions (for example 30/34),
alongside the preserved original-survey counter of 30/30,
with a separate optional extension counter of 0/4. Translated the legacy aesthetics section key and added
“Answer the new questions” to open step one without losing
saved progress or answers. “Favourite colours” points to survey step two
when no specific swatches are selected. It does not infer
new answers from old broad palettes.

Verification: `pnpm check` passed (225/225 Vitest, 41 files, no new
baseline findings); deployed `localhost:8080` Playwright passed
8/8 (desktop/mobile, EN/PL, new fields, colors, 30/34 count, and old-progress
transition to new questions). All Playwright API requests were intercepted
by isolated in-memory fixtures; the existing account was not edited. In an old
tab/PWA, select “Refresh application” when the new-version notice
appears; browser data need not be cleared. No migrations or commits.

## 2026-11-15 — spacing between answer sections

Added 12 px top margins to section cards in the expanded full profile
(“Your style and aesthetics”, “Colours and patterns”, etc.). Spacing does not depend on
`gap` support in native `details`. Answer content and state were preserved.
Existing Playwright also captures the expanded section list
on desktop and mobile (`profile2-answer-sections`). The change affects only
presentation, with no migrations or account-data operations.

Verification: `pnpm check` passed (225 tests); two deployed-site Playwright scenarios
confirmed desktop/mobile presentation. Released the change
by replacing only web. Tests used in-memory fixtures.

## 2026-11-15 — global repeatable code-style cleanup

At the user’s explicit request, existing import and blank-line rules
were extended across the monorepo. Added shared `eslint.style.config.js` for
full ESLint and style commands, reusing existing tooling:
Prettier, `eslint-plugin-simple-import-sort`, and the native
`padding-line-between-statements` rule, without dependency installation. Prettier explicitly
sets semicolons, single quotes, trailingComma all, width 100,
two-space indentation, bracketSpacing, arrowParens always, and LF.

`pnpm style:fix` runs Prettier, stylistic-only ESLint `--fix`,
Prettier again, and strict `style:check`. `pnpm check` now starts with
`style:check` without tolerating a stylistic baseline. Exclusions cover builds,
dependencies, private data/experiments, vendored Supabase, the lockfile,
immutable migrations, model metadata and generated reports. Existing baselines
were not increased. Ordinary tasks still use local formatting;
AGENTS.md and CODE_QUALITY.md describe the standard and automation limits.

Automatically formatted **204 files** out of 309 inputs.
Comparison against the saved starting state confirmed preservation of ASTs in 221
JS/TS/JSX/TSX files, allowing import ordering, plus contents of 47 JSON
and three YAML files. Four files containing side effect imports preserved
their complete import order. A second full `style:fix` changed **0 files**,
verified by SHA-256. Earlier user changes were not reverted.

Verification: `style:check` PASS; `pnpm check` PASS, **231/231 Vitest across 42
files**, all workspace types/builds, i18n, layout and dependency-cruiser
and Knip without new violations. Typed ESLint retained 603 existing
diagnostics (0 new); no logic fixes or assertions were used to
hide them. Added six tooling tests covering imports, spacing, exported
functions, side effects, repeatability/JSX/CJS, disable comments,
and exclusions. The separate configuration recognizes existing TypeScript disable comments
without activating those rules or removing comments as
apparently unused.

Additional Playwright ran against a local preview of the new build, with API entirely in
RAM: **18 PASS / 4 FAIL**. Two existing scenarios (garment details and
Gemini settings, each on desktop/mobile) expect Polish labels without
selecting Polish, although the default is EN. The same selectors
and missing language setup were confirmed in the pre-format snapshot.
Application functionality and test logic were not changed for styling.
No live account-writing E2E, Gemini calls, migrations, or resets ran;
user data/running services were unchanged. Preview was stopped.

## 2026-11-15 — English-first source and practical development guide

Translated authored documentation and technical API/worker/script diagnostics into English while preserving Polish UI resources, localization fixtures, multilingual garment vocabularies, user content and checksum-protected SQL. Added stable additive API error codes, localized frontend error mapping, explicit outfit content-language propagation and shared packing locale resources. The existing i18next instance remains the only application instance. PWA metadata and offline fallback default to English, with a separate Polish static fallback.

Added `pnpm language:check` to the quality gate: a lightweight heuristic scans authored prose, with reviewed localization exceptions and explicit SHA-256 exceptions for existing migrations. It reports locations without printing potentially private content. Extended i18n parity checking to the shared packing resources. Pre-commit lint-staged explicitly disables stashing and partial-file hiding. No quality baselines were increased.

README now links a five-file `docs/development/` guide: current feature/API/storage/test map; source layout and data-flow diagram; frontend/API recipes; immutable SQL/RLS workflow; worker/Gemini integration; i18n; commands/environment; isolated testing; backup/deployment/troubleshooting; and a proposed wardrobe-reminder feature with a checklist. The example is documentation only. Verified 78 distinct referenced repository paths (excluding explicitly proposed/example filenames), package scripts/configuration and 94 relative Markdown links/anchors. Documented gaps include handwritten database contracts, no automatic rollback, no universal host-mode environment loader, incomplete OpenAPI response coverage, and remaining isolated live-stack test harness work.

Verification: full `pnpm check` passed, including 236 Vitest tests across 43 files, all workspace types/builds, 16 locale pairs, dependency boundaries, layout, language check and unchanged legacy lint/Knip allowances. All 22 selected mocked Playwright scenarios passed across the main and focused reruns, covering auth, garment details, settings, old/new style profiles and Travel Packing in desktop/mobile EN/PL; outdated assumptions about the default language and localized errors were corrected. Tests use in-memory browser fixtures and mocked Gemini; no migrations, real-account writes, paid AI calls or deployment were performed for this milestone. Existing Fastify deprecation and web bundle-size warnings remain.
