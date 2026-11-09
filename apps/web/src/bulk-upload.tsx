import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Upload } from 'lucide-react';
import { garmentInput, type GarmentImage } from '@wardrobe/shared';
import { api } from './api';
import { useWardrobe } from './context';
import { PageHeading } from './catalog';
import { Button } from './components/ui/button';
import { BATCH_LIMIT, fileError, runUploads } from './bulk-queue';
type Entry = {
  id: string;
  imageId: string;
  wardrobeId: string;
  file: File;
  state: 'waiting' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
};
type Batch = {
  entries: Entry[];
  busy: boolean;
  add: (files: File[], wardrobeId: string) => void;
  retry: (id: string) => void;
  clear: () => void;
};
const Context = createContext<Batch | null>(null);
function useBatch() {
  return useContext(Context)!;
}
export function BulkUploadProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const active = useRef(true);
  const cache = useQueryClient();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function change(update: (current: Entry[]) => Entry[]) {
    if (!active.current) return;
    entriesRef.current = update(entriesRef.current);
    setEntries(entriesRef.current);
  }
  async function start(items: Entry[]) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await runUploads(items, async (item) => {
        if (!active.current) return;
        change((all) =>
          all.map((e) => (e.id === item.id ? { ...e, state: 'uploading', error: undefined } : e)),
        );
        try {
          await api.createGarment({
            ...garmentInput.parse({ wardrobe_id: item.wardrobeId, category: 'tops' }),
            id: item.id,
          });
          if (!active.current) return;
          await api.upload(item.id, item.file, 'garment', item.imageId);
          change((all) => all.map((e) => (e.id === item.id ? { ...e, state: 'uploaded' } : e)));
        } catch (error) {
          change((all) =>
            all.map((e) =>
              e.id === item.id
                ? {
                    ...e,
                    state: 'failed',
                    error:
                      error instanceof Error ? error.message : 'Nie udało się przesłać zdjęcia.',
                  }
                : e,
            ),
          );
        }
      });
      if (active.current) await cache.invalidateQueries({ queryKey: ['garments'] });
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  }
  const value: Batch = {
    entries,
    busy,
    add(files, wardrobeId) {
      if (running.current || entriesRef.current.length + files.length > BATCH_LIMIT) return;
      const items: Entry[] = files.map((file) => ({
        id: crypto.randomUUID(),
        imageId: crypto.randomUUID(),
        wardrobeId,
        file,
        state: fileError(file) ? 'failed' : 'waiting',
        error: fileError(file),
      }));
      change((all) => [...all, ...items]);
      void start(items.filter((e) => e.state === 'waiting'));
    },
    retry(id) {
      const item = entriesRef.current.find((e) => e.id === id);
      if (item && !fileError(item.file)) void start([item]);
    },
    clear() {
      if (!running.current) change(() => []);
    },
  };
  return (
    <Context.Provider value={value}>
      {busy && (
        <div className="bulk-notice" role="status">
          <Link to="/garments/import">
            Przesyłanie ubrań: {entries.filter((e) => e.state === 'uploaded').length} /{' '}
            {entries.length}. Zobacz postęp
          </Link>
          <span> Możesz korzystać z aplikacji. Pozostaw tę kartę otwartą.</span>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
const stateLabels = {
  waiting: 'Oczekuje na przesłanie',
  uploading: 'Przesyłanie…',
  uploaded: 'Przesłano · oczekuje na przetwarzanie',
  failed: 'Błąd przesyłania',
};
export function BulkUploadPage() {
  const batch = useBatch();
  const { wardrobe, create } = useWardrobe();
  const [error, setError] = useState('');
  const uploaded = batch.entries.filter((e) => e.state === 'uploaded');
  // One paginated catalog query, rather than 200 individual polling requests.
  const status = useQuery({
    queryKey: ['bulk-images', uploaded.map((e) => e.id).join(',')],
    queryFn: async () => {
      const wardrobeIds = [...new Set(uploaded.map((e) => e.wardrobeId))];
      const result = await Promise.all(wardrobeIds.map((id) => api.garments(id)));
      return new Map(result.flat().map((g) => [g.id, g.garment_images]));
    },
    enabled: uploaded.length > 0,
    refetchInterval: 10000,
  });
  const image = (entry: Entry): GarmentImage | undefined =>
    status.data?.get(entry.id)?.find((i) => i.id === entry.imageId);
  const completed = uploaded.filter((e) => image(e)?.process_status === 'completed').length;
  const failedProcessing = uploaded.filter((e) =>
    ['failed', 'cancelled'].includes(image(e)?.process_status ?? ''),
  ).length;
  function select(files: File[]) {
    if (!wardrobe) return;
    if (batch.entries.length + files.length > BATCH_LIMIT) {
      setError(
        'Maksymalnie 200 zdjęć w jednej partii. Wybierz mniej plików lub wyczyść zakończoną partię.',
      );
      return;
    }
    setError('');
    batch.add(files, wardrobe.id);
  }
  return (
    <>
      <PageHeading
        eyebrow="TWOJA KOLEKCJA"
        title="Dodaj wiele ubrań"
        description="Jedno zdjęcie — jedno ubranie. Nazwy i analiza zostaną przygotowane automatycznie."
      />
      {!wardrobe ? (
        <Button onClick={create}>Utwórz garderobę</Button>
      ) : (
        <section className="form-panel">
          <p>
            Garderoba: <strong>{wardrobe.name}</strong>. Do 200 zdjęć, JPEG / PNG / WebP, maks. 10
            MB każde.
          </p>
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!batch.busy) select(Array.from(e.dataTransfer.files));
            }}
          >
            <Upload size={30} />
            <strong>Przeciągnij zdjęcia lub wybierz pliki</strong>
            <span>
              Przesyłamy maksymalnie 3 zdjęcia jednocześnie. Analiza AI działa osobno w kolejce.
            </span>
            <input
              type="file"
              multiple
              disabled={batch.busy}
              accept="image/jpeg,image/png,image/webp"
              aria-label="Zdjęcia wielu ubrań"
              onChange={(e) => {
                select(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </label>
          <p>
            Podczas przesyłania możesz zmieniać ekrany. Nie odświeżaj ani nie zamykaj karty — lista
            przesyłania jest przechowywana w pamięci.
          </p>
        </section>
      )}
      {error && (
        <p role="alert" className="error-notice">
          {error}
        </p>
      )}
      {batch.entries.length > 0 && (
        <section className="form-panel">
          <h2>Postęp importu</h2>
          <p role="status" aria-live="polite">
            Łącznie: {batch.entries.length} · Przesłano: {uploaded.length} · W przetwarzaniu:{' '}
            {uploaded.length - completed - failedProcessing} · Gotowe: {completed} · Błędy:{' '}
            {batch.entries.filter((e) => e.state === 'failed').length + failedProcessing}
          </p>
          <progress
            className="bulk-progress"
            max={batch.entries.length}
            value={uploaded.length}
            aria-label="Postęp przesyłania"
          />
          <p>
            „Gotowe” oznacza przygotowanie zdjęcia katalogowego. Sugestie AI mogą pojawić się
            później, także po ponownym włączeniu komputera z Ollamą.
          </p>
          {status.error && (
            <p role="alert">
              Nie można odświeżyć statusów przetwarzania. Spróbujemy ponownie automatycznie.
            </p>
          )}
          <ul className="bulk-list">
            {batch.entries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.file.name}</strong>
                  <p>
                    {entry.state === 'uploaded'
                      ? (image(entry)?.stage ?? stateLabels.uploaded)
                      : stateLabels[entry.state]}
                  </p>
                  {entry.error && <p role="alert">{entry.error}</p>}
                  {image(entry)?.processing_error && <p>{image(entry)?.processing_error}</p>}
                </div>
                {entry.state === 'uploaded' && (
                  <Link to="/garments/$id" params={{ id: entry.id }}>
                    Otwórz ubranie
                  </Link>
                )}
                {entry.state === 'failed' && !fileError(entry.file) && (
                  <Button disabled={batch.busy} onClick={() => batch.retry(entry.id)}>
                    Ponów przesyłanie
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button variant="outline" disabled={batch.busy} onClick={batch.clear}>
            Wyczyść listę importu
          </Button>
          <p>Wyczyszczenie listy nie usuwa zapisanych ubrań ani zdjęć.</p>
        </section>
      )}
    </>
  );
}
