# Smart Wardrobe

Self-hosted React SPA with English and Polish interfaces. Use one standalone root Compose file per deployment: `docker-compose.prod.yml` for production or `docker-compose.yml` for the full development/admin stack. Never layer these two files.

- apps/web: Vite/React, TanStack Router/Query, Tailwind, shadcn-style Radix components.
- apps/api: Fastify BFF. Only public API entry. Supabase requests use the user's access token, never service_role.
- apps/worker: BullMQ, durable PostgreSQL job outbox, narrow internal service operations.
- packages/shared: Zod schemas, domain types, typed endpoint contracts.
- supabase/migrations: ordered, immutable SQL migrations, transaction and checksum enforced.
- infra/supabase: vendored official 0.8.4 configuration; provenance.json records source hashes.

Use Node 26 LTS and pnpm 12. Commands: pnpm install, pnpm typecheck, pnpm lint, pnpm test, pnpm build, pnpm test:e2e, pnpm test:stack. Production setup: node scripts/setup.mjs; docker compose -f docker-compose.prod.yml up -d --build. The full development stack uses docker-compose.yml.

After each code/configuration change, run the narrow relevant check; before finishing a milestone run `pnpm check` (format, typed ESLint baseline, monorepo typecheck, Vitest, dependency boundaries/cycles, Knip baseline, and build). Do not mass-fix lint/format findings unless the user explicitly requests repository-wide formatting; keep that work limited to stylistic fixes. Review baseline changes before updating `docs/quality/*-baseline.json` or `.dependency-cruiser-known-violations.json`. See [`docs/CODE_QUALITY.md`](docs/CODE_QUALITY.md).

Never commit .env or secrets. Do not publish privileged Supabase ports. All business tables require RLS; test with two separate users. Session tokens stay server-side and encrypted. Do not log cookies, passwords, authorization headers or reset codes. Only static assets may enter PWA caches. Keep Polish labels and keyboard/mobile accessibility. No fabricated AI or garment images. Update docs/progress.md after milestones. Do not delete volumes for tests.

UI conventions: follow [`docs/ui-guidelines.md`](docs/ui-guidelines.md) for daisyUI theme tokens, Tailwind usage, and interactive components.

## Internationalization

- English (`en`) is the base and default UI language; Polish (`pl`) is also supported. Do not infer language from browser, IP, or location.
- Every new user-facing string must use `i18next`/`react-i18next`; add matching semantic keys to both English and Polish resources.
- Keep feature-specific resources beside their feature in `locales/`; shared navigation, common UI, and validation text belong in `apps/web/src/locales/`.
- Never add user-facing text directly to components, hooks, toasts, accessibility labels, or dropdown options. Keep API enums and identifiers unchanged and translate only their display labels.
- Run `pnpm check:i18n` after editing translation resources. Add new languages without changing domain/API contracts.

## Readability and formatting

- Keep Prettier as the formatter; do not format the entire repository for a local change.
- Group imports in this order: React and external libraries, `@wardrobe/*` packages, shared infrastructure, other features, and local files. Separate groups with a blank line.
- Separate logical code sections with a blank line, especially function declarations, larger statement blocks, and `return`; do not mechanically insert blank lines between every statement.
- Avoid large JSX blocks. Extract components when this improves readability or isolates a responsibility, and keep business logic outside the presentation layer.
- Place files by feature according to the architecture. Do not split simple code into abstractions without a clear benefit.
- Apply appropriate formatting after changes (`pnpm style:fix` for an explicitly requested repository-wide cleanup, or local Prettier and stylistic ESLint for changed files), and run `pnpm style:check` before finishing. Formatting is not a substitute for refactoring: do not join declarations, functions, and JSX into huge blocks, or add comments and blank lines merely to make files longer.
- ESLint checks import ordering and readable spacing globally; side effect imports retain their evaluation order. Tools cannot reliably identify semantic code sections. Before adding exceptions, check whether the issue comes from the rule or an incorrect module boundary.

Before any broad refactor, read [`docs/CODEBASE_AUDIT.md`](docs/CODEBASE_AUDIT.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md). Do not begin a planned refactor before the user accepts the plan. The working tree may contain user-owned uncommitted changes: inspect and preserve each touched file's existing diff; never stash/reset/clean or overwrite it. Run data-writing E2E only against an explicitly isolated test environment with guaranteed cleanup. After each accepted refactor stage update [`docs/REFACTOR_PROGRESS.md`](docs/REFACTOR_PROGRESS.md), run focused tests/typecheck/lint/dependency checks, and use `pnpm check` at major milestones. Never mark a module DONE without that verification.

## Code organization

Organize code by feature. Every new file belongs in its owning module; do not create flat directories of unrelated components, hooks, services, or helpers. Avoid unnecessary abstractions, empty directories, and duplicate modules. Do not add files directly to `apps/*/src/` without justification. Respect feature boundaries. Follow the actual structure and rules in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); `node scripts/check-src-layout.mjs` ensures that `src/` directories contain only justified entry points and tooling declarations.

## Travel Packing

Travel Packing is a separate feature at `/travel-packing`; preserve the outfit generator and its prompts. Web code belongs in `features/travel-packing`, API routes in `modules/travel-packing`, and worker generation in `jobs/travel-packing`. Reuse the existing encrypted Gemini credentials, queue, limiter, retry, cancellation and outbox recovery. Shared packing contracts and deterministic garment ranking live in `packages/shared/src/travel-packing.ts`. Never accept garment IDs from the model. List reads/writes and recommendation reads use the user's Supabase client; migration `0025_travel_packing.sql` adds owner/member RLS and validates physical garment assignments. AI prose is saved in the requested language, independently of UI translations. Required, assigned and packed counts are distinct. Test SQL only in an isolated database; do not apply migrations to the application database without authorization. See `docs/travel-packing.md`.

Travel Packing completeness is guaranteed by the generation-only catalog/rules in `packages/shared/src/travel-packing/`, not by prompt wording. Gemini enriches that base; normalization restores missing essentials and a provider failure returns a visibly labelled baseline (never after explicit cancellation). Do not apply completeness repair to saved-list reads/edits or infer personal/gender-specific needs. Keep detailed packing groups separate from garment categories.

## English-first source and documentation

All source code, identifiers, comments, technical messages, logs, tests, developer instructions, README files, and documentation must be written in English. User-facing content must use i18n with English as the default locale and Polish as a supported translation.

New features must provide both `en` and `pl` translations. Do not hardcode UI text in JSX. API errors should use stable codes with safe English technical messages and localized frontend display. Do not translate user data, saved generated content, or existing identifiers. Intentional multilingual normalization vocabularies and immutable applied migrations retain their original values.

When introducing or significantly modifying a feature, update the relevant developer documentation, including the feature map, API references, migration instructions, and development examples when applicable.

## Production Compose

`node scripts/compose.mjs` generates both standalone variants and the production Envoy files; `--check` verifies reproducibility without writes. `scripts/compose-production.mjs` derives production from the full file, removing optional Supabase services and their routes/clusters while retaining upstream API-key/RBAC behavior. Keep existing named-volume identities and private Storage binds. Do not modify vendored upstream files or remove `imgproxy` without separately validating Storage. Never apply production changes to the existing account database during tests; use isolated containers and mock backends.
