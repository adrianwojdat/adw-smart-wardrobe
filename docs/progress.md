# Progress — Phase 1

Updated: 2026-11-08. Phase 1 working MVP implemented and verified locally.

## Implemented

- pnpm monorepo, strict TypeScript, React SPA, Fastify BFF, separate BullMQ worker.
- Pinned official self-hosted Supabase 0.8.4 (commit recorded in infra/supabase/provenance.json), all baseline services retained, one root Compose.
- Random first-run secrets, private internal network, Caddy front door, persistent volumes, healthchecks.
- User-scoped Supabase requests; encrypted server-side sessions and opaque HttpOnly cookies; CSRF, rate limits, validation.
- SQL migrations, RLS, private image Storage, wardrobe/member/garment/image/job/outfit/history models.
- Polish landing/auth/dashboard/catalog/detail/editor/family/laundry/settings/outfit screens.
- Private/family wardrobes, invitation links with email binding, owner/editor/viewer roles.
- Multi-image upload and labels, image decoding and metadata stripping, worker image processing.
- Durable PostgreSQL job outbox, retries/backoff, progress, restart recovery and manual retry.
- Deterministic recommendations using owned garment IDs, saved outfits and wear history foundations.
- PWA manifest, icons, static-only precache, NetworkOnly private API/images.

## Verification — 2026-11-08

- `docker compose up -d --build` succeeded. All 15 long-running services are healthy; migrations completed successfully.
- `docker compose config --quiet` passed.
- Strict typecheck, ESLint and production builds passed with TypeScript 6.0.3.
- 14 Vitest domain/API injection tests passed.
- Real-stack integration passed: registration/logout/login, wardrobe creation, image upload/download, catalog/details, cross-tenant SQL RLS and Storage isolation, CSRF, invitations, viewer/editor roles, revocation, BullMQ processing, saved outfit IDs and wear history.
- Restart integration passed: opaque session, garment metadata and private image remained readable after API/worker/PostgreSQL/Storage/Redis restart; worker completed its persisted job. Added safe pool error handlers for database disconnections.
- 4 Playwright tests passed on Chromium desktop and Pixel 7 emulation, including the complete register → login → wardrobe → upload → save → catalog → details flow. No horizontal overflow on the tested detail layouts.
- Local idle Docker memory after testing: about 1.9 GiB summed container usage, within a 7.65 GiB Docker VM. API about 96 MiB, worker 80 MiB. This is not a peak-load or Proxmox N100 benchmark; 8 GB deployment recommendation remains.
- Frontend build is about 800 KiB uncompressed. Vite warns about the main JS chunk exceeding 500 KiB; route-level splitting is a future performance improvement.

## Build/runtime failures fixed

- Added explicit `workbox-window` required by the PWA virtual import.
- Selected TypeScript 6.0.3 to satisfy typescript-eslint's supported peer range.
- Added explicit ioredis client for BullMQ 6; worker now starts and completes real jobs.
- Retained the official Edge Runtime memory-pressure module and allowed outbound dependency downloads.
- Added a migration allowing a wardrobe owner to read INSERT RETURNING before the membership AFTER trigger runs.
- Fixed sidebar scrolling and short-screen layout so logout remains reachable.
- Added a loopback health endpoint for Caddy that also works with HTTPS domain configuration.

## Scope boundaries

Phase 1 does not claim AI analysis, weather service integration, ComfyUI, or generated outfit visualizations. Provider contracts are prepared; no AI actions are faked. SMTP delivery requires actual operator configuration and has not been verified. Invite links are copied/shared manually. Garments with existing images cannot yet move between wardrobes.

## Next

Configure and verify real SMTP and HTTPS on the deployment host; perform a backup restore drill. Next product milestone: Ollama photo/label analysis with validated, editable suggestions. Additional verification still needed: real mobile installation/offline/logout behavior, forced token refresh, password recovery delivery, manual failed-job retry and queue-loss recovery.

## Local database access

PostgreSQL is now published on `127.0.0.1:54322` for Postico on the Docker host. The generator preserves this loopback-only binding. Use database/user `postgres` and `POSTGRES_PASSWORD` from the local `.env`.

Verified an authenticated SQL query from the Mac host to `127.0.0.1:54322` (database/user `postgres`). Docker Desktop required a dedicated bridge network in addition to the internal application network for publishing this port.

## ONNX alpha/crop regression fixed — 2026-11-08

Changed `apps/worker/src/pipeline.ts`, added `apps/worker/src/mask.ts` and `tests/mask.test.ts`. Model and Ollama configuration unchanged. Root causes reproduced with Sharp: resizing raw grayscale without an explicit grayscale output produced 3 channels, but bounding-box code indexed it as 1; `removeAlpha()` also removed the joined alpha from PNG output. Cropping and rotation in one lazy Sharp pipeline additionally allowed rotation before extraction. The correction explicitly resizes to one channel, builds RGBA preserving source RGB, and materializes the crop before rotating. Pipeline version is v2; LLM angles are never applied automatically.

