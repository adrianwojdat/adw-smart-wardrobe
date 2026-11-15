# Travel Packing

Travel Packing is an independent authenticated page at `/travel-packing`, available in the main navigation. The existing outfit generator remains available separately.

## User flow

1. Choose an accessible wardrobe. Enter destination and duration (1–365 days). Departure is optional. Trip type, laundry, light luggage and notes customize generation.
2. Generate using the Gemini model/key configured in Settings. Queued, generating and retry states use the existing task infrastructure. Cancel stops an active task; the trip form can submit another generation after failure/cancellation.
3. The validated AI result is saved as a new named list. Open each clothing row to view actual wardrobe recommendations, names, available photos, cleanliness and garment details. Assign individual physical garments; assigned count and shortages remain separate from quantities and packing progress.
4. Edit quantities, select/unselect garments and enter actual packed counts. A row checkbox completes or clears all its pieces. Add custom travel items and remove rows. These edits do not call AI.
5. Save explicitly after editing. Reopen from Saved lists to restore assignments and progress. Deletion requires an explicit confirmation. Unsaved edits are local to the page; save before opening another list or leaving the page.

English is the default interface language. English and Polish UI resources share semantic keys. Generation receives the selected language, and persisted names/descriptions do not change when switching interface language.

## Data and matching

`tripSchema`, `packingAiResultSchema`, `packingItemSchema`, `packingInputSchema` and `packingListSchema` validate input/output and persistence. Gemini returns bounded structured JSON with no garment IDs; the worker validates it before assigning UUIDs. Invalid output fails the task without storing raw model JSON as a packing list. Item IDs survive edits and reopening.

Matching runs on the server against RLS-visible garments in the saved trip's wardrobe. Category is a hard filter; subcategory, season, warmth, material, style, occasion, cleanliness and photo availability affect deterministic ranking. Dirty garments remain visible, clearly labelled and ranked lower. No garment metadata or photos are sent to Gemini for packing generation. Non-clothing items do not receive wardrobe recommendations.

A garment can fill at most one piece in a row. Cross-row reuse requires the explicit reuse checkbox; disabling it removes repeated assignments in subsequent rows. Required, assigned and packed quantities are independent. Missing quantities are required minus assigned physical garments. Packing progress counts packed pieces, not recommended garments. For lists with cross-row reuse enabled this is a count of pieces per row, rather than a count of globally unique physical garments.

No live weather service is used. The prompt disallows claims of verified forecasts, requires conditional weather items without a date and labels dated advice as typical climate. These are model instructions, not a guarantee of meteorological accuracy; users can adjust all quantities.

## HTTP endpoints

| Method | Endpoint                                  | Purpose                                                    |
| ------ | ----------------------------------------- | ---------------------------------------------------------- |
| POST   | `/api/travel-packing/generate`            | Validate trip; create/enqueue `travel_packing` Gemini task |
| GET    | `/api/gemini/tasks/:id`                   | Existing owner-scoped task status/result                   |
| POST   | `/api/gemini/tasks/:id/cancel`            | Existing owner-scoped cancellation                         |
| GET    | `/api/travel-packing`                     | Most recent 100 accessible owned lists                     |
| PUT    | `/api/travel-packing/:id`                 | Create/update validated named list by UUID                 |
| GET    | `/api/travel-packing/:id/recommendations` | Rank actual garments for each clothing row                 |
| DELETE | `/api/travel-packing/:id`                 | Delete owned accessible list                               |

The standard session, CSRF and HTTP rate controls apply. Gemini calls reuse encrypted credentials, RPM quota keys, timeout, retry and cancellation. Generation uses the same global queue cap and one-active-task-per-user constraint. Task requests contain only trip criteria, not credentials or wardrobe inventory. Notes are limited to 1000 characters, destination to 160, lists to 80 rows and each quantity to 365. Recommendation reads are bounded to 2000 wardrobe garments; each row returns up to 60 ranked candidates plus current assignments. Larger inventories may require future pagination. Assignment validation always checks real access at write time, independently of ranking.

