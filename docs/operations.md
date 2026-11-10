# Eksploatacja i kopie zapasowe

## Co zachować

PostgreSQL (wszystkie bazy, role, auth, storage metadata i schemat private), `data/storage/` **wraz z atrybutami xattr**, `db-config` (klucze pgsodium), `.env`, wersję repozytorium i lockfile. `caddy-data` zawiera certyfikaty. Redis używa AOF w `redis-data`; stan biznesowy zadań jest również w PostgreSQL. Sama kopia SQL nie zawiera zdjęć, a kopia samych bajtów zdjęć nie zawiera ich metadanych HTTP. Stare wolumeny Docker Desktop są zachowane jako punkt odzyskiwania; aktywne PostgreSQL i Redis działają w OrbStack, zdjęcia w katalogu projektu.

Na macOS używamy OrbStack i niezmodyfikowanego oficjalnego Storage z natywnymi xattr: [infra/storage/README.md](../infra/storage/README.md). Dawny katalog JSON `data/storage-metadata/` jest tylko zachowaną kopią do odzyskiwania; nie uczestniczy już w działaniu aplikacji. Nie edytuj plików zdjęć ani atrybutów ręcznie. Supabase zachowuje strukturę ścieżek i identyfikatory wersji, więc plik obrazu może mieć nazwę UUID bez rozszerzenia.

## Spójna kopia

Najprostsza procedura dla małej instalacji to krótka przerwa serwisowa: zatrzymaj `web api worker auth storage realtime supavisor functions studio meta rest api-gw`, pozostaw `db redis imgproxy` (imgproxy tylko odczytuje pliki). W tym czasie użytkownicy nie zapisują danych.

```sh
umask 077
wardrobe_backup_dir="investigation/backups/operations-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$wardrobe_backup_dir"
docker compose stop web api worker auth storage realtime supavisor functions studio meta rest api-gw
docker compose exec -T db pg_dumpall -U supabase_admin > "$wardrobe_backup_dir/cluster.sql"
# Hostowy tar: BSD tar na macOS lub GNU tar na Linuxie, z obsługą xattr.
tar --xattrs -C data -cf "$wardrobe_backup_dir/storage.tar" storage
docker compose exec -T db tar -C /etc/postgresql-custom -cf - . > "$wardrobe_backup_dir/db-config.tar"
docker compose up -d
```

Polecenie `pg_dumpall` obejmuje role i wrażliwe dane Auth; plik musi być zaszyfrowany i dostępny tylko administratorowi. Kopię `.env` wykonaj osobno do zaszyfrowanego magazynu. Nie dodawaj backupów do Git. Skopiuj backup poza host i sprawdź sumy SHA-256. Możesz też stosować sprawdzone kopie fizyczne PostgreSQL z WAL/PITR, ale konfiguracja PITR nie jest częścią MVP.

Przy odtwarzaniu archiwum zdjęć użyj również `tar --xattrs`. Round-trip hostowego BSD tar na tym Macu został sprawdzony na izolowanym pliku z atrybutami Supabase. Przy przenoszeniu archiwum macOS ↔ Linux osobno sprawdź zgodność zapisu xattr narzędzi obu systemów; nie wystarczy porównać SHA256 zdjęć. BusyBox tar z obrazu Storage nie zastępuje hostowego narzędzia w tym poleceniu.

Nie kopiuj na żywo surowego PGDATA przez `tar`; użyj logicznego dumpu lub poprawnego backupu PostgreSQL. Snapshot Proxmox bez quiesce nie zastępuje regularnie testowanej kopii aplikacyjnej.

## Odtwarzanie — zawsze najpierw próba

