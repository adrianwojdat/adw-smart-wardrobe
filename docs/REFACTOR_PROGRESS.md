# Refactoring progress

## 2026-11-12 — audit and plan

- **Stage 1 (audit): DONE.** Verified Git status, 15 latest commits, 82 uncommitted entries, application/package sources, tests, configuration, `pnpm check`, and running Docker Compose. No stash, checkout, commit, migration, or data-mutating test was performed.
- **Stage 2 (plan): DONE — awaiting approval.** Added `docs/CODEBASE_AUDIT.md`, `docs/ARCHITECTURE.md`, and `docs/REFACTOR_PLAN.md`. Documentation covers every source file in `apps/*/src` and `packages/*/src`, its status, and rationale.
- **Application code: untouched.** Refactoring had not begun, as required by the instruction to stop after auditing.

### Verified baseline

`pnpm check`: PASS. Shared/API/web/worker typecheck PASS; Vitest 29 files / 145 tests PASS; builds PASS (799 kB web JS chunk warning); dependency scan 110 modules / 261 edges, 13 known cycles, 0 boundary violations; Knip 33 baseline findings; ESLint 686 baseline diagnostics, 0 new; Prettier 11 existing files. Mocked desktop/mobile Playwright garment details, Gemini settings, and profile scenarios: 6/6 PASS. Full registration/upload E2E was skipped because it creates a permanent account, wardrobe, and record without cleanup; mocks do not prove integration.

### Pending

- Approval of `docs/REFACTOR_PLAN.md` and stage ordering.
- Before the first application edit, selectively review its existing unstaged diff. The repository contains earlier uncommitted work that must not be restored through stash/reset.
- Permission to design an isolated E2E test-user lifecycle; without it, do not run scenarios that write to the current database.

## 2026-11-12 — shared package and cycles

- **Stage: DONE.** Extracted garment/vocabulary Zod contracts and neutral outfit types/helpers from `packages/shared/src/index.ts`.
- Removed all 13 cycles caused by internal type imports through the barrel and real mutual dependencies among engine, scoring, and accessory/footwear rules. Internal imports no longer use `index.ts`.
- Updated `.dependency-cruiser-known-violations.json`: after a direct scan confirmed zero cycles, all 13 obsolete exceptions were removed.
- Verification: 145/145 Vitest, focused outfit/belt tests 31/31, four workspace typechecks, `pnpm check`, and builds PASS. ESLint remained 686 (0 new, 0 resolved); eight shared findings already existed in `outfit-engine`, `outfit-scoring`, `style-profile`. Knip remained 33; bundle size was 799 kB.
- **API and remaining modules still TODO.** Next: safely extract domain route handlers from `apps/api/src/app.ts`.

## 2026-11-12 — Fastify route modules

- **API route stage: DONE.** `app.ts` is the server composition root. Auth, profiles, wardrobes, garments, custom properties, images, jobs, and outfits have separate domain registrars. Methods, URLs, payloads, migrations, and data were unchanged.
- `checkedAs` and Zod schemas at Supabase boundaries strengthen custom-property typing. Preserved the `validatePropertyValue` export for the existing test.
- Verification: API TypeScript PASS; focused API/custom-property/profile tests 34/34 PASS; Prettier PASS. Fastify still emits the existing `disableRequestLogging` deprecation warning.
- Aggregate typed ESLint fell from 686 to 679 findings. Baseline fingerprints were refreshed after moving handlers; verification reported 679 known, 0 new. Remaining unsafe Supabase-result findings still require gradual runtime-schema parsing and are not considered fixed.
- **Next: worker dispatcher/handlers.** Preserve payloads, prompts, retention, retries, and quotas. Web feature extraction remains TODO.

## 2026-11-12 — current milestone verification

- Full Vitest: **150/150 tests across 30 files PASS**. Shared/API/web/worker typecheck PASS. Production web build PASS, with the existing 799 kB chunk warning.
- Dependency-cruiser: **0 violations**, 128 modules / 373 edges. Knip: 33 existing, 0 new. Prettier: 11 existing, 0 new. Typed ESLint: 676 known, 0 new; the fingerprint-based baseline was updated after moves.
- Mock garment-detail Playwright desktop/mobile: **2/2 PASS**. Live account/garment-writing E2E was skipped.
- After rebuilding Docker: `api`, `worker`, `web` healthy; GET `/` and `/api/health` returned 200. Other containers and data were unchanged.
- Full-monorepo refactoring is **not complete**: worker lifecycle, remaining web features, Gemini/session API, test harness, and remaining lint debt are still planned.