Two focused Vitest regressions passed; worker typecheck and scoped ESLint passed. The actual existing blazer was run through the corrected modules in `/tmp` of the existing Linux worker container, without migrations, database writes, rebuilding images or replacing the running worker's application files. 0°: 1.812 s, RGBA 1385×1623. 90° clockwise: 2.838 s, RGBA 1623×1385. Both: 694,920 fully transparent pixels, 1,315,381 fully opaque pixels. Catalog output is 1200×1500. Pixel comparison of 1,425,094 foreground pixels against the source found zero RGB differences; the 90° output exactly equals a pixel rotation of the 0° cutout. Original SHA-256 was preserved; the private fingerprint is retained only in local investigation artifacts.

Visual inspection: floor removed, no black band, buttons/pockets/texture preserved; faint soft edge/halo remains in places, appropriate as an MVP cutout rather than a professional hand-retouched mask. No ONNX inference error; a warning about missing CA certificates for telemetry was emitted. Private artifacts and reports are in `/private/tmp/wardrobe-onnx-fixed/`, not Git. The source fix is tested but not yet rebuilt into the production worker image.

## Optional and automatic names — prepared, waiting for migration approval

Step 1 of the names/bulk/rotation request is implemented in source only. New garments accept a missing name; migration `0006_automatic_names.sql` assigns `Ubranie <full garment UUID>` immediately and adds `name_source` (`temporary`, `ai`, `manual`). Existing names are untouched and classified as manual. A security-definer trigger serializes allocation per owner using a transaction advisory lock, checks every wardrobe owned by that user, suffixes automatic collisions, and rejects new manual duplicates. Existing duplicate names are grandfathered without renaming user data. Worker update permissions only allow replacement of still-temporary names; manual edits and explicit acceptance of a name mark it manual. AI-unavailable/failed jobs leave the temporary name unchanged.

Added a small shared locale configuration, controlled Polish noun/color agreement, translation of enum labels and known styles, and a language-review fallback for unsupported/English generated prose. Brands and verbatim OCR remain unchanged. All vision prompts receive the active locale instruction and requests use keep_alive=-1; no model or Ollama environment changes were made. Existing AI suggestions are normalized for display without rewriting stored user data.

Verification: 17 focused naming/domain/provider tests passed, all workspace typechecks passed, ESLint passed. Database concurrency/RLS integration and real UI upload/AI rename tests remain pending: migration has NOT been applied, no services rebuilt or recreated, and no database records changed for this step. Bulk upload and rotation preview/save are deliberately not started until step 1 can be verified after approval, following the requested sequence.

## Local NodemailerApp delivery

Added an opt-in `dev-mail` Compose profile with a private Node/Nodemailer SMTP forwarder. GoTrue connects without authentication over the internal network; the relay uses authenticated LOGIN to NodemailerApp on the Mac. No SMTP ports are published. Secrets stay in ignored .env; production profile is disabled by default. This is only for a trusted local development machine. Existing accounts/passwords are preserved. Development registration confirmation is enabled via local ENABLE_EMAIL_AUTOCONFIRM=false.

## Branded Polish authentication emails — 2026-11-08

Added six versioned Polish templates under `infra/auth-email` for confirmation, recovery, invitations, email changes, magic links and reauthentication codes. Shared generator reuses the frontend cream/forest palette, restrained branding, serif headings and accessible dark-green buttons. GoTrue variables remain intact. Subjects and body copy are locale-specific JSON; no full i18n system added.

Rebuilt and recreated only Auth, preserving its pinned GoTrue version. A loopback-only static server provides read-only template files over HTTP. SMTP, relay, other services, users, passwords, database and volumes were not changed. Actual confirmation and password-reset messages arrived in NodemailerApp with the requested Polish subjects. Received HTML passed 600px/375px rendering checks and visual inspection; local token-bearing verification URLs and recovery redirect were validated without following or consuming them. Screenshots in `/tmp/wardrobe-auth-email-previews` have tokens redacted. Other four delivery flows remain untested. Plain-text assets are generated, but GoTrue v2.197.0 only sends HTML, so multipart fallback is not claimed.

## Bulk upload — implemented, awaiting deployment approval

