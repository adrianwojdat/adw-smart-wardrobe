# Deployment on Proxmox LXC

## Resources

Suggested full-stack starting resources: **4 vCPUs, 8 GB RAM, and 40–60 GB SSD**, plus images/backups. Intel N100/N150 is adequate for a small family, although image builds can take longer. Do not assume full Supabase will be stable in 4 GB. The 8 GB recommendation is operational guidance, not an N100 load-test result; local verification results are in `docs/progress.md`. All baseline Supabase services are retained.

Image capacity depends on count/content; uploads are resized and encoded as WebP, without a fixed-size guarantee. Monitor Storage and database disk space. Image builds need extra space for pnpm and Docker layers. Keep backups on a separate disk/host, not in the same LXC.

## Host preparation

1. Create a dedicated, unprivileged Debian/Ubuntu LXC with security updates. Proxmox configuration is the administrator’s responsibility; the repository does not modify the host.
2. Docker in LXC needs nesting and keyctl. Check storage-driver, cgroup, and AppArmor compatibility for your Proxmox version. Do not disable host-wide security. If containers do not work correctly in your setup, use a small VM instead of privileged LXC.
3. Install Docker Engine and the Compose plugin using Docker documentation. `docker compose version` and `docker info` must work. A separate Supabase CLI is not required.
4. Clone the repository into a persistent directory. Secret generation requires Node 26 LTS; pnpm is only needed for development/tests because images install their own dependencies.

## First startup

```sh
node scripts/setup.mjs
# Edit .env, then:
docker compose up -d --build
```

The script creates `.env` with mode 0600, cryptographically random secrets, and matching HS256 anon/service-role JWTs. It refuses to overwrite an existing file. Keep an encrypted copy of `.env`; losing session/vault keys may make some data unreadable. Do not change `POSTGRES_PASSWORD` after volume initialization without a role-rotation procedure.

For tests on the same computer, the default `http://localhost:8080` is sufficient. For LAN access, set **the exact same origin**, for example `http://192.168.1.50:8080`, in:

- `APP_ORIGIN`
- `SITE_URL`
- `SUPABASE_PUBLIC_URL`
- `API_EXTERNAL_URL` with the suffix `/api/auth`
- `ADDITIONAL_REDIRECT_URLS` with the suffix `/reset-password`

Do not mix localhost, DNS names, and IP addresses: Origin checks intentionally reject inconsistent settings.

## HTTPS

For a publicly resolving domain with ports 80/443 available, set:

```dotenv
SITE_ADDRESS=wardrobe.example.com
HTTP_PORT=80
HTTPS_PORT=443
APP_ORIGIN=https://wardrobe.example.com
SITE_URL=https://wardrobe.example.com
SUPABASE_PUBLIC_URL=https://wardrobe.example.com
API_EXTERNAL_URL=https://wardrobe.example.com/api/auth
ADDITIONAL_REDIRECT_URLS=https://wardrobe.example.com/reset-password
COOKIE_SECURE=true
```

Caddy obtains a certificate and persists it in `caddy-data`. On a private network, use an existing reverse proxy with a trusted certificate or your own CA; browsers must trust the certificate for correct PWA behavior. When terminating TLS outside Caddy, retain the public HTTPS origin and Secure cookies, forwarding to the application HTTP port over a trusted network. Do not publish PostgreSQL, Redis, Supavisor, Storage, or Supabase gateway ports publicly.

## Email

By default, `ENABLE_EMAIL_AUTOCONFIRM=true`: local accounts are created without confirmation emails. This simplifies first launch, but email addresses are unverified. **Configure SMTP and set autoconfirm=false before exposing family invitations to untrusted users**, because invitations are bound to email identity.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`. Match domains and `MAILER_URLPATHS_*` to the example; all links pass through BFF `/api/auth/verify`. Port 587/STARTTLS is common, but check your provider’s requirements. Then recreate containers using the same root Compose and test registration/reset with your own mailbox. Without SMTP, the application states that email password reset is unavailable.

## Verification

```sh
docker compose ps
docker compose logs --tail=100 migrate api worker
curl -fsS http://localhost:8080/api/health
```

`migrate` should exit with code 0; this is correct for a one-shot service. Other services should remain running. Open the application, register, create a wardrobe, add an image, save the garment, and inspect the catalog. Ollama is not required. Initial image and Deno dependency downloads need Internet access; built images/caches are local afterward.

## Studio

In the phase-1 setup, Studio and the gateway had no published ports. For temporary access, an administrator can create a server-side forward available **only on localhost**, then use SSH tunneling; do not expose the full Supabase API through public application routing. Alternatively use `docker compose exec -T db psql -U postgres -d postgres`. `DASHBOARD_PASSWORD` is random, but a password alone does not replace network isolation.

## Ollama

In phase 1, `OLLAMA_BASE_URL` and `OLLAMA_MODEL` were reserved for a later stage, with no jobs querying AI. Never expose Ollama publicly; the planned worker would use its LAN address. Visualizations and label recognition were not yet MVP features at that snapshot.