## 2026-11-12 — application screen separation

- `other-pages.tsx` contained generation/saved outfits, care, family wardrobes, and Gemini/profile settings. These moved to `outfits.tsx`, `laundry.tsx`, `family.tsx`, `settings.tsx`; the old file remains a compatible re-export layer used by the router.
- UI logic, endpoints, state, cache keys, and form behavior were preserved. This separates responsibilities rather than changing features.
- Verification: web TypeScript PASS; full Vitest **150/150 PASS**; dependency-cruiser **0 violations** (134 modules / 405 dependencies); Knip **33 existing, 0 new**; Prettier baseline **11 existing, 0 new**. ESLint remains **676**; 17 fingerprints moved from `other-pages.tsx` to new paths without changing their total.
- Mock Playwright: Gemini settings desktop/mobile 2/2 PASS; split survey/profile desktop/mobile 2/2 PASS. Live data-writing E2E remains out of scope.
- Next: catalog/navigation modules and further image-analysis/upload separation; style-profile and worker lifecycle remain open.

## 2026-11-12 — dashboard and style profile

- Extracted `Dashboard` to `apps/web/src/dashboard.tsx`; the router imports the route directly, avoiding a catalog/dashboard cycle. Removed unused catalog imports.
- Split the survey into `style-survey.tsx` and summary into `style-profile.tsx`. Preserved the answer schema, local progress, persistence/query keys, and route addresses.
- Web typecheck PASS; full Vitest 150/150 PASS; dependency-cruiser 0 violations (136 modules / 423 dependencies); Prettier 11 existing, 0 new. ESLint 676: six existing survey diagnostics were re-keyed to the new path without changing the total. Knip: 32 current, 0 new (one old finding resolved).
- Earlier in this batch, mocked Gemini settings Playwright passed 2/2 on desktop/mobile. Playwright for the split survey remained to be run.

## 2026-11-12 — bulk upload state separated from page

- Moved queue provider, batch state, retry, and upload orchestration from `bulk-upload.tsx` to `bulk-upload-context.tsx`; the page keeps progress/status and uses the same context. `BulkUploadProvider` is still re-exported from its previous module, preserving the router import. Limit/concurrency logic in `bulk-queue.ts` was untouched.
- Web typecheck PASS; full Vitest 150/150 PASS, including existing `bulk-upload.test.ts` tests; dependency-cruiser 0 violations (137 modules / 431 dependencies); Prettier 11 existing. Removing two unused imports restored the expected ESLint baseline of 676 diagnostics.
- Build and Playwright will run after this version is included in the web container.

## 2026-11-12 — Gemini settings extracted from general settings

- Moved `GeminiSettingsPanel` to `apps/web/src/gemini-settings.tsx`; `settings.tsx` now handles profile, account settings, automation, and wardrobes. Endpoints, query keys, forms, and task lifecycle remained unchanged.
- Web typecheck PASS; full Vitest 150/150 PASS; dependency-cruiser 0 violations (138 modules / 439 dependencies); Prettier 11 existing, 0 new. ESLint remains 676; four known `no-misused-promises` findings moved to the new module. Knip has 32 baseline findings; an unused export removal resolved one previous finding.
- Web will be rebuilt and tested on desktop/mobile after this batch.

## 2026-11-12 — wardrobe selector extracted from shell

- `WardrobePicker` moved to `apps/web/src/wardrobe-picker.tsx`; `context.tsx` still supplies the same provider, toast, common feedback and Shell. Focus, ARIA, pointer and keyboard behavior is preserved.
- Typecheck and Vitest 150/150 PASS; dependency-cruiser 0 violations (139 modules / 443 dependencies); Knip 32 existing, 0 new; Prettier 11 existing. Two typed lint findings moved to the new file; the total remains 676.
- Detailed mocked desktop/mobile E2E covers opening the selector, listbox, Escape, and positioning beside the create-wardrobe button; it will be repeated after rebuilding web.

