import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  aiAnalysisSchema,
  garmentSchema,
  localizeAnalysis,
  aiValueLabel,
  type GarmentImage,
} from '@wardrobe/shared';
import { request } from './api';
import { Button } from './components/ui/button';
import { ErrorNotice, useWardrobe } from './context';
const labels: Record<string, string> = {
  name: 'Nazwa',
  pattern: 'Wzór',
  category: 'Kategoria',
  subcategory: 'Podkategoria',
  primary_color: 'Kolor',
  secondary_color: 'Dodatkowe kolory',
  brand: 'Marka',
  size: 'Rozmiar',
  material: 'Skład',
  material_source: 'Źródło składu',
  seasons: 'Sezony',
  style: 'Styl',
  occasions: 'Okazje',
  thickness: 'Grubość',
  warmth: 'Ciepło',
};
export function ImageAnalysis({ image, garmentId }: { image: GarmentImage; garmentId: string }) {
  const parsed = aiAnalysisSchema.safeParse(image.analysis);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const cache = useQueryClient();
  const { notify } = useWardrobe();
  if (!parsed.success) return null;
  const result = localizeAnalysis(parsed.data);
  return (
    <section className="form-panel mt-5">
      <h3>
        {result.source === 'label'
          ? 'Odczyt metki — do zatwierdzenia'
          : 'Sugestie AI — do zatwierdzenia'}
      </h3>
      {result.auto_applied && (
        <p role="status" className="source-note">
          Parametry analizy zostały zapisane automatycznie. Możesz poprawić dane w edycji ubrania.
        </p>
      )}
      <p className="source-note">
        {result.classifier
          ? 'FashionSigLIP · lokalnie na CPU. Wyniki podobieństwa nie są procentem pewności.'
          : `Pewność modelu: ${Math.round(result.confidence * 100)}%.`}{' '}
        Wybrane pola zastąpią Twoje obecne dane. Sprawdź je przed zatwierdzeniem.
      </p>
      {result.uncertainties.map((text, i) => (
        <p key={i} className="source-note">
          Do weryfikacji: {text}
        </p>
      ))}
      {Object.entries(result.suggestions).map(([field, value]) => (
        <label key={field} className="flex items-center gap-2">
          <input
            style={{ width: 18, minHeight: 18, margin: 0 }}
            type="checkbox"
            checked={selected.includes(field)}
            onChange={(e) =>
              setSelected((current) =>
                e.target.checked ? [...current, field] : current.filter((k) => k !== field),
              )
            }
          />
          <span>
            {labels[field] ?? field}: {aiValueLabel(field, value)}
          </span>
        </label>
      ))}
      {result.classifier && (
        <>
          <p className="source-note">
            Wzór: {result.classifier.pattern[0]?.label_pl} · analiza:{' '}
            {(result.classifier.elapsed_ms / 1000).toFixed(1)} s
          </p>
          <details>
            <summary>Najlepsze dopasowania kategorii</summary>
            {result.classifier.category.map((c) => (
              <p key={c.label} className="source-note">
                {c.label_pl}: {c.score.toFixed(3)}
              </p>
            ))}
          </details>
        </>
      )}
      {result.text && (
        <details>
          <summary>Tekst odczytany z metki</summary>
          <p className="source-note whitespace-pre-wrap">{result.text}</p>
        </details>
      )}
      {result.care?.map((c, i) => (
        <p key={i} className="source-note">
          Pielęgnacja: {c}
        </p>
      ))}
      <Button
        size="sm"
        disabled={busy || !selected.length}
        onClick={async () => {
          setBusy(true);
          try {
            await request(`/api/images/${image.id}/suggestions/apply`, garmentSchema, 'POST', {
              fields: selected,
            });
            await cache.invalidateQueries({ queryKey: ['garment', garmentId] });
            await cache.invalidateQueries({ queryKey: ['garments'] });
            setSelected([]);
            notify('Zapisano zatwierdzone sugestie.');
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        Zastosuj wybrane pola
      </Button>
      {!!error && <ErrorNotice error={error} />}
    </section>
  );
}
