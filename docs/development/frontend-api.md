# Frontend and API development

[Guide contents](README.md)

## Frontend development

The entry `apps/web/src/main.tsx` delegates to `app/router/main.tsx`. Routes are declared in code with TanStack Router, not generated from filenames. The private route wraps authenticated pages in the existing shell/providers. TanStack Query owns server state; React state owns transient controls; React Hook Form owns form state. `app/providers/context.tsx` provides `useMe`, `useWardrobe`, shared feedback and the application shell. Do not introduce another global store for server data already managed by Query.

Features expose their public surface through `index.ts`; cross-feature imports must respect dependency-cruiser boundaries. Shared UI primitives live in `components/ui`, layout/navigation in `components/layout`. Use daisyUI theme tokens and existing Tailwind/component classes from [UI guidelines](../ui-guidelines.md); do not add a second design system or fixed light-theme colors.

### How to add a new page

1. Inspect a similar page, such as `features/travel-packing/pages/TravelPackingPage.tsx`, and its feature export.
2. Add the new page under its owning feature and export it from that feature's `index.ts`.
3. Import that export in `app/router/main.tsx`. Use `createRoute({ getParentRoute: () => privateRoute, path: '/your-path', component: YourPage })` and include the route in `privateRoute.addChildren`. Public auth routes use the appropriate public parent instead.
4. Add navigation in `components/layout/app-navigation.tsx` where appropriate, using `apps/web/src/locales/en/navigation.json` and its Polish counterpart. Check both sidebar and mobile navigation.
5. Reuse existing loading, error and empty states; add keyboard-accessible headings and responsive layout. Test direct route entry as well as navigation.

### How to add a new form

Use shared Zod schemas for requests the API accepts. UI-only constraints belong with the feature or existing form utilities in `apps/web/src/lib/`. `features/travel-packing/components/TripForm.tsx` demonstrates RHF, `zodResolver`, optional fields and translated labels. Use stable domain values in selects; translate their display text. Do not turn omitted values into arbitrary defaults or confuse `false` with an unanswered question.

The following is an abbreviated pattern using existing dependencies and schemas. Add its labels to the `travelPacking` resources before using it:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { tripSchema } from '@wardrobe/shared';

function TripFields() {
  const { t } = useTranslation('travelPacking');
  const form = useForm<z.infer<typeof tripSchema>>({ resolver: zodResolver(tripSchema) });

  return (
    <label>
      {t('destination')}
      <input {...form.register('destination')} aria-invalid={!!form.formState.errors.destination} />
    </label>
  );
}
```

This fragment is not a complete submit form: initialize required wardrobe/language values, register other fields, localize validation, and handle mutation errors as the actual TripForm does. Shared schema error messages are technical English; use the existing localized validation helpers rather than showing raw Zod text in Polish UI.

### How to fetch data

Use `request` from `apps/web/src/lib/api/client.ts`; it sends same-origin credentials, attaches CSRF to mutations, parses response schemas and raises `ApiError`. Do not construct privileged Supabase clients in React. For general wardrobe data, existing `api` methods already paginate garments.

```tsx
import { useQuery } from '@tanstack/react-query';

import { api } from '../../../lib/api/client';