Added `/garments/import` via “Dodaj wiele ubrań” on catalog/dashboard. Up to 200 JPEG/PNG/WebP photos (10 MB each), file picker and drag/drop; one unnamed garment per image uses the existing temporary-name trigger. Three bounded uploads with 750 ms start spacing keep load below the existing API limit. Background processing and AI reuse existing database outbox/BullMQ paths; existing worker concurrency remains one for GPU requests. Batch state survives SPA navigation, but not page reload/closing; UI explains this. Uploaded records/jobs remain durable.

Each file retains garment/image UUIDs across retries. The authenticated creation endpoint reuses an existing same-owner garment on conflict without editing it. Image retries reuse the existing image or deterministic private Storage path with upsert disabled, including recovery after Storage succeeded but image insertion failed. No schema migration required; read-only verification confirms 0006 is already installed. Progress shows uploads, processing, completed and failures; per-file upload retries are available. Processing failures can be retried through the existing garment detail mechanism. Invalid files remain individually identified, without canceling valid files.

Verification: queue/validation tests include 200 simulated files with maximum concurrency three; mocked Fastify/Supabase tests cover duplicate create, different-owner rejection, duplicate image retry and orphan-original recovery. Playwright with mocked API verifies 201-file rejection, four independent garments, one failed upload and retry without duplicates, navigation during upload and mobile layout without horizontal overflow. No real database writes, AI calls or original-photo changes were made for these tests. Workspace typechecks, scoped ESLint and web production build passed (existing large-bundle warning remains). No Docker rebuild/deployment performed; end-to-end private Storage and real worker verification remains pending deployment approval.

Deployment scope: API + web, and worker to activate previously prepared automatic naming. Read-only inspection confirmed the running worker already serializes AI requests, but does not yet contain the name_source='ai' update. Rebuild/recreate these three services only after user approval; Auth/SMTP and all data services must remain untouched. Final focused verification: 21 tests passed across five files.

## Bulk upload deployed — 2026-11-08

User approved deployment. Rebuilt and recreated only api, web and worker with --no-deps --no-build; before/after container IDs confirm every other service remained untouched. All three report healthy, and startup logs have no error/fatal entries. API health and deployed OpenAPI confirm client-supplied garment IDs and upload_id retry parameters. Running worker contains automatic naming, serialized AI requests and u2netp-catalog-v2. Effective SMTP/confirmation and Ollama settings were verified unchanged; no migrations, volumes or original photos were modified.

Playwright ran against the deployed frontend at localhost:8080 with intercepted API requests: 201-file rejection, four separate garments, one upload failure and safe retry, navigation preserving the batch and mobile width checks passed. These browser records were mock-only. Real authenticated bulk upload through private Storage and the live processing queues was not exercised; no test user data or expensive Ollama calls were created. Use “Dodaj wiele ubrań” in the catalog or /garments/import after refreshing the SPA/PWA.

## Bulk upload permission failure — fix prepared

Real import exposed a gap missed by mocked Supabase tests: the initial schema grants INSERT per column, and neither garments.id nor garment_images.id is included. Bulk upload supplies these UUIDs for idempotency, so authenticated inserts are denied before any photo upload. Prepared additive 0007_bulk_upload_ids.sql granting INSERT on those two UUID columns only; existing RLS and ownership/membership checks remain unchanged. Requires user approval before applying. No existing records or photos need changing. The open import tab retains UUIDs/files for safe retry after the grant. Previous mock-only verification was insufficient for this database permission boundary.

## Bulk upload permission correction applied — 2026-11-08

User explicitly approved migration 0007. Applied only its two INSERT(id) grants and PostgREST schema notification in a transaction under the migration advisory lock, recording the SHA-256 checksum in private.schema_migrations. No services rebuilt or restarted. Added tests/bulk-permissions.sql and ran against the actual installed database with role authenticated: explicit garment UUID insertion and temporary naming passed; explicit image UUID insertion queued the expected two jobs; an unrelated identity was denied by RLS. The entire test transaction rolled back, leaving no test garments/images/jobs. Existing originals and records were untouched. The open browser batch can retry immediately without refreshing or losing file/UUID state.

## Ollama model selection — 2026-11-08

At the user's request, changed only the local ignored .env OLLAMA_VISION_MODEL to qwen3-vl:8b and recreated worker without dependencies or rebuilding. LAN URL and provider keep_alive=-1 remain unchanged. No other services, models, database records or volumes were modified. Model selection alone does not establish that the previously failing analysis/JSON validation is resolved.

## Bull Board — prepared, awaiting API deployment approval

