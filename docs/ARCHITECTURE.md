# Smart Wardrobe architecture after reorganization

## Web internationalization

The SPA uses `i18next` and `react-i18next`, initialized in `apps/web/src/app/i18n/` before the router. English (`en`) is the default and fallback; only `en` and `pl` are supported. The app deliberately does not detect browser or location language. The selected language is stored under `smart-wardrobe-language` in localStorage, updates `<html lang>`, and changes immediately from Settings without remounting the app.

Shared copy is in `apps/web/src/locales/{en,pl}/` (`common`, `navigation`, `validation`). Feature copy is colocated at `apps/web/src/features/<feature>/locales/{en,pl}.json`; i18n registers those feature namespaces centrally. Run `pnpm check:i18n` to verify matching keys and interpolation parameters. Keep enums and API contracts language-neutral; translate labels in the web layer. AI-generated outfit prose and text transcribed from garment labels remain source content, not static UI translations.

The source of all three applications was physically moved into feature modules. This changed paths and imports, without changing business logic, public HTTP routes, BullMQ payloads, or UI appearance.

## Actual structure

### `apps/web/src`

```text
web/src/
├── app
│   ├── providers
│   │   └── context.tsx
│   └── router
│       └── main.tsx
├── components
│   ├── layout
│   │   ├── app-navigation.tsx
│   │   └── wardrobe-picker.tsx
│   └── ui
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── dropdown-select.test.tsx
│       └── dropdown-select.tsx
├── features
│   ├── auth
│   │   ├── pages
│   │   │   ├── auth.tsx
│   │   │   └── landing.tsx
│   │   └── index.ts
│   ├── bulk-upload
│   │   ├── hooks
│   │   │   └── bulk-upload-context.tsx
│   │   ├── lib
│   │   │   └── bulk-queue.ts
│   │   ├── pages
│   │   │   └── bulk-upload.tsx
│   │   └── index.ts
│   ├── catalog
│   │   ├── components
│   │   │   └── garment-card.tsx
│   │   ├── pages
│   │   │   └── catalog.tsx
│   │   └── index.ts
│   ├── dashboard
│   │   ├── pages
│   │   │   └── dashboard.tsx
│   │   └── index.ts
│   ├── family
│   │   ├── pages
│   │   │   └── family.tsx
│   │   └── index.ts
│   ├── garments
│   │   ├── components
│   │   │   ├── garment-metadata.tsx
│   │   │   └── garment-outfits.tsx
│   │   ├── custom-properties
│   │   │   ├── custom-property-fields.tsx
│   │   │   ├── custom-property-manager.tsx
│   │   │   └── inline-property.tsx
│   │   ├── hooks
│   │   │   ├── inline-edit-coordinator.tsx
│   │   │   ├── use-garment-rotation.ts
│   │   │   └── use-garment-warmth.ts
│   │   ├── pages
│   │   │   ├── garment-detail.tsx
│   │   │   └── garments.tsx
│   │   └── index.ts
│   ├── image-analysis
│   │   ├── components
│   │   │   ├── garment-processing.tsx
│   │   │   ├── image-analysis-details.tsx
│   │   │   └── image-analysis.tsx
│   │   ├── hooks
│   │   │   └── analysis-activity.ts
│   │   └── index.ts
│   ├── laundry
│   │   ├── pages
│   │   │   └── laundry.tsx
│   │   └── index.ts
│   ├── outfits
│   │   ├── api
│   │   │   └── recommendation-request.ts
│   │   ├── pages
│   │   │   └── outfits.tsx
│   │   └── index.ts
│   ├── settings
│   │   ├── components
│   │   │   └── gemini-settings.tsx
│   │   ├── pages
│   │   │   └── settings.tsx
│   │   └── index.ts
│   └── style-profile
│       ├── __tests__
│       │   └── style-question.test.tsx
│       ├── components
│       │   └── style-question.tsx
│       ├── pages
│       │   ├── style-profile.tsx
│       │   └── style-survey.tsx
│       └── index.ts
├── lib
│   └── api
│       └── client.ts
├── styles
│   └── app.css
├── test
│   └── setup.ts
├── main.tsx
└── vite-env.d.ts
```

### `apps/api/src`

