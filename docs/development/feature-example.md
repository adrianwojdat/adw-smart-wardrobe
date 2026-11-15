# Complete example: adding wardrobe reminders

[Guide contents](README.md)

This is a **documentation-only proposal**, not an implemented feature. Every path marked proposed below is a file to create in a future task. Existing integration points are named explicitly. The example adds a personal reminder attached to a wardrobe, such as reviewing seasonal clothing on a chosen date. It deliberately does not need AI or background notifications: a due-date list is enough. Do not add a queue just because other features use one.

## 1. Define requirements and boundaries

A signed-in user can create, view, complete and delete their own reminders for an accessible wardrobe. A viewer must not edit wardrobe-wide data; this proposal stores personal reminders and must explicitly define whether viewer members may create their own. Losing wardrobe access hides reminders. No emails, browser push, automatic wardrobe edits, or real-account test writes are part of the initial scope.

Specify empty/loading/error states, editable title, optional due date, completed status, date semantics, keyboard interaction and English/Polish labels. Define maximum title length and list bounds before designing endpoints.

## 2. Design data and migration

Proposed `public.wardrobe_reminders`: UUID primary key, `user_id` referencing Auth users, `wardrobe_id` referencing wardrobes, bounded nonempty `title`, nullable date `due_on`, boolean `completed`, and timestamps. Choose delete behavior deliberately: reminder rows can cascade with the owning user/wardrobe, without changing existing garment data. Index owner/wardrobe and the chosen sorting/filter fields.

Create proposed `supabase/migrations/0026_wardrobe_reminders.sql` **only if 0026 is still the next unused number**. Enable RLS. Every read/write policy must require the row owner and current wardrobe access. Insert/update `WITH CHECK` must prevent ownership transfer or moving a reminder into an inaccessible wardrobe. Decide whether `has_wardrobe_access(..., editing => true)` is necessary based on the agreed viewer requirement, not convenience. Grant only needed authenticated operations. No service-role BFF path is needed.

Test on an isolated database with two users, multiple wardrobes and removed membership. Run the project's custom migrator as described in [database development](database-jobs-ai.md#how-to-add-a-database-migration), inspect the migration ledger and never edit applied SQL.

## 3. Add shared validation and types

Create proposed `packages/shared/src/wardrobe-reminders.ts` with input, patch and output schemas; export the intended public schemas/types through `packages/shared/src/index.ts`. For example:

```ts
import { z } from 'zod';

export const reminderInputSchema = z.object({
  wardrobe_id: z.uuid(),
  title: z.string().trim().min(1).max(160),
  due_on: z.iso.date().nullable(),
});

export const reminderSchema = reminderInputSchema.extend({
  id: z.uuid(),
  user_id: z.uuid(),
  completed: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
});

export type Reminder = z.infer<typeof reminderSchema>;
```

Define patch keys explicitly; do not accept client-controlled `user_id`. Runtime schema parsing, database checks and RLS serve different purposes and all remain necessary. Match output timestamp serialization to actual PostgREST responses.

## 4. Add the API and business logic

Create proposed `apps/api/src/modules/wardrobe-reminders/routes.ts` exporting `registerWardrobeReminderRoutes(app: ApiServer, session: SessionService)`. Register it from existing `apps/api/src/app/app.ts` alongside other business modules.

Proposed endpoints: `GET /api/wardrobe-reminders?wardrobe_id=...`, `POST /api/wardrobe-reminders`, `PATCH /api/wardrobe-reminders/:id`, and `DELETE /api/wardrobe-reminders/:id`. These do not exist yet. Validate UUIDs/query/body, load `session.load(req, reply)`, derive ownership from `user.id`, and query using `sb`. Use existing `checked` from `apps/api/src/lib/route-utils.ts`. Parse returned rows with `reminderSchema`, return safe error codes/messages, and retain RLS on every operation. Extract substantial business logic into a service inside this same new module if needed; a trivial select does not need an abstraction layer.

## 5. Add the frontend API and Query hook

Proposed `apps/web/src/features/wardrobe-reminders/api/reminder-api.ts` imports the existing `request` from `../../../lib/api/client` and shared schemas. Its list call would be:

```ts
export const listReminders = (wardrobeId: string) =>
  request(
    `/api/wardrobe-reminders?wardrobe_id=${encodeURIComponent(wardrobeId)}`,
    z.array(reminderSchema),
  );
```

Import `z` from Zod and `reminderSchema` from shared. Add mutation wrappers using POST/PATCH/DELETE and their actual response schemas; the existing request helper supplies CSRF and same-origin credentials.

Create proposed `hooks/useReminders.ts` using `useQuery({ queryKey: ['wardrobe-reminders', wardrobeId], queryFn: ... , enabled: !!wardrobeId })`. Mutation hooks invalidate that wardrobe's key after success. Do not invalidate unrelated wardrobe/image queries. Keep unfinished form data local; preserve it on failure.

## 6. Add UI, route and navigation

Create proposed `pages/WardrobeRemindersPage.tsx`, `components/ReminderForm.tsx` and `components/ReminderList.tsx` under the feature. Use RHF/Zod, existing UI primitives and translated validation. Obtain the active wardrobe through existing `useWardrobe`. Show distinct empty/loading/error states, accessible completion controls and responsive spacing.

Export the page from proposed feature `index.ts`. In existing `apps/web/src/app/router/main.tsx`, create a private route and add it to the private child list. Update existing `apps/web/src/components/layout/app-navigation.tsx` and both navigation locale resources. Confirm desktop sidebar and mobile entry points.

Proposed file map:

```text
packages/shared/src/wardrobe-reminders.ts
supabase/migrations/0026_wardrobe_reminders.sql
apps/api/src/modules/wardrobe-reminders/routes.ts
apps/web/src/features/wardrobe-reminders/
  index.ts
  api/reminder-api.ts
  hooks/useReminders.ts
  pages/WardrobeRemindersPage.tsx
  components/ReminderForm.tsx
  components/ReminderList.tsx
  locales/en.json
  locales/pl.json
  __tests__/reminders.test.tsx
tests/wardrobe-reminders-api.test.ts
tests/wardrobe-reminders-rls.sql
tests/e2e/wardrobe-reminders.spec.ts
```

## 7. Add translations and tests

Register the proposed `wardrobeReminders` namespace in existing `apps/web/src/app/i18n/index.ts`. Add matching keys in both resources for headings, actions, dates, validation, empty states and error feedback. IDs and saved reminder text remain unchanged when the language changes.

Test shared validation, title bounds, optional date, partial updates and serialization. API tests mock session/database behavior and verify status/error shapes. Isolated SQL tests verify row ownership, wardrobe membership, malicious changes and deletion behavior. RTL tests cover form validation and completion interactions in both languages. Mocked Playwright tests cover create/complete/reload on an isolated in-browser fixture; real persistence tests use a separately isolated stack and never the existing account.

## 8. Verify and deploy safely

Run focused tests during implementation, format changed files, then `pnpm check:i18n`, relevant dependency/layout checks and `pnpm check`. Run browser tests on desktop/mobile with no real-account writes. Update the guide's feature map, API references and migration notes when the feature actually exists.

Review the additive migration, take a backup, rehearse on an isolated copy and deploy with the root Compose flow. Inspect migration/API logs and read-only health checks, then verify the new flow with authorized disposable test data. Keep an old compatible application image available; schema rollback is a separate reviewed operation.

## Development checklist

- [ ] I inspected existing modules, contracts and feature patterns.
- [ ] I placed code inside its owning feature/module and respected import boundaries.
- [ ] I defined shared types and runtime validation without unsafe casts.
- [ ] I secured user data with session identity, authorization and RLS.
- [ ] I added an immutable ordered migration if needed, with grants/indexes/policies.
- [ ] I preserved existing data, identifiers, saved content and backward compatibility.
- [ ] I provided English and Polish i18n resources, including errors and accessibility labels.
- [ ] I tested rules, validation, UI behavior, API failures and cross-user access.
- [ ] I mocked AI; any data-writing integration/E2E ran only in an isolated environment.
- [ ] I formatted changed files and checked style without unrelated rewrites.
- [ ] I ran `pnpm check` and reviewed baseline changes rather than hiding new debt.
- [ ] I checked desktop/mobile behavior and keyboard access where applicable.
- [ ] I updated feature/API/developer documentation and deployment/migration guidance.