## 2026-11-12 — landing separated from auth forms

- Extracted landing to `apps/web/src/landing.tsx`; `auth.tsx` focuses on login/registration/reset. Preserved route APIs, RHF/Zod validation, navigation, and existing style classes, including earlier DaisyUI field changes.
- Mocked BFF sign-in E2E without a database: desktop/mobile 2/2 PASS; dashboard displayed the authenticated user. Earlier mocked detail/Gemini/profile desktop/mobile tests passed 6/6.
- Full Vitest 150/150, web typecheck, dependency scan 0 violations, Knip 32, ESLint 676/0 new, and Prettier 11/0 new.
- Web will be rebuilt and recreated after this change; real Supabase Auth was not tested because it requires an isolated account.

## 2026-11-12 — image analysis details component

- Extracted `ImageAnalysisDetails` to `apps/web/src/image-analysis-details.tsx`; `image-analysis.tsx` retains suggestion review/accept/reject and re-exports details for compatibility with the current import.
- Web typecheck PASS; Vitest 150/150; dependency-cruiser 0 violations (141 modules / 449 dependencies); Knip 32/0 new; ESLint 676/0 new; Prettier 11 existing/0 new.
- Earlier E2E against the current bundle: sign-in, details, Gemini, and profile passed desktop/mobile 8/8. The latest change still requires a web build and smoke E2E.

## 2026-11-12 — garment detail metadata and outfits

- Extracted system metadata, composition source, custom fields, and tags from `garment-detail.tsx` into `garment-metadata.tsx`. The extracted outfit presentation stays in `garment-outfits.tsx`.
- Preserved inline save queues, validation, custom-field permissions, and rendering only after both queries load. Form enums now match allowed values instead of using assertions.
- Verification: web typecheck PASS; Vitest **150/150**; dependency-cruiser **0 violations** (143 modules / 459 edges); Knip **32 baseline, 0 new**; Prettier **11 existing, 0 new**. ESLint fell **676 → 671** with no new findings.
- Mocked garment-detail Playwright: desktop/mobile **2/2 PASS**. The complete persistent-data flow was not run.
- Next: after building and restarting only `web`, continue splitting garment UI and the test harness; full-monorepo refactoring is still ongoing.

## 2026-11-12 — image processing panel

- Extracted pipeline status, image/analysis retry controls, and job list from `garment-detail.tsx` into `garment-processing.tsx`. Endpoints, busy state, refetch, and messages remain unchanged.
- Web TypeScript PASS; full Vitest **150/150 PASS**; dependency-cruiser **0 violations** (144 modules / 466 edges). Typed ESLint baseline: **667 diagnostics**, 0 new, 9 resolved against the previous baseline.
- Mocked garment-detail Playwright ran before deployment: desktop PASS; the mobile result was being collected.
- Only `web` will be built/restarted, then E2E repeated against the running build.

## 2026-11-12 — garment processing and shell navigation

- Processing/AI panel has a separate `garment-processing.tsx` component; metadata/custom fields and garment recommendations are in `garment-metadata.tsx` and `garment-outfits.tsx`. `garment-detail.tsx` shrank from 1091 to 784 lines after extraction.
- `context.tsx` no longer renders the sidebar, mobile navigation, or menu button; these moved into `app-navigation.tsx` while preserving route links and existing CSS classes.
- Web typecheck PASS; Vitest **150/150 PASS**; dependency-cruiser **0 violations** (145 modules / 470 edges); typed ESLint baseline **667**, 0 new, 9 resolved against the initial 676.
- Garment-detail Playwright desktop/mobile: **2/2 PASS** before rebuilding web. Build/restart of only `web` was ongoing, with E2E planned against the updated application.

- **E2E safety note:** full Playwright discovery accidentally ran the registration test against running localhost. Registration stopped at `/register` before creating a wardrobe/garment, but GoTrue may have created two unconfirmed test accounts: `e2e-1794495975311-desktop@example.com` and `e2e-1794496000397-mobile@example.com`. No accounts or data are deleted without permission. The test now skips by default and requires both `E2E_ALLOW_WRITES=1` and `E2E_ISOLATED_STACK=1`; future full E2E still requires a real isolated stack and cleanup.