```text
api/src/
├── app
│   ├── app.ts
│   ├── config.ts
│   ├── migrate.ts
│   ├── origins.ts
│   └── server.ts
├── lib
│   └── route-utils.ts
├── modules
│   ├── auth
│   │   ├── routes.ts
│   │   ├── session-crypto.ts
│   │   └── session.ts
│   ├── garments
│   │   ├── custom-properties
│   │   │   ├── definitions.ts
│   │   │   ├── routes.ts
│   │   │   ├── validation.ts
│   │   │   └── values.ts
│   │   └── routes.ts
│   ├── gemini
│   │   ├── gemini-crypto.ts
│   │   ├── gemini-queue.ts
│   │   ├── route-utils.ts
│   │   ├── routes.ts
│   │   ├── settings-routes.ts
│   │   └── task-routes.ts
│   ├── images
│   │   ├── routes.ts
│   │   └── storage.ts
│   ├── jobs
│   │   └── routes.ts
│   ├── outfits
│   │   └── routes.ts
│   ├── profile
│   │   └── routes.ts
│   ├── queues
│   │   ├── queue-board.ts
│   │   └── queue-controls.ts
│   └── wardrobes
│       └── routes.ts
└── index.ts
```

### `apps/worker/src`

```text
worker/src/
├── app
│   ├── queue-policy.ts
│   └── worker.ts
├── integrations
│   ├── gemini
│   │   ├── credentials.ts
│   │   ├── errors.ts
│   │   ├── limiter.ts
│   │   ├── provider.ts
│   │   └── worker.ts
│   └── ollama
│       └── providers.ts
├── jobs
│   ├── cleanup
│   │   └── wardrobe-cleanup.ts
│   ├── garment-analysis
│   │   └── fashion.ts
│   ├── outbox
│   │   └── outbox-dispatcher.ts
│   ├── outfit-generation
│   │   └── gemini-outfits.ts
│   ├── job-cancellation.ts
│   └── processors.ts
├── pipelines
│   └── images
│       ├── mask.ts
│       └── pipeline.ts
└── index.ts
```

## Responsibilities and dependencies

- **Web `app/`**: SPA bootstrap, router, and shared application provider/context. `main.tsx` remains the required Vite entry point; `vite-env.d.ts` contains plugin declarations.
- **Web `features/`**: public imports between modules use root `index.ts` entry points; feature pages and components stay local. Modules cover auth, bulk upload, catalog, dashboard, family, garments, image analysis, laundry, outfits, settings, and style profiles. Custom property code and garment hooks belong to `garments`.
- **Web `components/`**: navigation/layout and UI controls shared across features. `lib/api/client.ts` is the shared HTTP transport; outfit-specific requests stay in `features/outfits/api`. Features expose externally used items through `features/<name>/index.ts`; outside importers must not access their `pages/`, `components/`, or `hooks/` implementations.
- **API `app/`**: configuration, Fastify/server initialization, origins, and the migrator invoked by existing scripts. `index.ts` remains the tsx entry point.
- **API `modules/`**: endpoints and operations grouped by domain. Sessions and session encryption belong to `auth`; custom properties to `garments`; Gemini keys, limits, and queues to `gemini`; images, jobs, queues, outfits, profiles, and wardrobes have their own modules. `lib/route-utils.ts` contains only shared HTTP utilities.
- **Worker `app/`**: connection/worker creation, health checks, graceful shutdown, and queue retention policy. `src/index.ts` remains the compatible entry point.
- **Worker `jobs/`**: job handlers/orchestration, garment analysis, outfit generation, outbox, cleanup, and cancellation. `pipelines/images/` contains the Sharp/ONNX pipeline. `integrations/gemini` and `integrations/ollama` contain AI adapters.
- **`packages/shared`** remains the source of Zod contracts, types, and shared pure logic; it does not import applications.

Dependencies flow from applications to `packages/shared`; web communicates with API over HTTP; API stores authorized jobs, and the worker executes them through BullMQ/Redis and narrow internal operations. No new cross-application dependencies were added.

## Justification for files next to `src/`

- `apps/web/src/main.tsx` — required by `apps/web/index.html`; delegates execution to router/bootstrap in `app/router/main.tsx`.
- `apps/web/src/vite-env.d.ts` — Vite/PWA plugin type declarations recognized by TypeScript.
- `apps/api/src/index.ts` — stable entry point used by the API package’s `tsx` script and container image.
- `apps/worker/src/index.ts` — stable entry point used by the `tsx` script and worker container.
- `apps/web/src/test/setup.ts` stays in a separate nested test configuration directory, rather than being placed directly in `src/`.
- The former `apps/web/src/other-pages.tsx` only aggregated re-exports; it was removed after switching the router to public feature interfaces, without deleting views.

