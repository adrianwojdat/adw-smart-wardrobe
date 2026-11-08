# Architektura i decyzje

## Granice systemu

Przeglądarka komunikuje się wyłącznie z `/api/*` Fastify przez Caddy. React to SPA z Vite i TanStack Router; nie używamy SSR. TanStack Query przechowuje stan tylko w pamięci. Wspólne schematy Zod walidują wejście BFF oraz odpowiedzi klienta. OpenAPI: `/api/docs` i `/api/docs/json`.

BFF używa Supabase Auth do rejestracji, weryfikacji haseł, resetów i odświeżania tokenów. Opaque session ID trafia do HttpOnly SameSite=Lax cookie; jego SHA-256 jest kluczem sesji PostgreSQL. Tokeny GoTrue są szyfrowane AES-256-GCM kluczem `SESSION_ENCRYPTION_KEY`. Blokada wiersza serializuje refresh między równoległymi żądaniami i instancjami. Sesja ma absolutny termin 30 dni. JWT nie trafia do localStorage ani odpowiedzi klienta.

Po uwierzytelnieniu BFF tworzy klienta Supabase z JWT danego użytkownika. Anon key identyfikuje aplikację, nie podnosi uprawnień. Wszystkie dane biznesowe przechodzą przez PostgREST i RLS. Konto SQL `wardrobe_session` BFF ma dostęp tylko do tabeli sesji. BFF nie otrzymuje service-role key ani hasła administratora bazy.

Mutacje wymagają dokładnego Origin i double-submit tokenu CSRF. Brak CORS oznacza brak zewnętrznych originów. Caddy usuwa publiczny dostęp do bramy Supabase, Studio, REST i SQL — nie ma do nich reguł routingu. Ustaw `COOKIE_SECURE=true` z HTTPS. Nagłówki i ciasteczka z sekretami nie są logowane; query stringi linków resetu nie trafiają do logu żądań BFF.

## Dane i uprawnienia

`wardrobes` → `wardrobe_members` → `garments` → `garment_images`. Właściciel ma trwałe członkostwo utworzone triggerem w tej samej transakcji. Edytor modyfikuje ubrania, zdjęcia i zestawy. Przeglądający tylko czyta. Funkcje pomocnicze RLS są `SECURITY DEFINER` z pustym search_path, stałym SQL i ograniczonym EXECUTE; zapobiegają rekurencji polityk członkostwa.

`outfits` i `outfit_garments` przechowują dokładne identyfikatory; złożone FK pilnują jednej garderoby. `wear_history` zapisuje ubranie, użytkownika i dzień. `invitations` mają hash losowego tokenu, email, rolę i termin. Akceptacja porównuje email zweryfikowanej tożsamości Auth, a nie email przesłany przez klienta. Linki są przekazywane ręcznie; aplikacja nie deklaruje wysłania zaproszenia.

Prywatny bucket `garments` używa ścieżek `wardrobe_id/garment_id/random.webp`. Upload jest dekodowany przez Sharp, ograniczony do JPEG/PNG/WebP, 10 MB i 40 MP, obracany, skalowany do 2200 px i ponownie kodowany bez EXIF. BFF pobiera obrazy po ID, sprawdzając RLS i przesyłając bajty z `Cache-Control: no-store, private`. Brak publicznych bucketów i URL podpisanych dla przeglądarki.

Usunięcie ubrania usuwa najpierw obiekty Storage, następnie metadane. To nie jest transakcja między systemami: awaria w połowie może wymagać ponowienia operacji; nie udajemy atomowości. Nie należy usuwać rekordów ubrań bezpośrednim SQL w normalnej eksploatacji, bo może to pozostawić osierocone pliki. Przenoszenie ubrania ze zdjęciami do innej garderoby jest na razie wyłączone; potrzebuje osobnej operacji przeniesienia obiektów i polityk.

## Zadania

