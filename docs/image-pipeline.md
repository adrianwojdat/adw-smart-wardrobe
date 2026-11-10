> Dokument zachowuje historyczny audyt i przebieg implementacji. Aktualny stan wdrożenia i wyniki testów opisuje `docs/progress.md`. Nie należy traktować początkowego opisu braków jako stanu bieżącego.

# Audyt i plan pipeline'u zdjęć

Audyt: BFF konwertował upload do WebP i usuwał EXIF, więc oryginał nie był zachowany. Worker tylko odczytywał metadane. Nie było modelu segmentacji, zdjęć katalogowych, analizy AI ani OCR. Rozpoczęta korekta ręcznego obrotu nadpisywała referencję obrazu — zastępujemy ją niedestrukcyjną regeneracją wariantów.

Plan: zachować nowe uploady bez zmian; dodać warianty i rewizje zadań; uruchomić U²-NetP przez ONNX Runtime CPU w workerze; Sharp zastosuje maskę, obrót, kadr i kompozycję. Oddzielna kolejka AI wykorzysta Ollama do analizy i metek, z zapisaniem sugestii do akceptacji. Frontend będzie odpytywał status i przełączał warianty. Test obejmie rzeczywiste zdjęcie zapisane w istniejącym Storage, bez jego zmiany/usunięcia.

Model: U²-NetP (Apache-2.0, eksport rembg) jest małym modelem wykrywania wyróżniającego się obiektu, nie specjalistycznym modelem odzieży. 320×320 i około 4.4 MiB wag pozwalają na CPU i pojedynczą instancję ONNX w Node. Kompromis: cienkie paski, koronki i niski kontrast mogą mieć gorszą maskę; jakość sprawdzamy na rzeczywistym zdjęciu. Nie deklarujemy benchmarku N100/N150 bez testu na tym sprzęcie. Model przypięty SHA-256 będzie wbudowany w obraz, bez pobierania przy każdym zadaniu.

Ollama działa wyłącznie na oddzielnym PC z GTX 1060 6 GB. Konfiguracja: OLLAMA_BASE_URL wskazuje adres LAN, OLLAMA_VISION_MODEL model zainstalowany na PC. Aplikacja nie instaluje serwera Ollama ani nie pobiera wag vision LLM. Niedostępność AI powoduje odłożenie zadań analizy, nie blokuje obróbki CPU. Niepewna orientacja jest zachowywana z możliwością ręcznej korekty; bez AI nie zgadujemy góry ubrania na podstawie jego proporcji.

## Uruchomienie i ograniczenia

`docker compose up -d --build` nadal uruchamia cały stos. Nie ma kontenera Ollama. Model segmentacji (4 574 861 bajtów, SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`) jest w `infra/models`, z opisem licencji i źródłem. ONNX Runtime używa wyłącznie CPU, dwóch wątków i jednego równoległego zadania obrazu; instalacja dodatkowych binariów CUDA jest wyłączona. Worker ma limit 1536 MiB; pełny Supabase nadal wymaga osobnego zapasu RAM.

Konfiguracja zdalnego PC (wartości przykładowe, nie automatyczny wybór modelu):

```dotenv
OLLAMA_BASE_URL=http://192.168.1.80:11434
OLLAMA_VISION_MODEL=nazwa-juz-zainstalowanego-modelu-vision
```

Worker wywołuje `/api/chat`; nigdy `/api/pull`. Lokalny runtime segmentacji nie jest vision LLM. Puste ustawienia, brak modelu na PC lub jego niedostępność zostawiają zadania analizy w PostgreSQL i BullMQ, z ponowieniem co 60 s. Kolejki `wardrobe` i `wardrobe-ai` są oddzielne. Zwalidowane sugestie zdjęcia i odczytu metki są zapisywane przy zdjęciu; użytkownik zaznacza pola i zatwierdza ich zastosowanie. Materiał i rozmiar nie są przyjmowane z analizy zdjęcia ubrania. OCR metek realizuje zdalny model vision; nie ma udawanego lokalnego odczytu przy wyłączonej Ollamie.

Maska jest wyliczana z pikseli. Sharp zachowuje fakturę i kolor, stosuje przezroczystość, kadruje do obiektu z marginesem, komponuje na tle `#f5f4f0` do 1200×1500 i tworzy miniaturę 320×400. Nie stosujemy generatywnego usuwania zagnieceń ani agresywnej zmiany ekspozycji. Ubrania ciemne pozostają ciemne. Model nie prostuje geometrycznie rękawów ani nie odtwarza brakujących fragmentów.

EXIF jest normalizowany. Kierunek ubrania może zasugerować wyłącznie zdalny model vision: obrót automatyczny wymaga pewności ≥0.85, w przeciwnym razie zachowujemy orientację. Bez dostępnego PC można ręcznie obrócić o 90° lub dwukrotnie o 180°; generowanie zawsze zaczyna od niezmienionego oryginału. To zabezpieczenie nie gwarantuje poprawności subiektywnej pewności modelu; użytkownik może skorygować wynik.

Warianty mają deterministyczne ścieżki `image_id/vREVISION-PIPELINE_VERSION/…`. Ponowienie tego samego zadania nadpisuje tylko warianty tej rewizji, nigdy oryginał. Świadome ponowne przetwarzanie tworzy nową rewizję. Starsze rewizje pozostają zachowane; automatyczny garbage collector nie został dodany. Nowe oryginały zawierają pierwotny EXIF (mogą zawierać GPS) i są dostępne wyłącznie osobom z dostępem do garderoby; warianty nie zawierają EXIF.

Test realnego modelu: `GARMENT_FIXTURE=/path/to/garment.webp pnpm exec tsx tests/pipeline-real.ts` w środowisku Linux z zainstalowanymi zależnościami. ONNX Runtime 1.31.1 nie zawiera binariów macOS x64 — uruchamiaj model w kontenerze. Prywatne zdjęcie testowe i wyniki nie są dodawane do repozytorium.