Added a read-only Bull Board at /api/admin/queues/ inside existing Fastify, using pinned @bull-board/api and @bull-board/fastify 9.12.0 with existing BullMQ/ioredis versions. It exposes wardrobe and wardrobe-ai. Only authenticated users explicitly allowlisted by UUID in QUEUE_ADMIN_USER_IDS can access HTML, static assets or dashboard API. Local allowlist includes the existing owner's account; no database roles/users changed. Empty allowlist disables the panel. Redis URL is provided only to the BFF over the internal network. No public Redis port or extra service. Mutating dashboard requests are denied server-side; retry remains in garment details to preserve PostgreSQL job state. Existing Redis retention is unchanged, so this is not a durable job-history screen. See docs/queue-board.md.

Verified 11 tests, including real Bull Board HTML/static rendering, anonymous and ordinary-user rejection, read-only enforcement and existing API security tests. API typecheck passed. No migrations, queue mutations, worker changes or container restarts performed for this feature yet. Only API requires rebuild/recreate after approval; live Redis/browser verification remains pending deployment.

## Bull Board deployed — 2026-11-09

After explicit user approval, built and recreated API only with --no-deps --no-build. Live read-only probe of the installed dashboard against the real Redis returned HTML 200 and queue API 200, both wardrobe and wardrobe-ai marked readOnlyMode=true. At verification, wardrobe was empty and wardrobe-ai had one active and 88 waiting jobs. Probe used a separate in-process Fastify instance, no public listener, no queue mutations or login bypass in the running application. The actual deployed routes through the existing web reverse proxy returned 401 for anonymous HTML and queue API. API health returned 200. Local administrator allowlist is configured. No migrations, worker/SMTP changes or job retries were performed. Full authenticated browser appearance remains unverified; actual HTML/assets were covered by prior adapter tests.

## Seven-day BullMQ retention — prepared, awaiting worker deployment approval

Both queues now use removeOnComplete/removeOnFail {age:604800,count:1000}: retain up to seven days, at most 1000 per terminal state per queue. Count is a cap, not a minimum; sixty recent jobs remain. Existing queued jobs keep their original options, and deleted history cannot be recovered. Added dispatchJob reconciliation so retained completed/failed Redis IDs cannot block PostgreSQL-authorized manual retry or delayed requeue after AI unavailability. Terminal history is preserved unless the durable DB explicitly queues that same job again. No database/Redis mutations or deployment performed for this step.

## 2026-11-09 — reset konta developerskiego i FashionSigLIP CPU

Na wyraźne polecenie właściciela usunięto bez wykonywania backupu 92 ubrania, 92 rekordy zdjęć, 195 powiązanych rekordów zadań, 2 stylizacje i 383 obiekty prywatnego Storage. Usunięto 91 istniejących wpisów BullMQ wyłącznie po ID związanych z tymi ubraniami. Porównanie fingerprintów potwierdziło zachowanie konta Auth, profilu, sesji, garderób, członkostw, ustawień oraz danych pozostałych użytkowników. Nie zmieniono schematu ani wolumenów. Istniejące pliki investigation pozostawiono.

Domyślny provider analizy zdjęć ubrań: lokalny FashionSigLIP (oficjalny encoder ONNX quantized, przypięty SHA/revision, CPU 2 wątki, współbieżność kolejki 1). Istniejący upload/outbox automatycznie uruchamia ten provider. Ollama pozostaje opcjonalna, używana do OCR metek; nie zmieniono jej modeli ani adresu. Klasyfikator proponuje kategorię, kolor, wzór i polską nazwę, bez zgadywania materiału, rozmiaru, grubości czy ciepła. Wyniki cosine nie są procentową pewnością. Ręczne nazwy pozostają chronione. Gdy brak ręcznego obrotu, porównywane są cztery obroty wyłącznie dla klasyfikacji; obraz nie jest automatycznie obracany. Obróbka ONNX tła zachowana.

UI pokazuje nazwę FashionSigLIP, czas, wzór i top 5 kategorii; metadane wymagają zatwierdzenia. Nieobecne sugestie nie dostają domyślnych wartości z formularza. Przycisk ponownej analizy jest warunkowany dostępnością istniejącego RPC (migracja 0008 nadal nie jest stosowana w tym zadaniu).

Weryfikacja: 14 testów (klasyfikacja cosine/Polish, nazwy, maski, provider Ollama), lint zmienionych plików; rzeczywista inferencja ONNX w kontenerze CPU na zachowanej kopii marynarki: Granatowa marynarka, 6.076 s, RSS 446 MiB. Oryginał bez zmian. Nie jest to pomiar na N100/N150 ani ocena całej garderoby. Wagi 90 MiB gitignored, instrukcja pobrania w infra/models/fashion-siglip/README.md. investigation wykluczono z kontekstu builda.

Wdrożono wyłącznie worker, API i web (`up --no-deps --no-build`), bez migracji. Efektywny provider: fashion-siglip. Worker i API odpowiadają HTTP 200, modele/adres Ollamy zachowane. Autoryzacja i nowe przesyłanie zdjęć wymagają końcowego testu użytkownika na jego istniejącym koncie; nie dodawano sztucznych ubrań po wyczyszczeniu garderoby.