## Rules for new files

1. Put pages, hooks, queries/mutations, components, and pure functions in their owning `features/<feature>/` and responsibility-specific subdirectory.
2. Put API routes and business modules in `apps/api/src/modules/<domain>/`; Fastify composition and configuration belong only in `app/`.
3. Put job code in `apps/worker/src/jobs/<job-family>/`, processing in the appropriate `pipelines/`, and external integrations in `integrations/`.
4. `src/` must not receive new domain files. Run `node scripts/check-src-layout.mjs`; the rule is also included in `pnpm check`.
5. Do not create empty folders, unnecessary barrel exports, or layers solely to satisfy a pattern. Preserve query keys, invalidation, statuses, and API behavior.
6. Do not import web/API/worker implementations across applications. Use `packages/shared` only for genuinely shared contracts and pure logic.

## Adding features

- **New web page**: put the page component in `apps/web/src/features/<feature>/pages/`, add a route in `apps/web/src/app/router/main.tsx`, and keep feature-specific components in that feature.
- **New web hook or request**: hooks go in `features/<feature>/hooks`, queries/mutations in `features/<feature>/api`; general transport stays in `lib/api/client.ts`.
- **New endpoint**: put the route in `apps/api/src/modules/<domain>/routes.ts` and register it in `apps/api/src/app/app.ts`; preserve Zod validation, sessions, membership checks, and RLS.
- **New BullMQ job**: put the handler in `apps/worker/src/jobs/<family>/` and register it through `app/worker.ts` or `jobs/processors.ts`; keep payloads small, validated, and idempotent.

## Relocation register

The list records old and new paths. Names were preserved; the new module defines ownership.

