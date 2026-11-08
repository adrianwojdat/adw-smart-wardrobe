# Wdrożenie na Proxmox LXC

## Zasoby

Zalecany punkt startowy dla pełnego stosu: **4 vCPU, 8 GB RAM i 40–60 GB SSD** plus miejsce na zdjęcia i kopie zapasowe. Intel N100/N150 wystarczy dla małej rodziny, ale budowanie obrazów może trwać dłużej. Nie zakładamy, że pełny Supabase będzie stabilny w 4 GB. 8 GB jest zaleceniem operacyjnym, nie wynikiem testu obciążeniowego N100; wyniki lokalnej weryfikacji są w `docs/progress.md`. Zachowano wszystkie usługi bazowego wydania Supabase.

Pojemność zdjęć zależy od ich liczby i zawartości; upload jest skalowany i kodowany do WebP, lecz nie obiecujemy stałego rozmiaru. Monitoruj wolumen Storage i wolne miejsce bazy. Budowanie obrazów wymaga dodatkowego miejsca na pnpm i warstwy Docker. Przechowuj kopie na innym dysku/hoście, nie w tym samym LXC.

## Przygotowanie hosta

1. Utwórz dedykowany, nieuprzywilejowany LXC Debian/Ubuntu z aktualizacjami bezpieczeństwa. Konfigurację Proxmox wykonuje administrator; repozytorium nie zmienia hosta.
2. Dla Docker w LXC wymagane są funkcje nesting i keyctl. Sprawdź zgodność storage drivera, cgroups i AppArmor w swojej wersji Proxmox. Nie wyłączaj globalnie zabezpieczeń hosta. Jeżeli kontenery nie działają poprawnie w Twojej konfiguracji, użyj małej VM zamiast uprzywilejowanego LXC.
3. Zainstaluj Docker Engine i Compose plugin zgodnie z dokumentacją Docker. `docker compose version` i `docker info` muszą działać. Nie jest potrzebny osobny Supabase CLI.
4. Sklonuj repozytorium do trwałego katalogu. Do generowania sekretów wymagany jest Node 26 LTS; pnpm potrzebujesz tylko do developmentu/testów, obrazy budują zależności samodzielnie.

## Pierwsze uruchomienie

```sh
node scripts/setup.mjs
# Edytuj .env, następnie:
docker compose up -d --build
```

Skrypt tworzy `.env` z prawami 0600, kryptograficznie losowymi sekretami i zgodnymi HS256 anon/service-role JWT. Odmawia nadpisania istniejącego pliku. Zachowaj zaszyfrowaną kopię `.env`; utrata kluczy sesji/vault może uniemożliwić odczyt części danych. Nie zmieniaj `POSTGRES_PASSWORD` po inicjalizacji wolumenu bez procedury rotacji ról.

Dla testów na tym samym komputerze domyślne `http://localhost:8080` jest wystarczające. Dla dostępu z LAN ustaw **dokładnie ten sam origin**, np. `http://192.168.1.50:8080`, w:

- `APP_ORIGIN`
- `SITE_URL`
- `SUPABASE_PUBLIC_URL`
- `API_EXTERNAL_URL` z dopiskiem `/api/auth`
- `ADDITIONAL_REDIRECT_URLS` z dopiskiem `/reset-password`

Nie mieszaj localhost, nazwy DNS i adresu IP — kontrola Origin celowo odrzuca niespójne ustawienia.

## HTTPS

Dla publicznie rozwiązywanej domeny z dostępnymi portami 80/443 ustaw:

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

Caddy uzyska certyfikat i utrwali go w `caddy-data`. W prywatnej sieci użyj istniejącego reverse proxy z zaufanym certyfikatem albo własnego CA; przeglądarki muszą ufać certyfikatowi, aby PWA działało poprawnie. Przy terminacji TLS poza Caddy zachowaj publiczny HTTPS origin, Secure cookies i przekazuj żądania do portu HTTP aplikacji przez zaufaną sieć. Nie publikuj portów PostgreSQL, Redis, Supavisor, Storage ani bramy Supabase.

## Email

Domyślnie `ENABLE_EMAIL_AUTOCONFIRM=true`: konto lokalne powstaje bez wiadomości potwierdzającej. To ułatwienie pierwszego uruchomienia; adresy email nie są wtedy zweryfikowane. **Przed udostępnieniem rodzinnych zaproszeń niezaufanym osobom skonfiguruj SMTP i ustaw autoconfirm=false**, ponieważ zaproszenia są związane z tożsamością email.

Ustaw `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`. Dostosuj domeny i `MAILER_URLPATHS_*` do przykładu, wszystkie linki prowadzą przez BFF `/api/auth/verify`. Port 587/STARTTLS jest typowym wyborem; sprawdź wymagania swojego dostawcy. Następnie odtwórz kontenery przez ten sam główny Compose i przetestuj rejestrację oraz reset na własnej skrzynce. Bez SMTP aplikacja uczciwie informuje, że reset przez email jest niedostępny.

## Sprawdzenie

```sh
docker compose ps
docker compose logs --tail=100 migrate api worker
curl -fsS http://localhost:8080/api/health
```

`migrate` ma zakończyć się kodem 0; to poprawny stan jednorazowej usługi. Pozostałe usługi powinny działać. Otwórz aplikację, zarejestruj konto, utwórz garderobę, dodaj zdjęcie, zapisz ubranie i sprawdź katalog. Nie potrzeba działającego Ollama. Pierwsze pobranie obrazów i zależności Deno potrzebuje Internetu; po zbudowaniu obrazy i cache są lokalne.

## Studio

Studio i brama nie mają opublikowanych portów. Do tymczasowego dostępu administrator może uruchomić na serwerze przekierowanie dostępne **wyłącznie na localhost** i tunel SSH; nie zmieniaj routingu publicznej aplikacji na pełne Supabase API. Alternatywnie pracuj przez `docker compose exec -T db psql -U postgres -d postgres`. `DASHBOARD_PASSWORD` jest losowy, ale hasło samo w sobie nie zastępuje izolacji sieci.

## Ollama

W fazie 1 `OLLAMA_BASE_URL` i `OLLAMA_MODEL` są zarezerwowane dla kolejnego etapu. Żadne obecne zadanie nie odpytuje AI. Nie wystawiaj Ollama do Internetu; przyszły worker będzie łączyć się z adresem LAN. Wizualizacje i rozpoznawanie metek nie są jeszcze funkcjami MVP.