## 2026-11-09 — widoczny wynik pustych rekomendacji

Przycisk „Zaproponuj zestawy” działał, lecz po odpowiedzi z pustą listą pozostawiał identyczny ekran startowy. Odczyt danych: 89 czystych, niearchiwalnych ubrań zapisanych jako tops, bez bottoms/dresses. Nie zmieniano kategorii ani danych użytkownika. Po pustej odpowiedzi widok wyjaśnia brak zestawu, wymagania kategorii oraz potrzebę zatwierdzenia sugestii FashionSigLIP i prowadzi do garderoby. Stan wyniku związany z garderobą, okazją i temperaturą.

Poprawkę komunikatu pustych rekomendacji wdrożono tylko w web. Typecheck, lint, build i test Playwright (jedno żądanie, pusty wynik, widoczny komunikat i link do garderoby) przeszły. Nowe żądanie: automatycznie stosować pierwszą klasyfikację, późniejsze tylko po akceptacji. Obecny worker ma uprawnienia UPDATE wyłącznie name/name_source; automatyczny zapis kategorii wymaga addytywnej zmiany uprawnień/RLS. Propozycja do przeglądu: docs/pending-initial-classification.sql, NIE zastosowano. Implementacja powinna objąć kontrolę rewizji, blokadę wiersza, brak wcześniejszej analizy oraz ochronę ręcznej edycji; propozycja polityki nie jest samodzielnym ukończonym rozwiązaniem. Kategorie istniejących 89 ubrań nie zostały zmienione.

## 2026-11-09 — pierwsza klasyfikacja i lokalne Studio

Zatwierdzono i zastosowano tylko addytywne migracje 0009/0010 (0008 nadal pominięta). Wąska funkcja workera zapisuje kategorię/podkategorię/kolory i tymczasową nazwę przy pierwszej analizie nietkniętego ubrania. Sprawdza membership, typ/status zadania, rewizję, brak wcześniejszej analizy i niezmienione updated_at, blokuje wiersz. Ręczne nazwy i niepuste metadane zachowane. Nie przyznano ogólnego UPDATE metadanych; tylko EXECUTE funkcji. Reanalizy i ręcznie zmienione ubrania pozostają sugestiami. Nie zastosowano wstecznie do 89 istniejących ubrań. Test SQL z pełnym rollbackiem: początkowy zapis, odmowa powtórnego zapisu, ochrona ręcznych zmian; rzeczywiste połączenie wardrobe_worker potwierdziło dostęp do funkcji i odrzucenie nieistniejącego zadania. Typecheck/lint/build przeszły; wdrożono worker i web.

Studio było już zdrowe w istniejącym Compose, bez portu hosta. Oficjalny Envoy gateway udostępniono na 127.0.0.1:8000, z istniejącym Basic Auth (DASHBOARD_USERNAME/PASSWORD), przez dedykowaną sieć studio-access; sieć default pozostaje internal. Studio restart unless-stopped i brak profilu zapewniają automatyczny start. Nie zmieniono SMTP, kluczy Auth, danych ani wersji usług.

## 2026-11-09 — usuwanie garderób w ustawieniach (gotowe do zatwierdzenia wdrożenia)

Dodano listę garderób w Ustawieniach, przycisk Usuń tylko dla właściciela, dialog z Anuluj i jednoznacznym potwierdzeniem utraty wszystkich ubrań, zdjęć, stylizacji i historii (także w garderobie rodzinnej). Konto pozostaje. API używa sesji użytkownika i właścicielskiego RPC; brak service-role w BFF. Addytywna migracja 0011 tworzy prywatny trwały rejestr sprzątania, zapisany atomowo z usunięciem garderoby. Worker po 30 s usuwa tylko powiązane job IDs i pliki pod dokładnym prefiksem UUID usuniętej garderoby; retry i restart zachowują rejestr do pełnego sukcesu. Nie opróżnia globalnych kolejek. Zapis wariantów zdjęć osłonięto blokadą trwałego zadania, aby aktywne przetwarzanie nie odtwarzało plików po skasowaniu garderoby. Retry sprzątania nie zatrzymuje innych zadań.

Weryfikacja: typecheck API/worker/web, lint zmienionych plików, 5 testów cleanup/cancellation. Integracja SQL w transakcji z rollbackiem: zakaz usunięcia przez obcego użytkownika, kaskada ubrań i jobów, zachowanie konta oraz trwały wpis sprzątania. Nie usunięto żadnej rzeczywistej garderoby. Migracja 0011 NIE zastosowana; usługi NIE przebudowane ani wdrożone. Oczekuje na zgodę na migrację i wdrożenie API/worker/web. Potwierdzenie dialogu w rzeczywistej przeglądarce pozostaje do sprawdzenia po wdrożeniu.