| Old path                                             | New path                                                                       | Responsibility                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| `apps/web/src/main.tsx`                              | `apps/web/src/app/router/main.tsx`                                             | layout, bootstrap or web infrastructure       |
| `apps/web/src/styles.css`                            | `apps/web/src/styles/app.css`                                                  | layout, bootstrap or web infrastructure       |
| `apps/web/src/context.tsx`                           | `apps/web/src/app/providers/context.tsx`                                       | layout, bootstrap or web infrastructure       |
| `apps/web/src/api.ts`                                | `apps/web/src/lib/api/client.ts`                                               | layout, bootstrap or web infrastructure       |
| `apps/web/src/auth.tsx`                              | `apps/web/src/features/auth/pages/auth.tsx`                                    | authentication and landing page               |
| `apps/web/src/landing.tsx`                           | `apps/web/src/features/auth/pages/landing.tsx`                                 | authentication and landing page               |
| `apps/web/src/app-navigation.tsx`                    | `apps/web/src/components/layout/app-navigation.tsx`                            | layout, bootstrap or web infrastructure       |
| `apps/web/src/wardrobe-picker.tsx`                   | `apps/web/src/components/layout/wardrobe-picker.tsx`                           | layout, bootstrap or web infrastructure       |
| `apps/web/src/bulk-upload.tsx`                       | `apps/web/src/features/bulk-upload/pages/bulk-upload.tsx`                      | masowy upload                                 |
| `apps/web/src/bulk-upload-context.tsx`               | `apps/web/src/features/bulk-upload/hooks/bulk-upload-context.tsx`              | masowy upload                                 |
| `apps/web/src/bulk-queue.ts`                         | `apps/web/src/features/bulk-upload/lib/bulk-queue.ts`                          | masowy upload                                 |
| `apps/web/src/catalog.tsx`                           | `apps/web/src/features/catalog/pages/catalog.tsx`                              | catalog and garment cards                     |
| `apps/web/src/dashboard.tsx`                         | `apps/web/src/features/dashboard/pages/dashboard.tsx`                          | layout, bootstrap or web infrastructure       |
| `apps/web/src/garments.tsx`                          | `apps/web/src/features/garments/pages/garments.tsx`                            | garments and their properties                 |
| `apps/web/src/garment-detail.tsx`                    | `apps/web/src/features/garments/pages/garment-detail.tsx`                      | garments and their properties                 |
| `apps/web/src/garment-card.tsx`                      | `apps/web/src/features/catalog/components/garment-card.tsx`                    | catalog and garment cards                     |
| `apps/web/src/garment-metadata.tsx`                  | `apps/web/src/features/garments/components/garment-metadata.tsx`               | garments and their properties                 |
| `apps/web/src/garment-outfits.tsx`                   | `apps/web/src/features/garments/components/garment-outfits.tsx`                | garments and their properties                 |
| `apps/web/src/garment-processing.tsx`                | `apps/web/src/features/image-analysis/components/garment-processing.tsx`       | image analysis                                |
| `apps/web/src/image-analysis.tsx`                    | `apps/web/src/features/image-analysis/components/image-analysis.tsx`           | image analysis                                |
| `apps/web/src/image-analysis-details.tsx`            | `apps/web/src/features/image-analysis/components/image-analysis-details.tsx`   | image analysis                                |
| `apps/web/src/analysis-activity.ts`                  | `apps/web/src/features/image-analysis/hooks/analysis-activity.ts`              | image analysis                                |
| `apps/web/src/use-garment-rotation.ts`               | `apps/web/src/features/garments/hooks/use-garment-rotation.ts`                 | garments and their properties                 |
| `apps/web/src/use-garment-warmth.ts`                 | `apps/web/src/features/garments/hooks/use-garment-warmth.ts`                   | garments and their properties                 |
| `apps/web/src/inline-edit-coordinator.tsx`           | `apps/web/src/features/garments/hooks/inline-edit-coordinator.tsx`             | garments and their properties                 |
| `apps/web/src/inline-property.tsx`                   | `apps/web/src/features/garments/custom-properties/inline-property.tsx`         | garments and their properties                 |
| `apps/web/src/custom-property-fields.tsx`            | `apps/web/src/features/garments/custom-properties/custom-property-fields.tsx`  | garments and their properties                 |
| `apps/web/src/custom-property-manager.tsx`           | `apps/web/src/features/garments/custom-properties/custom-property-manager.tsx` | garments and their properties                 |
| `apps/web/src/family.tsx`                            | `apps/web/src/features/family/pages/family.tsx`                                | layout, bootstrap or web infrastructure       |
| `apps/web/src/laundry.tsx`                           | `apps/web/src/features/laundry/pages/laundry.tsx`                              | layout, bootstrap or web infrastructure       |
| `apps/web/src/outfits.tsx`                           | `apps/web/src/features/outfits/pages/outfits.tsx`                              | stylizacje                                    |
| `apps/web/src/recommendation-request.ts`             | `apps/web/src/features/outfits/api/recommendation-request.ts`                  | stylizacje                                    |
| `apps/web/src/settings.tsx`                          | `apps/web/src/features/settings/pages/settings.tsx`                            | ustawienia                                    |
| `apps/web/src/gemini-settings.tsx`                   | `apps/web/src/features/settings/components/gemini-settings.tsx`                | ustawienia                                    |
| `apps/web/src/style-profile.tsx`                     | `apps/web/src/features/style-profile/pages/style-profile.tsx`                  | style profile and questionnaire               |
| `apps/web/src/style-survey.tsx`                      | `apps/web/src/features/style-profile/pages/style-survey.tsx`                   | style profile and questionnaire               |
| `apps/web/src/style-question.tsx`                    | `apps/web/src/features/style-profile/components/style-question.tsx`            | style profile and questionnaire               |
| `apps/web/src/style-question.test.tsx`               | `apps/web/src/features/style-profile/__tests__/style-question.test.tsx`        | style profile and questionnaire               |
| `apps/api/src/app.ts`                                | `apps/api/src/app/app.ts`                                                      | bootstrap/configuration or shared HTTP        |
| `apps/api/src/server.ts`                             | `apps/api/src/app/server.ts`                                                   | bootstrap/configuration or shared HTTP        |
| `apps/api/src/config.ts`                             | `apps/api/src/app/config.ts`                                                   | bootstrap/configuration or shared HTTP        |
| `apps/api/src/origins.ts`                            | `apps/api/src/app/origins.ts`                                                  | bootstrap/configuration or shared HTTP        |
| `apps/api/src/session.ts`                            | `apps/api/src/modules/auth/session.ts`                                         | API module: auth                              |
| `apps/api/src/session-crypto.ts`                     | `apps/api/src/modules/auth/session-crypto.ts`                                  | API module: auth                              |
| `apps/api/src/gemini-crypto.ts`                      | `apps/api/src/modules/gemini/gemini-crypto.ts`                                 | API module: gemini                            |
| `apps/api/src/gemini-queue.ts`                       | `apps/api/src/modules/gemini/gemini-queue.ts`                                  | API module: gemini                            |
| `apps/api/src/gemini-route-utils.ts`                 | `apps/api/src/modules/gemini/route-utils.ts`                                   | API module: gemini                            |
| `apps/api/src/gemini-routes.ts`                      | `apps/api/src/modules/gemini/routes.ts`                                        | API module: gemini                            |
| `apps/api/src/gemini-settings-routes.ts`             | `apps/api/src/modules/gemini/settings-routes.ts`                               | API module: gemini                            |
| `apps/api/src/gemini-task-routes.ts`                 | `apps/api/src/modules/gemini/task-routes.ts`                                   | API module: gemini                            |
| `apps/api/src/images.ts`                             | `apps/api/src/modules/images/storage.ts`                                       | API module: images                            |
| `apps/api/src/queue-board.ts`                        | `apps/api/src/modules/queues/queue-board.ts`                                   | API module: queues                            |
| `apps/api/src/queue-controls.ts`                     | `apps/api/src/modules/queues/queue-controls.ts`                                | API module: queues                            |
| `apps/api/src/route-utils.ts`                        | `apps/api/src/lib/route-utils.ts`                                              | bootstrap/configuration or shared HTTP        |
| `apps/api/src/migrate.ts`                            | `apps/api/src/app/migrate.ts`                                                  | bootstrap/configuration or shared HTTP        |
| `apps/api/src/routes/auth.ts`                        | `apps/api/src/modules/auth/routes.ts`                                          | API module: auth                              |
| `apps/api/src/routes/profile.ts`                     | `apps/api/src/modules/profile/routes.ts`                                       | API module: profile                           |
| `apps/api/src/routes/wardrobes.ts`                   | `apps/api/src/modules/wardrobes/routes.ts`                                     | API module: wardrobes                         |
| `apps/api/src/routes/garments.ts`                    | `apps/api/src/modules/garments/routes.ts`                                      | API module: garments                          |
| `apps/api/src/routes/jobs.ts`                        | `apps/api/src/modules/jobs/routes.ts`                                          | API module: jobs                              |
| `apps/api/src/routes/outfits.ts`                     | `apps/api/src/modules/outfits/routes.ts`                                       | API module: outfits                           |
| `apps/api/src/routes/images.ts`                      | `apps/api/src/modules/images/routes.ts`                                        | API module: images                            |
| `apps/api/src/routes/custom-properties.ts`           | `apps/api/src/modules/garments/custom-properties/routes.ts`                    | API module: garments                          |
| `apps/api/src/routes/custom-property-definitions.ts` | `apps/api/src/modules/garments/custom-properties/definitions.ts`               | API module: garments                          |
| `apps/api/src/routes/custom-property-validation.ts`  | `apps/api/src/modules/garments/custom-properties/validation.ts`                | API module: garments                          |
| `apps/api/src/routes/custom-property-values.ts`      | `apps/api/src/modules/garments/custom-properties/values.ts`                    | API module: garments                          |
| `apps/worker/src/index.ts`                           | `apps/worker/src/app/worker.ts`                                                | job/pipeline/integracja workera: app          |
| `apps/worker/src/queue-policy.ts`                    | `apps/worker/src/app/queue-policy.ts`                                          | job/pipeline/integracja workera: app          |
| `apps/worker/src/job-processors.ts`                  | `apps/worker/src/jobs/processors.ts`                                           | job/pipeline/integracja workera: jobs         |
| `apps/worker/src/job-cancellation.ts`                | `apps/worker/src/jobs/job-cancellation.ts`                                     | job/pipeline/integracja workera: jobs         |
| `apps/worker/src/outbox-dispatcher.ts`               | `apps/worker/src/jobs/outbox/outbox-dispatcher.ts`                             | job/pipeline/integracja workera: jobs         |
| `apps/worker/src/wardrobe-cleanup.ts`                | `apps/worker/src/jobs/cleanup/wardrobe-cleanup.ts`                             | job/pipeline/integracja workera: jobs         |
| `apps/worker/src/fashion.ts`                         | `apps/worker/src/jobs/garment-analysis/fashion.ts`                             | job/pipeline/integracja workera: jobs         |
| `apps/worker/src/gemini-outfits.ts`                  | `apps/worker/src/jobs/outfit-generation/gemini-outfits.ts`                     | job/pipeline/integracja workera: jobs         |
| `apps/worker/src/pipeline.ts`                        | `apps/worker/src/pipelines/images/pipeline.ts`                                 | job/pipeline/integracja workera: pipelines    |
| `apps/worker/src/mask.ts`                            | `apps/worker/src/pipelines/images/mask.ts`                                     | job/pipeline/integracja workera: pipelines    |
| `apps/worker/src/gemini-credentials.ts`              | `apps/worker/src/integrations/gemini/credentials.ts`                           | job/pipeline/integracja workera: integrations |
| `apps/worker/src/gemini-errors.ts`                   | `apps/worker/src/integrations/gemini/errors.ts`                                | job/pipeline/integracja workera: integrations |
| `apps/worker/src/gemini-limiter.ts`                  | `apps/worker/src/integrations/gemini/limiter.ts`                               | job/pipeline/integracja workera: integrations |
| `apps/worker/src/gemini-provider.ts`                 | `apps/worker/src/integrations/gemini/provider.ts`                              | job/pipeline/integracja workera: integrations |
| `apps/worker/src/gemini-worker.ts`                   | `apps/worker/src/integrations/gemini/worker.ts`                                | job/pipeline/integracja workera: integrations |
| `apps/worker/src/providers.ts`                       | `apps/worker/src/integrations/ollama/providers.ts`                             | job/pipeline/integracja workera: integrations |