`public.jobs` jest trwałym outboxem PostgreSQL. API zapisuje zadanie po zdjęciu; worker co 5 s dodaje je do BullMQ z deterministycznym jobId. Redis przechowuje transport, blokady i backoff, nie jedyną kopię stanu. AOF jest włączony. Worker odzyskuje zadania po utracie kolejki lub restarcie, limituje współbieżność do 2, ma 3 próby z wykładniczym opóźnieniem i 30 s timeout pobrania obrazu. BullMQ obsługuje stalled jobs. Progress, próby, wynik i błędy trafiają do SQL.

Worker ma osobny ograniczony login SQL oraz service-role key wyłącznie do pobrania obiektu przypisanego do autoryzowanego zadania. Przed pobraniem ponownie sprawdza członkostwo zlecającego, zgodność obraz/ubranie/garderoba i ścieżkę z bazy. Nie przyjmuje dowolnych URL ani ścieżek od BullMQ. Uprawnienie service_role jest szerokie z natury Supabase: ten sekret jest granicą zaufania wewnętrznego workera i nie może trafić do BFF/web.

Zaimplementowany typ to `process_image`: rzeczywisty odczyt wymiarów, formatu i przezroczystości. Interfejs `VisionProvider` i walidator sugestii przygotowują etap 2; nie ma atrap odpowiedzi AI. Ollama nie jest zależnością startupu.

## Zestawy

MVP używa jawnych reguł, bez LLM: czyste, niearchiwizowane ubrania z jednej dostępnej garderoby, wybrana okazja, prosta heurystyka temperatury. Nie jest to model modowy ani integracja pogodowa; temperatura pochodzi od użytkownika. Wszystkie kafelki używają rzeczywistych zdjęć lub jawnego placeholdera. Materiał nigdy nie jest estymowany z wyglądu.

## PWA

Workbox precache zawiera tylko publiczną powłokę, ikony, JS i CSS. `/api/*` jest NetworkOnly i wykluczone z fallbacku nawigacji. Brak trwałego cache danych React Query. Po wylogowaniu sesja jest usuwana, cache pamięci i CacheStorage czyszczone. Offline nie można przeglądać prywatnych zdjęć ani edytować danych; UI wyświetla komunikat o braku połączenia. Wspierane mobilne instalacje wymagają HTTPS (localhost jest wyjątkiem przeglądarek).

## Baseline infrastruktury

Oficjalny Supabase self-hosted 0.8.4, commit `189adda99d1b56da55fc5a6ee3f849354aaea92a`, wszystkie obrazy przypięte. Zachowano Studio, Envoy, Auth, PostgREST, Realtime, Storage, imgproxy, postgres-meta, Edge Runtime, PostgreSQL i Supavisor. Analytics i Vector są opcjonalne upstream i nie należą do tego bazowego wydania — nie zostały usunięte z wymaganych zależności aplikacji. Wersja 0.8.4 używa Envoy zamiast historycznego Kong.

Pliki upstream i ich sumy są w `infra/supabase`. `scripts/compose.mjs` odtwarza jedyny główny Compose, zmieniając porty, wolumeny, sieci i dodając aplikację. Nie uruchamia się osobnego Compose Supabase. `scripts/vendor-supabase.py` pobiera wyłącznie przypięty commit, nie gałąź master. Deno Edge Runtime ma osobny dostęp wychodzący, ponieważ oficjalny moduł pobiera zależności przy pierwszym starcie; cache jest trwały. Dostęp SMTP ma tylko Auth, a dostęp LAN AI — worker. Usługi danych są w sieci internal.

Źródła: [oficjalny baseline](https://github.com/supabase/supabase/tree/189adda99d1b56da55fc5a6ee3f849354aaea92a/docker), [self-hosting Docker](https://supabase.com/docs/guides/self-hosting/docker). TypeScript 6.0.3 wybrano z powodu peer range typescript-eslint `<6.1.0`; pozostałe aktualne stabilne wersje i lockfile są przypięte.