Wdrożenie zatwierdzone i wykonane: migracja 0011 z zapisanym checksumem, build i odtworzenie wyłącznie API/worker/web. Bez usuwania rzeczywistych garderób. Test Playwright na wdrożonym interfejsie z atrapą API potwierdził: przycisk tylko dla właściciela, ostrzeżenie o ubraniach, Anuluj bez DELETE, potwierdzenie z jednym DELETE i odświeżenie listy. Rzeczywisty worker potwierdził SELECT FOR UPDATE tabeli sprzątania i health HTTP 200; API healthy. Ostrzeżenie Fastify o wycofywanej opcji logowania nie blokuje działania.

## 2026-11-09 — różnorodność stylizacji

Generator losuje kolejność możliwych połączeń, następnie wybiera do sześciu zestawów z priorytetem najmniej używanych ubrań. Przy co najmniej sześciu pasujących górach i dołach zestawy mają różne góry i różne doły; przy brakach powtórzenia są równoważone bez duplikowania kompletnej bazy. Buty i okrycia również losowane i dobierane rotacyjnie. Zachowano filtry czystości, archiwizacji, okazji i temperatury; brak nowych wywołań AI i zmian danych. Testy: 10 testów domeny, w tym 6 unikalnych gór/dołów, różne wyniki dla różnych ziaren losowania, równomierne wykorzystanie dwóch gór oraz pojedynczy dostępny komplet. Typecheck API i lint przeszły. Zmieniona logika jest wykonywana przez BFF, więc do wdrożenia wystarczy API.

Wdrożono wyłącznie API (`--no-deps --no-build`), bez migracji i zmian danych. Test na działającym obrazie: 6 zestawów, 6 różnych gór i 6 różnych dołów na syntetycznych danych wyłącznie w pamięci; API health 200.

## 2026-11-09 — zbiorcza ponowna analiza garderoby (oczekuje na wdrożenie)

W Ustawieniach przy każdej własnej garderobie dodano „Ponów analizę AI wszystkich ubrań”, stan zlecania i liczniki nowych/oczekujących/bez zdjęcia. BFF używa sesji użytkownika i RPC public.reanalyze_wardrobe, bez administracyjnych danych dostępu. Addytywna migracja 0012 sprawdza właściciela, blokuje garderobę i wybrane zdjęcia, wybiera jedno najstarsze zdjęcie garment na ubranie, zachowuje oryginał, obrót i rewizję. Zleca wyłącznie analyze_garment w istniejącym outboxie, pomija queued/processing tej samej rewizji. Nie powtarza ONNX tła ani OCR metek. Worker już przekazuje zapisaną rotację do FashionSigLIP i wykonuje kolejkę z concurrency 1; nie wymaga zmian. Ponowna analiza istniejących ubrań pozostaje sugestiami do akceptacji.

Test SQL na syntetycznej garderobie w pełni wycofanej transakcji: brak dostępu obcego użytkownika, jedno zdjęcie mimo wielu fotografii, drugie wywołanie bez duplikatów, licznik ubrań bez fotografii, zachowanie kąta 90°, ręcznej nazwy i kategorii. Typecheck API/web i lint przeszły. Migracja 0012 NIE zastosowana, niczego nie zakolejkowano w rzeczywistej garderobie. Do zatwierdzenia: zastosowanie 0012 i build/deploy wyłącznie API/web. Test interakcji przycisku w przeglądarce pozostaje do wykonania po wdrożeniu.

Wdrożenie 0012 zatwierdzone i wykonane: zastosowano migrację z checksumem i odtworzono wyłącznie API/web (`--no-deps --no-build`); worker i Supabase bez restartu. Test Playwright na wdrożonym interfejsie z atrapą API przeszedł: właściwy POST dla garderoby, przycisk zablokowany podczas żądania, liczniki zakolejkowanych/oczekujących/brakujących zdjęć. API health 200. Nie zlecono żadnej rzeczywistej analizy; użytkownik uruchamia ją sam przyciskiem w ustawieniach.

## 2026-11-09 — trwała aktywność analiz w UI