## Travel Packing

- **Web**: `features/travel-packing/` owns the trip form (React Hook Form + Zod), interactive checklist, quantities, garment selection, query/mutation orchestration, saved-list navigation and feature-local EN/PL resources. `/travel-packing` is an authenticated route and a separate navigation entry.
- **Shared**: `travel-packing.ts` defines trip, AI response, persisted list/item schemas, quantity invariants, shortage/progress calculations and deterministic metadata ranking. Generated content carries its own language in the trip; interface language changes never rewrite saved content.
- **API**: `modules/travel-packing/routes.ts` registers generation and list endpoints. CRUD and recommendations use the user's token and RLS. Generation uses a narrow BFF-only task RPC, with the existing global queue limit and one-active-task guard. No service-role client is introduced.
- **Worker**: `jobs/travel-packing/generate.ts` constructs a separate prompt and validates the result before assigning application UUIDs and storing it. `integrations/gemini/worker.ts` dispatches the new task kind through the existing provider, credentials, limiter, retries, timeout and cancellation. Existing outfit prompts and queue settings remain intact. The existing task-table dispatcher recovers queued packing tasks too.
- **Storage**: additive migration `0025_travel_packing.sql` adds `packing_lists` with owner and wardrobe membership RLS. Its invoker trigger checks each assigned garment through caller RLS, enforces physical quantities and explicit reuse consent. Assignments are JSON UUIDs rather than cascading foreign keys: deleting a garment preserves the list and packed counts; API reads prune assignments to inaccessible/deleted/archived garments.