1. Przygotuj odizolowany LXC/VM z tą samą wersją obrazów i kopią repozytorium. Nie kieruj na niego domeny produkcyjnej i zablokuj SMTP podczas próby.
2. Użyj zachowanych sekretów. Odtwórz klucze `db-config` w odpowiednim wolumenie oraz `data/storage/` razem z xattr. Historyczne backupy wykonane podczas używania adaptera JSON wymagają odtworzenia zapisanych w nich wartości jako natywnych xattr; samo skopiowanie tamtych zdjęć nie wystarcza.
3. Uruchom samo PostgreSQL. Domyślna inicjalizacja Supabase tworzy role/systemowe bazy; pełny dump klastra może zawierać te same role/bazy. Administrator powinien przygotować kontrolowany restore zgodnie z wersją PostgreSQL i sprawdzić każdy konflikt, zamiast ignorować błędy lub wykonywać dump na produkcji. Dla rutynowej eksploatacji przygotuj i zweryfikuj runbook restore dostosowany do wybranego sposobu backupu.
4. Po przywróceniu SQL uruchom Auth/Storage i pozostały stos. Migrator porówna checksumy; nie powinien ponownie wykonywać już zapisanych migracji.
5. Sprawdź logowanie istniejącego użytkownika, listę garderób, odczyt kilku zdjęć i polityki dostępu drugiego użytkownika. Sprawdź losowe zdjęcia po nazwach obiektów, nie tylko liczbę rekordów.
6. Dopiero po udanej próbie i udokumentowanym czasie odtwarzania stosuj procedurę awaryjną na właściwym hoście. Pełny restore nie został automatycznie przetestowany przez ten projekt; wykonaj go przed traktowaniem kopii jako sprawdzonej.

Redis można odtworzyć z AOF przy zatrzymanej usłudze. Jeżeli Redis zostanie utracony, worker odtworzy queued/stale processing jobs z SQL. Completed jobs nie są uruchamiane ponownie; failed wymagają ręcznego retry. Nie usuwaj całego wolumenu PostgreSQL lub Storage przy diagnostyce kolejki.

## Aktualizacje i migracje

Wykonaj backup i przetestuj aktualizację na kopii. Zapisz obecny commit i wersje obrazów. Uruchom `docker compose up -d --build`. Migrator startuje po gotowości Auth i Storage, bierze blokadę advisory, wykonuje każdą nową migrację w transakcji i zapisuje SHA-256. Awaria migracji blokuje start BFF/worker. Istniejące pliki migracji są niezmienne — naprawy dopisuj w nowym pliku. Aktualizacje major PostgreSQL wymagają osobnej procedury upstream, nie zwykłej zamiany tagu obrazu.

Nie uruchamiaj `docker compose down -v` dla istniejącej instalacji. `docker compose down` bez `-v` zachowuje dane. Rollback kodu nie oznacza rollbacku schematu — używaj kompatybilnych migracji albo odtwórz zweryfikowaną kopię.

## Monitoring

```sh
docker compose ps
docker compose logs --tail=100 api worker migrate
docker compose logs --tail=100 auth storage db
docker compose stats --no-stream
docker system df
```

Logi rotują do 3 × 10 MB na usługi upstream. API/worker używają Pino, nie logują ciasteczek ani haseł. Włącz zewnętrzny alert na `/api/health` i miejsce na dysku; monitoring/alerting nie jest osobną usługą MVP. `/api/health` sprawdza bazę sesji, nie pełną poprawność wszystkich usług; Compose healthchecks sprawdzają pozostałe komponenty.

## Typowe problemy

- **403 podczas zapisu:** publiczny URL nie zgadza się z APP_ORIGIN, brak CSRF, brak roli editor/owner lub wygasłe członkostwo.
- **Nie można się zalogować:** sprawdź gotowość Auth, potwierdzenie email i zgodność JWT_SECRET/ANON_KEY. Nie generuj nowego .env na istniejących wolumenach.
- **Email nie dociera:** sprawdź SMTP i dozwolone redirect URL. Samo ustawienie zmiennych nie dowodzi dostarczenia.
- **Zdjęcie odrzucone:** maks. 10 MB, 40 MP, JPEG/PNG/WebP; SVG/HEIC/GIF nie są wspierane w MVP.
- **Zadanie utknęło:** sprawdź worker, Redis i `jobs`. Worker odtwarza outbox co 5 s; stale processing po 5 min. Ręczne ponowienie jest tylko dla failed i wymaga uprawnień edycji.
- **Studio/Edge Runtime zajmują RAM:** nie usuwaj przypadkowych zależności. Aktualny pełny baseline jest celowy. Obserwuj RAM, ograniczenia i restart count.
- **Deno nie startuje:** pierwszy start wymaga dostępu do JSR/npm i prawidłowego DNS. Cache Deno pozostaje w named volume.
- **Brak dostępu po aktualizacji aplikacji:** odśwież przez powiadomienie o nowej wersji PWA. Prywatne API i zdjęcia nigdy nie powinny pochodzić z cache service workera.