Dodano autoryzowany GET /api/analysis/activity, odczytujący przez Supabase z tokenem użytkownika/RLS wszystkie aktywne queued/processing analizy (keyset pagination zamiast limitu historii 20 rekordów), agregowane według zdjęcia i garderoby. Frontend odpytuje stan co 3 s. W ustawieniach spinner i przycisk z liczbą pozostałych zadań pozostają zablokowane do zniknięcia aktywnych analiz, także po odświeżeniu. Błąd odczytu stanu blokuje ponowne zlecenie i pokazuje błąd. Po zleceniu wykonywany jest refetch przed zdjęciem blokady żądania. W szczegółach zdjęcia aktywna analiza ma spinner/status, przycisk ponowienia blokowany jest także przez stan trwały; zadania i obróbka zdjęć również mają spinner w kolejce/przetwarzaniu. Historia zadań odświeżana stale, aby wykryć zadania zlecone poza stroną ubrania. Bez zmian danych, modeli, migracji i workera. Typecheck API/web i lint przeszły.

Wdrożono wyłącznie API/web, bez migracji i restartu workera. Test Playwright na wdrożonym interfejsie z atrapą API: spinner/blokada podczas żądania i aktywnych zadań, utrzymanie blokady po reload, odblokowanie po ustaniu aktywności — zarówno ustawienia garderoby, jak i szczegóły zdjęcia. API health 200, niezalogowany odczyt aktywności 401. Nie zlecono rzeczywistych analiz w teście.

## 2026-11-09 — logowanie z iPhone przez LAN

Diagnoza: mutujące żądania z http://192.168.0.217:8080 były odrzucane przez porównanie Origin wyłącznie z APP_ORIGIN=http://localhost:8080. COOKIE_SECURE już było false dla lokalnego HTTP. Dodano jawny APP_ADDITIONAL_ORIGINS (CSV), walidowany jako dokładne HTTP(S) originy bez ścieżek, haseł i wildcardów. Lokalny .env rozszerzono wyłącznie o origin laptopa; localhost zachowany. Nie ufamy nagłówkowi Host i nie wyłączamy CSRF. Brak zmian SMTP, GoTrue, kluczy, portów czy danych użytkownika.

Typecheck API, lint i 4 testy przeszły: localhost/LAN z poprawnym CSRF docierają do walidacji danych logowania bez wywoływania Auth; obce originy i LAN bez CSRF nadal 403; odrzucanie nieprawidłowej konfiguracji. Brak testu rzeczywistego konta/hasła na fizycznym iPhonie.

Wdrożono wyłącznie API, health healthy. Rzeczywisty HTTP przez localhost:8080 i 192.168.0.217:8080: dozwolony origin + CSRF trafia do walidacji pustego formularza (400), brak CSRF oraz obcy origin są blokowane (403). Bez przesyłania danych konta i bez zmian hasła. Użytkownik powinien ponowić logowanie na fizycznym iPhonie.

## 2026-11-09 — uporządkowanie Git, Storage i metadanych

- Bazowo 65 testów i lint przechodziły. Rozdzielono istniejącą pracę na commity: ochrona danych, infrastruktura, schematy/reguły, historyczne migracje, CPU/ONNX/FashionSigLIP, worker, BFF, frontend i izolowane testy. Nie wykonano resetu, clean, amend, rebase ani push. Staged diffy sprawdzano i skanowano pod kątem wartości sekretów z lokalnego .env. Pliki investigation/data, backupy i wagi są ignorowane przez Git oraz narzędzia; nie było śledzonych prywatnych zdjęć czy danych (jedynie publiczny .env.example).
- Backup Storage: investigation/backups/storage-migration/2026-11-09T20-42-51.893Z; 548 plików, 956513122 bajtów. Manifest SHA256 zgodny po testowym odtworzeniu plików; pełny postgres.dump odczytany przez pg_restore (lista i dekodowanie całego archiwum). Zachowano prywatną kopię konfiguracji z uprawnieniami 0600. Nie wykonywano odtworzenia PostgreSQL na osobnej instancji. Plan wykonania/rollbacku: investigation/reports/storage-migration/plan.md. Migracja Storage OCZEKUJE NA POTWIERDZENIE; obecny named volume i mounty niezmienione.
- Ciepłota: wspólne reguły 1–5, wartości z wizji zastępowane regułami kategorii, akcesoria pomijane termicznie. Formularz aktualizuje domyślną wartość przy zmianie kategorii/podkategorii; ręczna korekta ma pierwszeństwo w bieżącej edycji i zapisuje wartość. Kolejna edycja zachowuje zapisaną wartość, a ponowna zmiana kategorii znów wylicza domyślną. Dodano znacznik ręcznej wartości, bez drugiej skali ciepłoty. Brak masowej aktualizacji istniejących ubrań.
- Opcja AI w profilu: domyślnie wyłączona, osobna dla użytkownika, trwała, nie uruchamia zadań. Włączenie pozwala nadpisać obsługiwane metadane własnych ubrań przy następnej analizie (również ręczne), z zachowaniem ręcznych nazw, notatek, materiału/rozmiaru, zdjęć, właściciela i relacji. Dodano przechowywany wzór. Puste/null/unknown i nieprawidłowe enumy są pomijane. SQL blokuje wiersz, sprawdza owner/requester/membership/rewizję/preferencję i dokładny timestamp sprzed inferencji. Zmiana podczas analizy odrzuca automatyczny zapis. Naprawiono też wstawianie domyślnych pustych pól przez PATCH przy edycji pojedynczego pola.
- Zastosowano wyłącznie nowe addytywne migracje 0013 i 0014. Porównanie fingerprintów przed/po potwierdziło niezmienność istniejących metadanych ubrań/profili, zdjęć, liczby obiektów Storage i haseł kont. Historyczna 0008 pozostaje niewdrożona — nie uruchamiano całego migratora ani zmian kontroli anulowania.
- Paski: opcjonalny dobór wyłącznie dostępnego paska z tej samej garderoby do kompatybilnych spodni/chinosów/jeansów. Uwzględnia kolory i styl, preferuje uzasadnioną zgodność z obuwiem. Wyklucza dresy, legginsy, joggery, spódnice i spodnie na gumce. Nie zastępuje bazy stylizacji, nie wymyśla akcesoriów i nie dolicza ich ciepłoty.
- Weryfikacja: 97 testów jednostkowych/API przeszło, lint i typecheck wszystkich pakietów bez błędów. SQL/RLS na dwóch syntetycznych kontach z pełnym rollbackiem: upload/permissions, nazwy, usuwanie, zbiorcza analiza, ciepłota, preferencja i zapis AI/konflikty. Testy przeglądarkowe na atrapach API: formularz ciepłoty (w tym ręczna korekta i kolejna edycja), trwały checkbox, izolacja użytkowników i cofnięcie po błędzie; brak automatycznego masowego kolejkowania. Pierwsze podejścia testów wykryły nieaktualne oczekiwanie ciepłoty polo i błędne selektory/nazwy fixture; poprawiono je, a logi zachowano w investigation. Bez zapytań do Ollamy/GPU i bez nowych modeli.