See [Travel Packing](travel-packing.md) for endpoints, limitations, migration and test instructions.

Travel Packing completeness uses a deterministic bilingual item catalog and per-type rules in `packages/shared/src/travel-packing/`. `jobs/travel-packing/generate.ts` merges bounded AI adjustments/additions with that base, restores essential minima, deduplicates concrete types and returns a marked baseline on provider/validation failure. Generation-only optional item metadata is stored in the existing JSON array, so old lists require no migration or rewrite. The frontend groups rows into translated sections without changing saved data. Specific garment-type filtering is separate from packing taxonomy and preserves garment/RLS contracts.

## Remember me and session renewal

Auth owns the `rememberMe` login field. The BFF persists the choice inside its encrypted session payload; remembered sessions have a renewable 30-day opaque HttpOnly cookie, browser-only sessions omit persistent cookie expiry and have a 12-hour server limit. Old payloads remain compatible. Provider token refresh still uses a row lock. Transient authentication-service failures preserve the cookie and return 503 instead of forcing login. No session-table migration, browser token storage or RLS bypass is introduced. See [Login persistence](auth-sessions.md).

## Style profile 2.0

The survey and “My style” remain in `apps/web/src/features/style-profile/`.
The shared style/color catalog, Zod, `StyleProfileSummary`, answer interpretation,
contextual rules, and constraint/preference evaluation live in
`packages/shared/src/style-profile-*.ts`. The UI and active Gemini worker use
the same functions. Restrictions reject outfits, while preferences change their ranking.
The BFF continues saving additive patches through `merge_my_style_answers` with the
user token. `schema_version: 1` and q01–q30 answers remain compatible; four
new fields are optional and require neither a migration nor completing the survey again.
Details: [style survey 2.0](style-profile.md).
