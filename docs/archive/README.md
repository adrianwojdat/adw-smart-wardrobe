# Documentation archive

These files preserve design history. They are not deployment instructions, pending migration queues, or current dependency specifications. Do not execute archived SQL or copy it into `supabase/migrations/` without a new review and an explicitly authorized implementation task.

| Archived artifact                                                              | Status and authoritative source                                                                                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Custom garment properties draft](sql-proposals/custom-garment-properties.sql) | Superseded by `supabase/migrations/0015_custom_garment_properties.sql`; see [deployment notes](../custom-garment-properties-migration.md).                                       |
| [Initial classification draft](sql-proposals/initial-classification.sql)       | Superseded by narrowly scoped functions in migrations `0009`, `0013` and `0014`; its broad draft policy must not be applied.                                                     |
| [Gemini configuration draft](sql-proposals/gemini-configuration.sql)           | Superseded by migrations `0017`–`0020` and later task migrations. Earlier draft credential policies do not describe current permissions; see [Gemini setup](../gemini-setup.md). |
| [Image-path constraints proposal](sql-proposals/image-path-constraints.sql)    | Historical unapplied proposal. Archiving does not approve it or establish that existing data satisfies its constraints. Re-audit before designing a new migration.               |
| [Dependency snapshot, 2026-11-08](dependency-versions-2026-11-08.json)         | Historical registry audit. Current versions come from workspace `package.json` files and `pnpm-lock.yaml`; this snapshot is not an update recommendation.                        |

The custom Node migrator reads only `supabase/migrations/`. No archived SQL was executed or applied as part of documentation cleanup. Applied SQL files remain immutable and unchanged.

For current instructions, use the [documentation index](../README.md) and [Development Guide](../development/README.md).
