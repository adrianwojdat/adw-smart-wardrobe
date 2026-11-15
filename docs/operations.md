# Operations and backups

## What to preserve

PostgreSQL (all databases, roles, auth, storage metadata, and private schema), `data/storage/` **with xattrs**, `db-config` (pgsodium keys), `.env`, repository revision, and lockfile. `caddy-data` stores certificates. Redis uses AOF in `redis-data`; business job state also lives in PostgreSQL. SQL alone contains no photos, and image bytes alone omit HTTP metadata. Old Docker Desktop volumes remain as a recovery point; active PostgreSQL/Redis run in OrbStack, while photos live in the project directory.

On macOS, OrbStack runs unmodified official Storage with native xattrs: [infra/storage/README.md](../infra/storage/README.md). The former `data/storage-metadata/` JSON catalog and inactive image copy were deleted at the user’s request; independent backup archives remain in `investigation/backups/`. Never edit photo files or attributes manually. Supabase retains paths/version IDs, so image files may have extensionless UUID names.

## Consistent backups

For small installations, the simplest procedure is a short maintenance window: stop `web api worker auth storage realtime supavisor functions studio meta rest api-gw` while leaving `db redis imgproxy` running (imgproxy only reads files). Users must not write during this window.

```sh
umask 077
wardrobe_backup_dir="investigation/backups/operations-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$wardrobe_backup_dir"
docker compose stop web api worker auth storage realtime supavisor functions studio meta rest api-gw
docker compose exec -T db pg_dumpall -U supabase_admin > "$wardrobe_backup_dir/cluster.sql"
# Host tar: BSD tar on macOS or GNU tar on Linux, with xattr support.
tar --xattrs -C data -cf "$wardrobe_backup_dir/storage.tar" storage
docker compose exec -T db tar -C /etc/postgresql-custom -cf - . > "$wardrobe_backup_dir/db-config.tar"
docker compose up -d
```

`pg_dumpall` includes roles and sensitive Auth data; encrypt the file and restrict access to administrators. Back up `.env` separately to encrypted storage. Never add backups to Git. Copy them off-host and verify SHA-256 checksums. Verified PostgreSQL physical backups with WAL/PITR are also possible, but PITR configuration is outside the MVP.

Use `tar --xattrs` when restoring image archives too. Host BSD tar round-tripping was tested on an isolated file with Supabase attributes on this Mac. For macOS/Linux transfers, separately verify xattr compatibility between tools; comparing photo SHA256 alone is insufficient. BusyBox tar in the Storage image is not a replacement for the host tool used here.

Never copy live raw PGDATA with `tar`; use a logical dump or correct PostgreSQL backup. A Proxmox snapshot without quiescing does not replace regularly tested application backups.

## Recovery — always rehearse first

1. Prepare an isolated LXC/VM with matching image versions and repository copy. Do not point the production domain at it; block SMTP during rehearsal.
2. Use preserved secrets. Restore `db-config` keys in their proper volume and `data/storage/` with xattrs. Historical backups made with the JSON adapter require converting recorded attributes back to native xattrs; copying those old image bytes alone is insufficient.
3. Start PostgreSQL alone. Supabase initialization creates system roles/databases that may also be present in a full cluster dump. The administrator must perform a controlled, version-appropriate restore and review every conflict, rather than ignore errors or run the dump against production. Prepare and verify a restore runbook matching the chosen backup method.
4. After restoring SQL, start Auth/Storage and the remaining stack. Migrator compares checksums and must not rerun recorded migrations.
5. Verify an existing user’s sign-in, wardrobe listing, several images, and a second user’s access restrictions. Sample photos by object name rather than checking only row counts.
6. Use the emergency procedure on the real host only after a successful rehearsal and documented recovery time. This project has not automatically tested a full restore; do so before treating a backup as verified.

Redis can be restored from AOF while stopped. If Redis is lost, worker recreates queued/stale-processing jobs from SQL. Completed jobs do not rerun; failed jobs need manual retry. Never delete whole PostgreSQL/Storage volumes while diagnosing queues.

## Updates and migrations

Back up and rehearse updates on a copy. Record the current commit and image versions. Run `docker compose up -d --build`. Migrator starts after Auth/Storage readiness, takes an advisory lock, executes each new migration transactionally, and records SHA-256. Migration failure blocks BFF/worker startup. Existing migrations are immutable: append fixes in new files. PostgreSQL major upgrades need a separate upstream procedure, not a simple image-tag replacement.

Do not run `docker compose down -v` on an existing installation. `docker compose down` without `-v` preserves data. Code rollback does not roll back schemas: use compatible migrations or restore a verified backup.

## Monitoring

```sh
docker compose ps
docker compose logs --tail=100 api worker migrate
docker compose logs --tail=100 auth storage db
docker compose stats --no-stream
docker system df
```

Upstream service logs rotate at 3 × 10 MB. API/worker use Pino and do not log cookies/passwords. Set external alerts for `/api/health` and disk space; monitoring/alerting is not a separate MVP service. `/api/health` checks the session database, not all service correctness; Compose healthchecks cover other components.

## Common problems

- **403 on writes:** public URL differs from APP_ORIGIN, CSRF is missing, editor/owner permission is missing, or membership expired.
- **Cannot sign in:** check Auth readiness, email confirmation, and JWT_SECRET/ANON_KEY consistency. Never generate a new .env over existing volumes.
- **Email not delivered:** inspect SMTP and permitted redirect URLs. Setting variables alone does not prove delivery.
- **Image rejected:** at most 10 MB and 40 MP, JPEG/PNG/WebP; SVG/HEIC/GIF are unsupported in the MVP.
- **Stuck job:** check worker, Redis, and `jobs`. Worker recovers the outbox every 5 seconds and stale processing after 5 minutes. Manual retry applies only to failed jobs and requires editing permission.
- **Studio/Edge Runtime uses RAM:** do not remove arbitrary dependencies. The complete current baseline is intentional. Observe RAM, limits, and restart counts.
- **Deno fails to start:** first launch needs JSR/npm access and working DNS. Deno cache persists in a named volume.
- **Access broken after update:** refresh using the PWA update notification. Private APIs/photos must never be served from service worker cache.