## Migration and deployment

`supabase/migrations/0025_travel_packing.sql` is additive. It adds the task kind, the BFF-only task creation function, `packing_lists`, its index, owner/member RLS and an invoker validation trigger. It does not change existing migrations or outfit data. No service-role bypass is used. Garment deletion does not cascade to saved lists; reopening prunes unavailable assignment IDs and retains required and packed counts.

Apply with the existing ordered, transactional, checksum-tracked migrator during an authorized deployment, then rebuild API, worker and web together. Do not apply the new migration to a production or application database without approval. The feature needs the migration before its endpoints can work.

## Verification

- `pnpm check`: formatting baseline, typed ESLint baseline, all workspace typechecks, Vitest, dependency boundaries, source layout, i18n parity, Knip baseline and builds.
- `pnpm test -- tests/travel-packing.test.ts tests/travel-packing-api.test.ts apps/web/src/features/travel-packing/__tests__/packing.test.tsx`: form/domain invariants, matching and shortages, AI validation and mock Gemini transport, API authentication/CSRF, checklist interactions and both languages.
- `E2E_BASE_URL=http://127.0.0.1:5178 pnpm test:e2e tests/e2e/travel-packing.spec.ts`: fully mocked HTTP/Gemini, desktop/mobile in EN/PL. Tests Japan/10 days, assignment, partial packing, save, reload and restored progress, with exactly one generation call. No application data is written.
- `tests/travel-packing-rls.sql`: run after migration 0025 only in an explicitly isolated test database. Transaction-local fixtures and rollback cover two users, foreign garment rejection, list read/delete isolation, persistence and garment deletion recovery.

Migration 0025 and the RLS test were verified in a temporary schema-only clone of the local Supabase database. The temporary database was removed after the check. Existing application tables/data and migration history were not modified.

## Completeness repair (2026-11-14)

Generation now follows **trip → deterministic base → Gemini enrichment → Zod → normalization/completeness repair → task result → existing save flow → grouped checklist**. It never runs on saved-list reads or ordinary edits.

The investigation found that the original worker asked Gemini for a free-form replacement list and only checked per-row structure and the 1–80 row bound. It accepted a valid but sparse list and generic bundles such as “Underwear”. The parser did not selectively drop valid rows; API persistence and the checklist displayed the whole validated array. The 100-list query limit and 60-garment recommendation limit do not limit checklist rows. Travel Packing previously had no explicit output-token budget, so code inspection does not establish provider truncation as the cause. The structural defect was absence of completeness rules and post-generation repair.

`packages/shared/src/travel-packing/catalog.ts` defines 13 stable packing groups and concrete bilingual item types, independently of garment categories. Optional JSON item fields (`packing_key`, `packing_group`, `optional`, `generation_source`) carry new-generation metadata. Existing rows without these fields still validate; no database migration or automatic rewrite is needed.

`rules.ts` creates a base before any Gemini call. Daily underwear and total socks use days plus a small reserve; laundry uses a default four-day wash cycle. T-shirts allow reuse, trousers and layers have separate reuse counts, light luggage reduces spare garments, business trips add shirts. A dated, recognized broad destination/hemisphere supplies only a coarse seasonal context; an absent date or unrecognized region remains unknown. Explicit user climate/activity notes can supply context. Weather-dependent items remain labelled; no forecast is asserted. Bras and shaving products require relevant user notes; gender and age are never inferred. Pool/beach/relaxation or shared-shower context can add shower flip-flops. Generic personal-care/health candidates do not replace specific daily hygiene items.

Gemini now receives base rows and stable keys. It returns bounded `adjustments` with a reason and `additions`, rather than replacing the list. Its existing transport/limiter/retries remain in use, with a Travel Packing output budget of 8192 tokens. Valid old-format task results remain compatible during rollout. Normalization merges duplicates by concrete type (maximum quantity, never sum), reconstructs known names/categories from the catalog, discards generic bundles or combined types, rejects mismatched type keys, bounds quantities, and protects essential daily minima. Explicit exclusions in user notes are respected; optional rows can be omitted with a reason. Sock totals are checked after adjustments. The base is always retained ahead of additions within the existing 80-row capacity. There is no second AI call to repair omissions.