## 2026-11-10 — wznowienie po wyłączeniu komputera

Sprawdzono stan bez ponawiania migracji i buildu. Docker Desktop wymagał uruchomienia; istniejące usługi wróciły jako healthy. Potwierdzono 92 ubrania, 92 rekordy zdjęć, 548 obiektów Storage i obecność 0013/0014 z checksumami zgodnymi z repozytorium. Wszystkie trzy kontenery aplikacji używały starszych obrazów; dokończono wyłącznie ich wdrożenie z wcześniej zbudowanych obrazów (`--no-deps --no-build --wait`). Supabase i mounty nie były odtwarzane ani zmieniane.

Nowe API/worker/web są healthy. Brakujące testy na wdrożonym interfejsie (z atrapami API) przeszły: formularz ciepłoty, zapis ręcznej korekty, ponowna zmiana kategorii w kolejnej edycji, checkbox domyślnie off, zachowanie po reload, izolacja użytkowników, cofnięcie wartości po błędzie i brak masowej analizy. Odczyt przez wewnętrzny Storage API jednego zdjęcia należącego do wskazanego użytkownika: oryginał, wycięcie, katalog i miniatura; wszystkie SHA256 zgodne z wcześniejszym backupem. Test nie zapisywał ani nie usuwał obiektów. Zachowane poprzednie wyniki 97 testów, lint, typecheck i build — nie uruchamiano ich ponownie bez potrzeby. Rzeczywiste logowanie hasłem na koncie użytkownika oraz pełne odtworzenie PostgreSQL na osobnej instancji pozostają nieweryfikowane.

Storage nadal korzysta z `smart-wardrobe_storage-data`; ./data/storage nie istnieje. Backup i plan pozostają w ignorowanym investigation. Migracja do katalogu projektu nadal wymaga osobnego potwierdzenia. Historyczna 0008 oraz propozycja dodatkowych ograniczeń ścieżek nie zostały zastosowane. Nie wykonywano push, zmiany modeli, nowych eksperymentów ani masowej analizy ubrań.

Dodatkowa weryfikacja po awarii zasilania: odczytowe porównanie całego drzewa starego wolumenu Storage z wcześniejszym manifestem backupu potwierdziło 548/548 plików, bez braków, dodatkowych plików i zmian SHA256. Test ochrony logowania: zdrowie API 200, niezalogowane endpointy konta/preferencji 401, pusty formularz z prawidłowym originem i CSRF dociera do walidacji (400), bez przesyłania hasła. Kod API/workera/wspólnych reguł w kontenerach zgodny z bieżącymi plikami repozytorium. Odtworzono wyłącznie kontenery api, web i worker.