- After navigation/processing changes, only `web` was rebuilt/restarted; Vite/PWA build PASS with the existing approximately 801 kB bundle warning, HTTP `localhost:8080` 200. Post-restart mock Playwright covered auth, details, Gemini, profile, and landing; registration skips without `E2E_ALLOW_WRITES=1` and `E2E_ISOLATED_STACK=1`. The mobile brand-input assertion failed once, then passed in an isolated rerun; mark and track it as flaky.

## 2026-11-12 — inline editing stabilization and catalog/Gemini provider separation

- Garment card/image handling moved from `catalog.tsx` to `garment-card.tsx`; catalog re-exports preserve existing imports. Catalog focuses on listing, filtering, and sorting.
- Inline and custom-property editors share the pending save promise. When switching fields quickly, the next commit waits for the first instead of rejecting activation as `false`.
- Split the Gemini provider into `gemini-errors.ts`, `gemini-limiter.ts` and `gemini-credentials.ts`; `gemini-provider.ts` retains compatibility exports. Prompt, model, limits, retries and task behavior are unchanged.
- All four workspace typechecks PASS; Vitest **150/150 PASS** before the final type guard and focused Gemini provider **11/11 PASS** afterward. Dependency-cruiser 0 violations (149 modules / 483 edges). Knip 32 baseline, Prettier 11 baseline. Typed ESLint **664 diagnostics, 0 new, 12 resolved**.
- Built/restarted only `web` and `worker`; web HTTP 200 and healthy, worker healthy, log `Smart Wardrobe worker ready; image processing does not require AI`.
- Mocked mobile garment-details test after the inline fix: **1/1 PASS**. The earlier full desktop/mobile suite had 9 passes, 2 skips, and one reproducible mobile assertion addressed by this fix; registration/upload now requires two environment flags.
- **Warning:** two unconfirmed test accounts may remain from earlier non-isolated E2E; their identifiers are recorded above. No data was deleted. Full-monorepo refactoring remains ongoing.

## 2026-11-12 — Fastify Gemini route responsibilities

- `gemini-routes.ts` is now a small composition module; queue/Redis lifecycle is in `gemini-queue.ts`, shared error mapping/task loading in `gemini-route-utils.ts`, settings in `gemini-settings-routes.ts`, and generation/task lifecycle in `gemini-task-routes.ts`.
- Endpoints, methods, Zod schemas, error text, SQL/RPC, HTTP statuses, queue payloads, and cancellation behavior were preserved. Migrations and data were untouched.
- API typecheck PASS, focused API **9/9 PASS**; full Vitest **150/150 PASS**, dependency-cruiser **0** (153 modules / 501 edges), Knip 32 baseline, Prettier 11 baseline. After moving findings, ESLint baseline fingerprints were manually re-keyed for five route modules without hiding issues; current total **662**, 0 new, 12 resolved against baseline.
- Only API was rebuilt/restarted. API, worker, and web are healthy; web and `/api/health` return 200. API logs retain the existing Fastify `disableRequestLogging` deprecation warning.
- Remaining API modules (`session`, `queue-board`, `queue-controls`) and complete E2E isolation still need work.

## 2026-11-12 — property editor and survey separation

- Split `garment-properties.tsx` into `inline-property.tsx`, `custom-property-fields.tsx`, and `custom-property-manager.tsx`; updated imports without API/persistence changes. Removed old amount/list assertions and unsafe formatting of unknown values.
- Individual survey question editing moved to `style-question.tsx` with multi-select and skip tests. Local progress loading uses a type guard; navigation no longer declares an unnecessary async handler.
- Verification: Vitest **31 files / 151 tests PASS**; shared/web/API/worker TypeScript PASS; dependency-cruiser **0** (156 modules / 522 dependencies); ESLint **646 diagnostics**, 0 new and 40 fewer than baseline 686; Knip **32 baseline, 0 new**; Prettier **11 existing, 0 new**; web build PASS with the known approximately 802 kB warning.
- Mocked Playwright after rebuilding/restarting only `web`: auth, garment details, Gemini settings, survey/profile, and landing/protected routes passed desktop/mobile **10 PASS / 2 safe skips**. `web` returned HTTP 200; build/container recreation did not touch API, worker, database, or volumes.
- Data-writing E2E has not yet run in an isolated environment; the safety gate above remains. The overall refactor is still in progress, without commits.