// Example in a feature's hooks/ directory.
export function useWardrobeGarments(wardrobeId: string | undefined) {
  return useQuery({
    queryKey: ['garments', wardrobeId],
    queryFn: () => api.garments(wardrobeId),
    enabled: !!wardrobeId,
  });
}
```

Include every input that changes results in query keys. Keep existing key conventions when extending a feature. Distinguish an empty successful response from loading or failure. Render errors with `ErrorNotice` or `userError` (`lib/api/user-error.ts`), which localize codes/statuses; avoid exposing `error.message` from backend internals directly.

### How to add a mutation

Use `useMutation`, call an existing typed API method or feature API wrapper, and invalidate only affected keys on success. For example, in an existing feature hook:

Adapt multi-argument API methods to Query's single variables object:

```tsx
const queryClient = useQueryClient();
const saveGarment = useMutation({
  mutationFn: ({ id, patch }: { id: string; patch: Partial<GarmentInput> }) =>
    api.updateGarment(id, patch),
  onSuccess: async (garment) => {
    await queryClient.invalidateQueries({ queryKey: ['garments'] });
    await queryClient.invalidateQueries({ queryKey: ['garment', garment.id] });
  },
});
```

Import `useMutation`/`useQueryClient` from TanStack Query and `GarmentInput` from `@wardrobe/shared`. Match the real detail query key in the caller rather than inventing a second cache entry. Disable only the relevant save action while pending, preserve editable draft state on failure, and use translated success/error feedback. Checkboxes should not trigger AI requests.

### How to add a reusable component

Keep a one-feature component within that feature. Promote it to `components/ui` only when independent consumers need it. Keep data loading and business rules outside primitives. Reuse `Button`, `Dialog` and `DropdownSelect`; carry accessible names, focus handling and keyboard interaction through wrappers. Add React Testing Library tests near the component for behavior, not snapshots that merely mirror markup.

## Backend and API development

`apps/api/src/app/server.ts` creates Fastify with Zod type-provider compilers, security middleware and OpenAPI. `app/app.ts` creates the session service, registers modules and installs the error handler. `src/index.ts` is the process entry. Feature route modules validate requests and perform authorized work through `session.load` and the returned user-scoped Supabase client.

Business tables use RLS. A UUID filter is not authorization. `checked` in `lib/route-utils.ts` converts database failures into safe HTTP errors. `HttpError` from `modules/auth/session.ts` carries status and an optional stable code. Global errors retain safe English technical messages and the frontend localizes them. Never log cookies, credentials, reset tokens, request authorization headers or private model input. Pino diagnostics should identify the failed operation and safe IDs/codes.

### How to add a new API endpoint

1. Define pure input/output Zod schemas in a feature-specific `packages/shared/src/` file and export through the shared public surface. Existing grouped `ApiContract` definitions can be extended when appropriate; not all feature endpoints are currently listed there.
2. Add the route to its owning `apps/api/src/modules/<feature>/routes.ts`. For a new module export `register...Routes`; register it from `app/app.ts`. Gemini-related modules reuse the existing queue registration in `modules/gemini/routes.ts`.
3. Use `schema.body`, `schema.params` and `schema.querystring` as appropriate. Use runtime parsing where inference is unavailable; do not bypass validation with unsafe casts.
4. Load the session before business reads/writes. Use `sb` returned by `session.load`; preserve membership, owner/editor checks and RLS. Never switch to service-role access to make a failing request pass.
5. Extract substantial orchestration into the same module. Keep request/reply and database code out of shared pure schemas/rules.
6. Return validated public data, omit secrets/internal columns, and throw safe `HttpError` messages/codes while preserving established status behavior.
7. Add a typed frontend method using `request(path, responseSchema, method, body)` and a Query hook with appropriate invalidation.
8. Test with `app.inject`, mocked sessions/database responses for unit-level API behavior, and isolated two-user RLS tests for real authorization. See `tests/style-profile-api.test.ts`, `tests/travel-packing-api.test.ts` and `tests/route-utils.test.ts`.

This existing route illustrates the authorization/data pattern (from `modules/profile/routes.ts`):

```ts
app.get('/api/profile/style', { schema: { tags: ['profile'] } }, async (req, reply) => {
  const { sb, user } = await session.load(req, reply);
  const profile = checked(
    await sb.from('profiles').select('style_profile').eq('id', user.id).single(),
  );
  const stored = styleProfileStoredSchema.parse(profile.style_profile);

  return { ...stored, hard_constraints: deriveStyleHardConstraints(stored.answers) };
});
```

`ApiServer` is exported by `app/server.ts`; `SessionService` by `modules/auth/session.ts`. API code owns HTTP, auth, SQL and orchestration. Shared code owns reusable schemas, pure interpretation, quantities and ranking. Worker code owns long-running processing; do not keep HTTP connections open while waiting for AI.

## Internationalization

The single i18next instance is `apps/web/src/app/i18n/index.ts`. `en` is the default/fallback; `pl` is explicitly selected and persisted using the key defined in `app/i18n/types.ts`. Browser locale/IP do not select the language. Shared navigation/common/validation resources live in `src/locales/{en,pl}/`; feature resources live beside each feature in `locales/en.json` and `pl.json`. Register new namespaces in the existing instance, not a second instance.

### How to add a new translation

Add the same semantic key to both feature resources, then read it through the namespace:

```json
{ "reminders": { "empty": "No reminders yet", "due": "Due on {{date}}" } }
```

The Polish resource must provide natural Polish values for those same keys. A component uses `const { t } = useTranslation('yourRegisteredNamespace')` and `{t('reminders.due', { date })}`. Add the proposed namespace to `app/i18n/index.ts` before use. For plurals, supply i18next suffixed forms (`_one`, `_other`; Polish additionally `_few`, `_many`) and pass `{ count }`; consult the existing resources and parity checker. Keep formatting locale-aware and never concatenate translated fragments to build sentences.

Run `pnpm check:i18n`; test both languages, including validation, empty/loading/error states, accessible labels, notifications and AI failure. API errors use safe English messages plus stable codes where available; map codes to translation keys and preserve a localized status fallback for older endpoints.

English-first applies to source identifiers, comments, tests, technical messages and documentation. New UI strings require both translations; no literal UI prose in JSX. Domain IDs, enum values, saved questionnaire answers and user input do not change when language changes. Generated outfit/packing prose uses the requested content language and remains stored in that language. Legacy garment analysis has a separate Polish normalization vocabulary; do not mistake that corpus for the application's default UI locale.
