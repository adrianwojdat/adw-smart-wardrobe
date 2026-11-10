# Panel kolejek

Bull Board jest częścią Fastify BFF. Po zalogowaniu do Smart Wardrobe otwórz `/api/admin/queues/` w tej samej przeglądarce. Panel pokazuje kolejki `wardrobe` (zdjęcia) i `wardrobe-ai` (analiza Ollama).

Dostęp kontroluje `QUEUE_ADMIN_USER_IDS`: lista UUID użytkowników Supabase Auth rozdzielona przecinkami. Pusta lista wyłącza panel. Nie wystarcza członkostwo owner/editor w garderobie. Sesja aplikacji jest wymagana dla HTML, plików statycznych i API panelu. Odpowiedzi nie trafiają do cache. Redis pozostaje prywatny, bez nowego portu lub kontenera.

Panel jest tylko do odczytu. Ponawiaj zadania w szczegółach ubrania, aby zachować spójność PostgreSQL i BullMQ. Blokujemy modyfikacje również po stronie serwera, a nie tylko przez ukrycie przycisków. Nie włączaj operacji usuwania/retry bez integracji z trwałym stanem zadań.

Przygotowana polityka workera zachowuje zakończone i nieudane zadania w Redis do 7 dni, maksymalnie 1000 wpisów osobno na stan i kolejkę (`age: 604800, count: 1000`). Limit 1000 może usunąć najstarsze wpisy wcześniej. Czyszczenie jest wykonywane przy kolejnych zakończeniach zadań. Polityka dotyczy zadań dodanych po wdrożeniu workera; istniejące zadania mogą nadal mieć poprzednie ustawienie natychmiastowego usuwania. Panel nie jest pełnym archiwum: widzi zadania obecne w Redis, a historia i wynik biznesowy pozostają w PostgreSQL oraz aplikacji. Zadania oczekujące na powrót Ollamy mogą przez chwilę istnieć wyłącznie w trwałej kolejce PostgreSQL i pojawią się w BullMQ przy ponownej wysyłce. Sam licznik Bull Board nie oznacza liczby wszystkich zadań aplikacji.

Konfigurację Compose generuje `node scripts/compose.mjs`. Po zatwierdzeniu wdrożenia wystarczy przebudować i odtworzyć wyłącznie API, z `--no-deps`, bez uruchamiania migracji. Nie zmieniaj SMTP, modelu Ollamy ani workera dla tej funkcji.
