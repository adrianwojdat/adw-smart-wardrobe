# Progress — Phase 1

Updated: 2026-11-08. Phase 1 working MVP implemented and verified locally.

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
