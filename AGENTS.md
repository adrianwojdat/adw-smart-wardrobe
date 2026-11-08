# Smart Wardrobe

Polish, self-hosted React SPA. One root docker-compose.yml owns the full stack.

- apps/web: Vite/React, TanStack Router/Query, Tailwind, shadcn-style Radix components.
- apps/api: Fastify BFF. Only public API entry. Supabase requests use the user's access token, never service_role.
- apps/worker: BullMQ, durable PostgreSQL job outbox, narrow internal service operations.
- packages/shared: Zod schemas, domain types, typed endpoint contracts.
- supabase/migrations: ordered, immutable SQL migrations, transaction and checksum enforced.
- infra/supabase: vendored official 0.8.4 configuration; provenance.json records source hashes.

Use Node 26 LTS and pnpm 12. Commands: pnpm install, pnpm typecheck, pnpm lint, pnpm test, pnpm build, pnpm test:e2e, pnpm test:stack. Setup: node scripts/setup.mjs; docker compose up -d --build.

Never commit .env or secrets. Do not publish privileged Supabase ports. All business tables require RLS; test with two separate users. Session tokens stay server-side and encrypted. Do not log cookies, passwords, authorization headers or reset codes. Only static assets may enter PWA caches. Keep Polish labels and keyboard/mobile accessibility. No fabricated AI or garment images. Update docs/progress.md after milestones. Do not delete volumes for tests.
