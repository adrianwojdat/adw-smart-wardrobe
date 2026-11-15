# Style profile — database migration

Additive `0016_style_profile.sql` was applied transactionally to the local OrbStack development database and recorded in `private.schema_migrations` with SHA-256. It was not applied to production.

Adds `profiles.style_profile` with empty answers and `merge_my_style_answers`, atomically updating only the authenticated user’s profile. Existing answers/other data remain unchanged. Column/function access is restricted to `authenticated`; BFF uses the user token.

In production, deploy the file to `supabase/migrations/` after a PostgreSQL backup, then run the migrator through the deployment procedure. Compose applies pending migrations on stack startup, so this must not enter production without deliberately running the migrator. `tests/style-profile-rls.sql` RLS test passed locally. API/web were built for the local environment.

Reverting requires a separate deliberate step: decide whether to preserve answers before removing the function/column. Never roll back automatically, because that deletes the stored profile.

## Questionnaire 2.0 — no new migration

q31–q34 are optional keys in the existing JSON. Storage version
1, q01–q30 meaning, and RPC behavior are unchanged. No content migration,
survey reset or automatic assignment of new answers is performed. Existing
answers and skips remain saved. `tests/style-profile-rls.sql`
also covers additive new fields, preservation of old fields, explicit `false`,
and two-user isolation; run it only in an isolated database.
