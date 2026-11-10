# Native Supabase file storage

Storage uses the unmodified, version-pinned official Supabase image from the
vendored Compose baseline. `data/storage/` is bind-mounted at `/var/lib/storage`;
imgproxy reads the same directory read-only. Files remain ordinary images in
Supabase's versioned path layout, sometimes with UUID filenames without an
extension. Access control remains in Supabase; inspect files locally, but make
changes through the application.

## macOS

Use OrbStack and the `orbstack` Docker context. The current Docker Desktop file
sharing implementation rejects the Linux `user.supabase.*` xattrs required by
the file backend. An APFS filesystem alone does not prove container compatibility.
Always test native attribute write/read through the intended container engine.
Linux deployments also need a filesystem supporting these attributes.

```sh
docker context use orbstack
docker compose up -d --build
```

Switching context does **not** migrate existing volumes. Existing installations
must first back up PostgreSQL, Storage files and xattrs, configuration and other
persistent volumes, stop writers, transfer data, then verify the result. Never
start the same installation in two engines against the shared image directory.

The migration retained the previous Docker Desktop containers/volumes and private
backups. They are frozen recovery points, not synchronized copies. The former
`data/storage-metadata/` JSON directory and inactive image copy were removed at
the user's request after migration; their independent backup archives remain.
No metadata adapter remains
in the application. To roll back after new writes, first transfer current database,
Redis, image files and required metadata; do not simply start the older database.

## Verification

`native-smoke.cjs` runs inside the official Storage image against an **isolated,
empty** image bind mount with the existing Storage environment. It tests upload,
Content-Type/Cache-Control/Content-Encoding, range and ETag/304 responses, copy,
delete, multipart completion/abort and persistence. Execute its second phase with
`PROBE_PHASE=read-after-restart` in a new container against the same isolated mount.
Never run its write phase against application data.

Backups must preserve xattrs as well as image bytes and PostgreSQL. See
[operations](../../docs/operations.md). A plain tar or file hash comparison is not
enough to establish that HTTP metadata survived a copy.
