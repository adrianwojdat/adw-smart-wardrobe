# Login persistence

The login page offers **Remember me**, localized in English and Polish and checked by default. It sends the optional boolean `rememberMe` through the existing login contract. Only email/password are forwarded to Supabase; the choice belongs to the BFF session.

- Checked: an opaque HttpOnly cookie with a 30-day Max-Age. After authenticated use, the BFF renews the server expiry and cookie when fewer than 29 days remain. Continued use therefore keeps the login active.
- Unchecked: a browser-session cookie, with no Max-Age/Expires. Its server record has a fixed 12-hour maximum lifetime. Browser session restoration behavior is controlled by the browser.
- Existing encrypted sessions without the new flag retain persistent behavior. Requests from old clients that omit `rememberMe` retain the previous persistent default.
- Logout deletes the server record and clears the browser cookie; password changes still revoke all local sessions. Expired or rejected credentials require login again.

Provider access/refresh tokens remain encrypted in `private.sessions.tokens`. The remember flag is stored inside that encrypted payload, preserved on refresh. No credentials or tokens enter localStorage, browser JavaScript or API response bodies. No migration or rewrite of old sessions is needed. Existing Secure/SameSite cookie policy and CSRF protection remain in use.

The Supabase access-token lifetime remains one hour in the current deployment. The BFF refreshes it under the existing PostgreSQL row lock and saves rotated credentials; a short access-token lifetime does not require the user to log in each hour.

A temporary provider user-lookup/refresh error (429, 5xx or no definitive invalid-credential status) now produces 503 and preserves the local session. Previously these errors were converted to 401 and cleared the cookie. Definitive 400/401/403 authentication rejection clears the cookie and removes the local server record. This change fixes a premature-logout path found in code; it does not claim that every prior logout had the same cause.

Tests in `apps/api/src/modules/auth/__tests__/session.test.ts` exercise actual BFF session/login handlers against mocked PostgreSQL and provider boundaries: cookie duration/flags, encrypted choice, renewal, token rotation, browser-only refresh, transient failures, expiration, old-session compatibility and logout. Vitest includes API-local tests. `tests/e2e/auth.spec.ts` checks the login form with Remember me enabled and disabled on desktop/mobile using mocked HTTP; no user accounts are created or changed by these tests.
