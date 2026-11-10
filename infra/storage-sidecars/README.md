# Project-local Supabase image files

This is a project-maintained compatibility adaptation of **Storage v1.89.12**,
not an upstream Supabase feature. Docker Desktop macOS bind mounts reject the
Linux xattrs required by that release. This adapter stores the same attribute
values in separate JSON files without changing image bytes, object keys, RLS,
database rows or the Storage REST API. No S3 server is added.

- `data/storage/`: actual ordinary image files, mounted at `/var/lib/storage`.
- `data/storage-metadata/`: required sidecar metadata, mounted separately.
- Existing Supabase paths and version identifiers are preserved. A version file
  may have a UUID filename without an extension even though its bytes are JPEG,
  PNG or WebP. Finder Quick Look / Open With can inspect it. The adapter does
  not convert original formats to JPEG or rename originals.
- Both directories are private and ignored by Git. Do not edit or delete files
  directly: use the application so database metadata stays consistent.

The image is pinned by upstream digest. `patch.cjs` checks the exact compiled
backend SHA-256 and replacement counts and fails on an unreviewed upgrade.
Only xattr access and the associated rename/unlink/multipart cleanup operations
are adapted. Metadata files are atomically replaced with mode 0600 and validated
on read; errors are propagated, not hidden as missing attributes. Staged upload
metadata follows the published object. A crash can leave unused staging metadata;
the image and sidecar are not a cross-filesystem transaction.

Run one Storage instance: synchronous metadata updates serialize writes within
its Node process. This adapter is not designed for multiple independent Storage
writers or manual concurrent filesystem modifications.

## Tests

`pnpm exec vitest run tests/storage-sidecars.test.ts`

`smoke.cjs` additionally tests the actual compiled backend inside the built image,
using an **isolated empty** bind mount and a second container to check persistence.
It covers upload, content metadata, range/ETag responses, copy, delete, multipart
completion and abort. Never run its write phase against application data.

`import-xattrs.cjs` imports an offline xattr export to an empty sidecar directory,
after checking every image against its SHA-256 manifest. It never writes image
bytes. Arguments: image root, metadata root, manifest JSON, xattr-export JSON.

## Backups and rollback

Back up PostgreSQL, **both** directories and private configuration together while
application writers are stopped. File hashes alone do not back up HTTP metadata.
Keep the old named volume and pre-migration backups. Before new writes, rollback
can restore the previous Compose mount and image. After new writes, first copy
current files and restore sidecar values to real xattrs on a supported filesystem;
verify all objects before switching. Simply selecting the old volume would lose
access to newer uploads. Never restore an older database without a separate
explicit recovery decision.
