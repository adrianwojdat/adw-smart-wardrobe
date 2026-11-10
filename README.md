# Smart Wardrobe

Prywatna, self-hosted garderoba dla Ciebie i rodziny. Polski interfejs React SPA, Fastify BFF, oficjalny Supabase, Redis i BullMQ w **jednym Docker Compose**.

## Uruchomienie

Wymagane: Docker Engine z Compose v2, Node.js 26 LTS do wygenerowania sekretów, dostęp do Internetu podczas pierwszego builda. Zalecany punkt startowy: 4 vCPU, 8 GB RAM i 40–60 GB SSD plus zdjęcia i backupy.

```sh
node scripts/setup.mjs
# Opcjonalnie dostosuj adres instalacji i SMTP w .env.
docker compose up -d --build
```

Otwórz **http://localhost:8080**, utwórz konto, garderobę i dodaj pierwsze ubranie. `.env` jest generowany z losowymi sekretami, ignorowany przez Git i nie jest nadpisywany przy ponownym setupie. Nie potrzeba Supabase Cloud, osobnego Supabase ani działającego Ollama.

Domyślna konfiguracja lokalna pozwala rejestrować konta bez potwierdzenia email. Reset email wymaga SMTP. Dla LAN/HTTPS ustaw spójnie APP_ORIGIN, SITE_URL, SUPABASE_PUBLIC_URL, API_EXTERNAL_URL i COOKIE_SECURE zgodnie z [instrukcją wdrożenia](docs/deployment-proxmox.md).

`migrate` kończy pracę kodem 0 po zastosowaniu migracji — nie jest stale działającym kontenerem. PostgreSQL i Redis korzystają z named volumes, zdjęcia z `./data/storage/`. Nie wykonuj `docker compose down -v` na instalacji z danymi.

Na **macOS używaj OrbStack** (`docker context use orbstack`): standardowy backend Supabase Storage wymaga działających linuksowych xattr na katalogu zdjęć. Bieżące współdzielenie katalogów Docker Desktop nie spełnia tego warunku. Zmiana kontekstu nie przenosi istniejących wolumenów — działającą instalację trzeba najpierw bezpiecznie zmigrować. Szczegóły: [Storage i xattr](infra/storage/README.md).

## Działający zakres fazy 1

- Rejestracja, logowanie, wylogowanie, sesje HttpOnly z odświeżaniem po stronie serwera; formularze odzyskiwania i zmiany hasła.
- Prywatne i rodzinne garderoby, zaproszenia poprzez link przypisany do email, role owner/editor/viewer.
- Katalog, wyszukiwanie, kategorie, ulubione, edycja, archiwum i usuwanie ubrań.
- Wiele prywatnych zdjęć ubrania i metki; JPEG/PNG/WebP do 10 MB, dekodowanie i usuwanie EXIF.
- Widok szczegółów inspirowany `docs/ui-reference.png`, responsywna nawigacja, polskie etykiety i stany puste.
- Zadanie przetwarzania obrazu w osobnym workerze, trwały outbox PostgreSQL, ponawianie i postęp.
- Zestawy według jawnych reguł wyłącznie z posiadanych ubrań, zapis zestawów, status prania i historia noszenia.
- PWA z ikonami i powłoką offline. Prywatne API i obrazy nie są cache’owane.

Analiza Ollama, OCR, pogoda z zewnętrznego serwisu, ComfyUI i realistyczne wizualizacje należą do kolejnych faz. Obecne propozycje zestawów są oparte na regułach, nie na AI. Przenoszenie ubrania ze zdjęciami pomiędzy garderobami pozostaje do implementacji.

## Development i testy

Node 26.13.0, pnpm 12.18.0; wszystkie zależności są przypięte w manifestach i `pnpm-lock.yaml`.

```sh
npm install -g pnpm@12.18.0
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
# Poniższe wymagają uruchomionego pełnego stosu lokalnego:
pnpm test:stack
pnpm test:e2e
```

`test:stack` tworzy własne konta testowe, sprawdza API, SQL RLS, Storage, role, kolejkę i zestawy, a po sukcesie usuwa swoje rekordy. Wymaga lokalnego dostępu Docker do testowanej bazy. Playwright wykonuje przepływ użytkownika dla desktopu i telefonu; pozostawia konta i garderoby z nazwą E2E, aby można było obejrzeć wynik. Uruchamiaj te testy na instalacji developerskiej.

`pnpm dev` uruchamia frontend Vite na 5173 z proxy do API na 3000. Pełny Compose jest główną, przetestowaną drogą uruchomienia; porty wewnętrznych usług nie są publikowane. Praca z lokalnym API wymaga świadomego skonfigurowania połączeń developerskich i APP_ORIGIN.

## Dokumentacja