If the call fails or the response cannot be validated, the existing worker completes a labelled baseline fallback. The persisted per-item source makes that limitation visible after reopening. Explicit user cancellation is still cancellation; key, encryption or model configuration errors remain actionable errors. No photos or inventory are sent to the model. Clothing matching now checks concrete bilingual garment type in addition to category; unrelated shirts/sweatshirts no longer fill a T-shirt recommendation row. Unmatched wardrobe entries are described as “not assigned in the app”, not evidence the user does not own them.

The UI groups independent rows into underwear/socks, clothes, footwear, accessories, hygiene, electronics, documents, health and trip-specific items. All 13 detailed category labels are translated in the existing EN/PL namespace. Quantity and packed labels have their own spaced layout. Saved legacy rows are only visually grouped; names, assignments, quantities and packed progress are not regenerated.

### Deterministic example: Japan, 10 days, November, no laundry

This is a reproducible **baseline**, not a live Gemini response or verified forecast. Activity: mixed; light luggage: off. Every table entry is a separate checkbox/count row in the app.

| Item                          | Quantity | Conditional/optional                                                                          |
| ----------------------------- | -------: | --------------------------------------------------------------------------------------------- |
| Underpants                    |       12 |                                                                                               |
| Short socks                   |        8 |                                                                                               |
| Long socks                    |        4 |                                                                                               |
| T-shirts                      |        7 |                                                                                               |
| Shirts                        |        2 | Optional                                                                                      |
| Sweatshirts                   |        2 |                                                                                               |
| Sweater                       |        1 | Optional                                                                                      |
| Long trousers                 |        3 |                                                                                               |
| Comfortable walking shoes     |   1 pair |                                                                                               |
| Spare shoes                   |   1 pair | Optional                                                                                      |
| Jacket                        |        1 | Weather dependent                                                                             |
| Belt                          |        1 | Optional                                                                                      |
| Pyjamas                       |        2 |                                                                                               |
| Toothbrush                    |        1 |                                                                                               |
| Toothpaste                    |        1 |                                                                                               |
| Deodorant                     |        1 |                                                                                               |
| Shampoo                       |        1 |                                                                                               |
| Body wash                     |        1 |                                                                                               |
| Comb or hairbrush             |        1 | Alternative tools for the same purpose                                                        |
| Phone                         |        1 |                                                                                               |
| Charger                       |        1 |                                                                                               |
| Charging cable                |        1 |                                                                                               |
| Power bank                    |        1 | Optional                                                                                      |
| Plug adapter                  |        1 | Only if the user's plug requires it                                                           |
| Identity document or passport |        1 | Appropriate document for the trip                                                             |
| Tickets/reservations          |        1 | Booking records                                                                               |
| Travel insurance              |        1 | If relevant                                                                                   |
| Payment card or cash          |        1 | Payment method                                                                                |
| Regular medication            |        1 | Only if prescribed/used; quantity is a user-editable checklist placeholder, not dosing advice |
| Basic dressings               |        1 |                                                                                               |

Adding a pool/shared-shower note adds a separate flip-flop row; swimwear is considered for swimming context. This example does not assume personal garments such as bras or skirts. Climate rules are intentionally coarse and cannot resolve regional variation, forecasts, individual wardrobes or every synonym in free-text notes. Users can edit and remove all generated suggestions. Older lists are intentionally not supplemented automatically.

Saved lists are opened from the **Saved lists** tab. Each trip card shows piece progress and a Continue packing action. New trip returns to the planner. Database response parsing strips extra tenant columns (`user_id`, `wardrobe_id`) without relaxing request validation or RLS; full-row GET/PUT regression tests cover this distinction.
