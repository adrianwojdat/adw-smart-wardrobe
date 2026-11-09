# Authentication emails

The six GoTrue v2.197.0 templates share the application's cream/forest palette and branding. Localized copy and subjects live in `content.pl-PL.json`; regenerate committed HTML and text files with:

```sh
node infra/auth-email/generate.mjs
node scripts/compose.mjs
```

Keep `{{ .ConfirmationURL }}` and `{{ .Token }}` intact. Auth generates verification URLs; templates never construct or log tokens. Existing BFF verification routes remain unchanged. Magic-link and reauthentication templates cover GoTrue capabilities; this does not add those flows to the frontend.

GoTrue loads templates over HTTP. The Auth image retains the pinned official GoTrue binary and adds a small, loopback-only static server on port 8089. Templates are mounted read-only. No other service or SMTP setting changes are required. After changing template files, recreate only Auth to clear its template cache:

```sh
docker compose build auth
docker compose up -d --no-deps --no-build auth
```

The generated `.txt` files provide reusable plain-text alternatives. This GoTrue version sends only `text/html` and does not expose multipart plain-text configuration; those alternatives are not attached automatically. HTML includes a readable fallback URL and security guidance.

Verification: confirmation and recovery emails were received in NodemailerApp with Polish subjects. Their actual received HTML was rendered at 600px and 375px without horizontal overflow and visually inspected. Links retained tokens and pointed to the local `/api/auth/verify` endpoint, with recovery redirecting to `/reset-password`. Links were inspected without consuming them or changing passwords. Other four templates were checked for availability, but their delivery flows were not triggered.