- [Wdrożenie na Proxmox LXC, HTTPS i SMTP](docs/deployment-proxmox.md)
- [Architektura, sesje, RLS i zadania](docs/architecture.md)
- [Backupy, odtwarzanie i aktualizacje](docs/operations.md)
- [Postęp, wyniki testów i ograniczenia](docs/progress.md)
- [Konwencje i komendy dla agentów](AGENTS.md)
- OpenAPI po uruchomieniu: http://localhost:8080/api/docs

Baseline Supabase: oficjalne wydanie self-hosted **0.8.4**, commit zapisany w `infra/supabase/provenance.json`. Zachowano wszystkie usługi bazowe; Caddy obsługuje dostęp do aplikacji; PostgreSQL i Studio mają osobne porty ograniczone do 127.0.0.1. Repozytorium nie wykonuje żadnych operacji administracyjnych na hoście Proxmox.

## Postico na Macu

Połączenie lokalne: host `127.0.0.1`, port `54322`, użytkownik `postgres`, baza `postgres`, hasło z `POSTGRES_PASSWORD` w `.env`. PostgreSQL jest udostępniony wyłącznie na interfejsie loopback hosta Docker; Redis pozostaje wewnętrzny.

Analiza ubrań działa domyślnie lokalnie na CPU przez FashionSigLIP (`GARMENT_ANALYSIS_PROVIDER=fashion-siglip`). Przed pierwszym buildem na nowym hoście pobierz przypięty encoder według [instrukcji modelu](infra/models/fashion-siglip/README.md). Nie wymaga Ollamy; OCR metek nadal korzysta z opcjonalnego komputera LAN. Pierwsza analiza nowego, nieedytowanego ubrania uzupełnia dane automatycznie; ponowne analizy pozostają sugestiami, chyba że użytkownik włączy automatyczne nadpisywanie. Podobieństwo nie jest procentową pewnością.

Supabase Studio: http://localhost:8000 (wyłącznie 127.0.0.1). Logowanie administracyjne: `DASHBOARD_USERNAME` i `DASHBOARD_PASSWORD` z lokalnego `.env`, nie konto aplikacji. Studio startuje automatycznie z `docker compose up -d`; istniejący oficjalny gateway wymaga Basic Auth. Nie udostępniaj tego portu przez tunel lub publiczny reverse proxy.

Dostęp z telefonu w LAN: otwórz `http://<IP-laptopa>:8080` i dodaj ten dokładny origin do `APP_ADDITIONAL_ORIGINS` w `.env` (lista oddzielona przecinkami). `APP_ORIGIN` pozostaje głównym adresem aplikacji. Po zmianie odtwórz tylko API: `docker compose up -d --no-deps api`. Nie stosuj wildcardów. Przy zmianie adresu IP laptopa zaktualizuj listę. `COOKIE_SECURE=false` dotyczy lokalnego HTTP; dla wdrożenia HTTPS używaj `true`.

## Ciepłota i automatyzacja metadanych

Ciepłota pozostaje w skali 1–5 i wynika ze wspólnych reguł kategorii. Formularz przelicza ją po zmianie kategorii/podkategorii; ręczna korekta ma pierwszeństwo w bieżącej edycji i jest zapisywana. Akcesoria nie mają wkładu cieplnego w generatorze stylizacji.

W Ustawieniach opcja „Pozwalaj AI na nadpisywanie metadanych ubrań” jest domyślnie wyłączona i zapisywana osobno dla każdego użytkownika. Po włączeniu następne analizy własnych ubrań mogą automatycznie aktualizować obsługiwane parametry, w tym kategorię, kolory, wzór i wyliczoną ciepłotę. Ręczne nazwy, notatki, właściciel, zdjęcia i relacje pozostają zachowane. Niepewnego materiału i rozmiaru nie uzupełniamy ze zdjęcia. Zmiana ubrania w trakcie analizy blokuje automatyczny zapis starego wyniku. Włączenie opcji nie uruchamia masowej analizy.

Generator może dodać istniejący, dostępny pasek do kompatybilnych spodni. Uwzględnia kolor i styl, w szczególności obuwie; pomija dresy, legginsy, joggery i spódnice. Pasek jest opcjonalnym dodatkiem.

Próbę przeniesienia Storage i rollback opisuje lokalny, ignorowany raport `investigation/reports/storage-migration/plan.md`. Na obecnym Macu bind mount nie obsługuje wymaganych przez Storage 1.89.12 atrybutów Linux `user.supabase.*` (ENOTSUP), więc przywrócono działający named volume. `data/storage/` zawiera nieaktywną kopię, która nie aktualizuje się wraz z aplikacją. Przed kolejną próbą wymagany jest test xattr na docelowym filesystemie; same sumy plików i uprawnienia nie wystarczają. Backup musi zawierać również eksport atrybutów rozszerzonych. Nie kopiuj zdjęć do Git ani nie usuwaj starego wolumenu. Pobrane wagi modeli również pozostają poza Git; zachowaj je przy wdrożeniu na kolejnym hoście.