## 2026-11-12 — inline editing and property API

- Coordination of one active editor, saving on field changes, and committing on outside clicks moved to `inline-edit-coordinator.tsx`. System/custom fields retain the same context.
- `garment-detail.tsx` uses explicit handlers without `no-misused-promises`, reads legacy orientation through a type guard, and accepts only valid enum values. ESLint fell to **631** (0 new, 55 fewer than the initial 686).
- Custom-property API was split into validation, definition/option routes, and value routes. Every non-generated Supabase result is parsed by Zod before use. Routes and operation order did not change.
- Both batches: Vitest **151/151**, full mock Playwright on the rebuilt web **10 PASS / 2 safe skips**, all workspace typechecks PASS, focused API **18/18 PASS**, graph **0** (162 modules / 541 edges), Knip 32 baseline, Prettier 11 existing. API/web Docker services healthy; `/api/health` HTTP 200.

## 2026-11-12 — image rotation pipeline extraction

- `use-garment-rotation.ts` manages local previews, 800 ms debounce, request serialization, retries, and waiting for a new file revision. `garment-detail.tsx` remains a view delegating this logic to the hook; API/revision semantics and originals are unchanged.
- Full Vitest **151/151 PASS**, shared/web/API/worker typecheck PASS, dependency-cruiser **0** (163 modules / 546 edges), ESLint **631** (0 new against baseline), Knip 32 baseline. Production web build PASS (802.36 kB, existing bundle warning).
- Mock Playwright on the rebuilt web: **10 PASS / 2 safe skips**; garment details/rotation passed desktop/mobile. API/web healthy, `/api/health` HTTP 200. Only web/API were restarted in their corresponding stages; no database/volume changes.

## 2026-11-12 — shared style profile separation

- `style-profile.ts` is a compatible barrel; answer validation, types, and hard constraints live in `style-profile-schemas.ts`, while 30 question definitions, counters, and Polish labels live in `style-profile-questions.ts`.
- Removed unsafe assertions from answer counting/labels. `styleAnswerKeys` is an explicit tuple; a test verifies all 30 schema/question keys match.
- Verification: Vitest **151/151 PASS**, shared/web/API/worker TypeScript PASS, dependency-cruiser **0** (165 modules / 549 edges), ESLint **627** (0 new, 59 fewer than 686), Knip 32 baseline. Web/API/worker were selectively rebuilt/restarted because all import shared code; all three healthy, API health HTTP 200, post-build mock Playwright 10 PASS/2 safe skips.

## Directory reorganization — 2026-11-12

- **DONE:** physical web feature-first, domain API, worker jobs/pipelines/integrations structure; Compose imports and migrator paths corrected.
- **DONE:** entry points match scripts, new public web feature indexes, `check-src-layout` added to `pnpm check`.
- **Verification:** 151 Vitest tests, all application/package TypeScript checks, Docker web/API/worker builds, dependency-cruiser 0 errors (176 modules/562 dependencies), E2E 10 passes/2 skipped write flows. Existing baseline: ESLint 627 (0 new, 47 resolved), Knip 32 (0 new), Prettier 11 (0 new).

## 2026-11-15 — global formatting standard (separate request)

- Applied `style:fix` across the monorepo: 204 files; the second pass produced no
  byte changes. `style:check` is the strict first check in `pnpm check`.
- Full ESLint and a separate stylistic-only configuration jointly check
  imports and logical spacing. Prettier remains
  responsible for indentation and line wrapping. No packages were installed.
- Existing changes and feature-first organization were preserved; AST and
  JSON/YAML comparisons found no logic/data changes. Import order in files
  initializing side effects remained unchanged.
- Verification: `pnpm check` PASS, 231 Vitest tests, types/build/deps/i18n/layout PASS,
  ESLint 603 (0 nowych), Knip 32 (0 nowych). Dodatkowe izolowane UI E2E:
  18 PASS / 4 FAIL — existing garment-detail and Gemini settings scenarios
  expect Polish without selecting a language; they remain for a separate fix.
- This stage only covers formatting and tooling configuration. It does not
  complete the remaining typing debt or planned refactoring.
