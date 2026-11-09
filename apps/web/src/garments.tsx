import { useState } from 'react';
import { useGarmentWarmth } from './use-garment-warmth';
import { useAnalysisActivity } from './analysis-activity';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  LoaderCircle,
  Upload,
  Plus,
  Tag,
  Palette,
  Layers,
  Thermometer,
  CalendarDays,
  Heart,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Check,
  Shirt,
  Sparkles,
} from 'lucide-react';
import {
  imageSchema,
  jobSchema,
  garmentInput,
  categories,
  categoryLabels,
  seasons,
  seasonLabels,
  occasions,
  occasionLabels,
  cleanliness,
  cleanlinessLabels,
  type Garment,
  type GarmentInput,
} from '@wardrobe/shared';
import { api, request, imageUrl } from './api';
import { useWardrobe, Empty, Loading, ErrorNotice } from './context';
import { PageHeading, GarmentPhoto } from './catalog';
import { ImageAnalysis } from './image-analysis';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';
export function GarmentFormPage({ id }: { id?: string }) {
  const query = useQuery({
    queryKey: ['garment', id],
    queryFn: () => api.garment(id!),
    enabled: !!id,
  });
  if (id && query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  return <GarmentForm key={id ?? 'new'} existing={query.data} />;
}
function GarmentForm({ existing }: { existing?: Garment }) {
  const { wardrobe, wardrobes, notify, create } = useWardrobe();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [error, setError] = useState<unknown>();
  const [progress, setProgress] = useState('');
  const [savedId, setSavedId] = useState(existing?.id);
  const [manualWarmthInEdit, setManualWarmthInEdit] = useState(false);
  const form = useForm<z.input<typeof garmentInput>, unknown, GarmentInput>({
    resolver: zodResolver(garmentInput),
    defaultValues: existing ?? {
      ...garmentInput.parse({
        name: 'Nowe ubranie',
        wardrobe_id: wardrobe?.id ?? '00000000-0000-0000-0000-000000000000',
        category: 'tops',
      }),
      name: '',
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;
  const category = useGarmentWarmth(form, !!existing, manualWarmthInEdit);
  // Keep generated names automatic until the user explicitly edits the name.
  async function submit(data: GarmentInput) {
    setError(undefined);
    try {
      const garment = savedId
        ? await api.updateGarment(
            savedId,
            existing && !dirtyFields.name
              ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'name'))
              : data,
          )
        : await api.createGarment(data);
      setSavedId(garment.id);
      const uploads = [
        ...files.map((file) => ({ file, kind: 'garment' as const })),
        ...labelFiles.map((file) => ({ file, kind: 'label' as const })),
      ];
      for (let i = 0; i < uploads.length; i++) {
        const upload = uploads[i]!;
        setProgress(`Przesyłanie zdjęcia ${i + 1} z ${uploads.length}…`);
        await api.upload(garment.id, upload.file, upload.kind);
        if (upload.kind === 'garment')
          setFiles((current) => current.filter((f) => f !== upload.file));
        else setLabelFiles((current) => current.filter((f) => f !== upload.file));
      }
      await cache.invalidateQueries({ queryKey: ['garments'] });
      await cache.invalidateQueries({ queryKey: ['garment', garment.id] });
      notify('Ubranie zapisane w Twojej garderobie.');
      await navigate({ to: '/garments/$id', params: { id: garment.id } });
    } catch (e) {
      setError(e);
    } finally {
      setProgress('');
    }
  }
  if (!wardrobe && !existing)
    return (
      <Empty
        title="Najpierw utwórz garderobę"
        description="To w niej zapiszemy Twoje ubrania."
        action={<Button onClick={create}>Utwórz garderobę</Button>}
      />
    );
  function selectFiles(list: FileList | null, kind: 'garment' | 'label') {
    const selected = Array.from(list ?? []);
    if (
      selected.some(
        (f) =>
          f.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
      )
    ) {
      setError(new Error('Wybierz JPEG, PNG lub WebP do 10 MB.'));
      return;
    }
    if (
      selected.length + files.length + labelFiles.length + (existing?.garment_images.length ?? 0) >
      12
    ) {
      setError(new Error('Maksymalnie 12 zdjęć łącznie.'));
      return;
    }
    if (kind === 'garment') setFiles((current) => [...current, ...selected]);
    else setLabelFiles((current) => [...current, ...selected]);
  }
  return (
    <>
      <Link to="/wardrobe" className="back-link">
        <ArrowLeft size={16} /> Wróć do garderoby
      </Link>
      <PageHeading
        eyebrow="TWOJA KOLEKCJA"
        title={existing ? 'Dopracuj szczegóły' : 'Co dziś dodajemy?'}
        description="Ulubiony sweter, idealne jeansy, a może coś na wielkie wyjście?"
      />
      <form onSubmit={handleSubmit(submit)} className="garment-form" noValidate>
        <section className="form-panel">
          <h2>Zdjęcia, które opowiadają więcej</h2>
          <p className="text-muted">Dzienne światło i neutralne tło sprawdzą się najlepiej.</p>
          <label className="upload-zone">
            <Upload size={30} strokeWidth={1.2} />
            <strong>Wybierz zdjęcia ubrania</strong>
            <span>JPEG, PNG, WebP · do 10 MB · maks. 12 zdjęć</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              aria-label="Zdjęcia ubrania"
              onChange={(e) => {
                selectFiles(e.target.files, 'garment');
                e.target.value = '';
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={i}>
                  <Shirt size={16} />
                  <span>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, n) => i !== n))}
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>
          )}
          {existing && (
            <div className="existing-images">
              {existing.garment_images.map((i) => (
                <img
                  key={i.id}
                  src={imageUrl(i)}
                  alt={i.kind === 'label' ? 'Metka' : 'Zdjęcie ubrania'}
                />
              ))}
            </div>
          )}
          <label className="label-upload">
            <Tag size={20} />
            <span>
              <strong>Dodaj też zdjęcie metki</strong>
              <small>Zachowaj informacje o składzie i pielęgnacji.</small>
            </span>
            <Plus size={20} />
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              aria-label="Zdjęcia metki"
              onChange={(e) => {
                selectFiles(e.target.files, 'label');
                e.target.value = '';
              }}
            />
          </label>
          {labelFiles.map((f, i) => (
            <p className="text-sm" key={i}>
              {f.name}{' '}
              <button
                type="button"
                onClick={() => setLabelFiles((current) => current.filter((_, n) => n !== i))}
              >
                Usuń
              </button>
            </p>
          ))}
          <div className="privacy-note">
            <Check size={17} /> Zdjęcia są prywatne. Widzisz je Ty i członkowie tej garderoby.
          </div>
        </section>
        <section className="form-panel">
          <h2>Trochę o tym ubraniu</h2>
          <label>
            Nazwa (opcjonalna)
            <input {...register('name')} placeholder="Zostaw puste — nazwę nada aplikacja" />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </label>
          <div className="form-row">
            <label>
              Kategoria
              <select {...register('category')}>
                {categories.map((c) => (
                  <option value={c} key={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Podkategoria
              <input {...register('subcategory')} placeholder="np. Marynarka" />
            </label>
          </div>
          <label>
            Garderoba
            <select {...register('wardrobe_id')} disabled={!!existing?.garment_images.length}>
              {wardrobes.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {existing?.garment_images.length ? (
              <small>Przenoszenie ubrań ze zdjęciami będzie dostępne w kolejnym etapie.</small>
            ) : null}
          </label>
          <div className="form-row">
            <label>
              Marka
              <input {...register('brand')} placeholder="np. COS" />
            </label>
            <label>
              Rozmiar
              <input {...register('size')} placeholder="np. M / 38" />
            </label>
          </div>
          <div className="form-row">
            <label>
              Kolor główny
              <input {...register('primary_color')} placeholder="np. Granatowy" />
            </label>
            <label>
              Kolor dodatkowy
              <input {...register('secondary_color')} placeholder="Opcjonalnie" />
            </label>
          </div>
          <label>
            Wzór
            <input {...register('pattern')} placeholder="np. Gładki, paski, krata" />
          </label>
          <label>
            Skład materiału
            <textarea
              {...register('material')}
              rows={2}
              placeholder="np. 80% wełna, 20% poliamid"
            />
          </label>
          <label>
            Źródło informacji o materiale
            <select {...register('material_source')}>
              <option value="unknown">Nie znam składu</option>
              <option value="user">Wpisane przeze mnie</option>
              <option value="label">Odczytane z metki</option>
            </select>
          </label>
          <div className="form-row">
            <label>
              Grubość
              <select {...register('thickness')}>
                <option value="thin">Cienkie</option>
                <option value="medium">Średnie</option>
                <option value="thick">Grube</option>
              </select>
            </label>
            <label>
              {category === 'accessories' ? 'Ciepło — nie dotyczy akcesoriów' : 'Ciepło (1–5)'}
              <input
                type="number"
                min={1}
                max={5}
                disabled={category === 'accessories'}
                {...register('warmth', {
                  valueAsNumber: true,
                  onChange: () => {
                    setManualWarmthInEdit(true);
                    setValue('warmth_manual', true, { shouldDirty: true });
                  },
                })}
              />
            </label>
          </div>
          <fieldset>
            <legend>Na jaki sezon?</legend>
            <div className="check-chips">
              {seasons.map((s) => (
                <label key={s}>
                  <input type="checkbox" value={s} {...register('seasons')} />
                  <span>{seasonLabels[s]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Styl
            <input {...register('style')} placeholder="np. Smart casual" />
          </label>
          <fieldset>
            <legend>Na jakie okazje?</legend>
            <div className="check-chips">
              {occasions.map((o) => (
                <label key={o}>
                  <input type="checkbox" value={o} {...register('occasions')} />
                  <span>{occasionLabels[o]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Status
            <select {...register('cleanliness')}>
              {cleanliness.map((s) => (
                <option value={s} key={s}>
                  {cleanlinessLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Twoje notatki
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Wszystko, co warto zapamiętać."
            />
          </label>
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="field-error">
              Sprawdź wymagane pola, długość tekstów i wartości liczbowe.
            </p>
          )}
          {!!error && <ErrorNotice error={error} />}
          <div className="form-actions">
            <Button variant="outline" asChild>
              <Link to="/wardrobe">Anuluj</Link>
            </Button>
            <Button disabled={isSubmitting}>
              {isSubmitting ? progress || 'Zapisywanie…' : 'Zapisz ubranie'}
              <Check size={17} />
            </Button>
          </div>
          {savedId && !existing && (
            <p className="text-sm text-muted">
              Dane ubrania zostały zapisane. Jeśli przesłanie zdjęcia nie powiodło się, ponów zapis
              — nie utworzy to drugiego ubrania.
            </p>
          )}
        </section>
      </form>
    </>
  );
}
export function GarmentDetail({ id }: { id: string }) {
  const activity = useAnalysisActivity();
  const capabilities = useQuery({
    queryKey: ['analysis-capabilities'],
    queryFn: () => request('/api/config', z.object({ manualAnalysis: z.boolean().optional() })),
  });
  const query = useQuery({
    queryKey: ['garment', id],
    queryFn: () => api.garment(id),
    refetchInterval: 3000,
  });
  const jobs = useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.jobs(id),
    refetchInterval: 3000,
  });
  const history = useQuery({
    queryKey: ['history', id],
    queryFn: () =>
      request(
        `/api/garments/${id}/history`,
        z.array(z.object({ id: z.string(), worn_on: z.string() })),
      ),
  });
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useWardrobe();
  const [activeImage, setActiveImage] = useState('');
  const [variant, setVariant] = useState<'catalog' | 'original' | 'cutout'>('catalog');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const garment = query.data;
  const recommendations = useQuery({
    queryKey: ['detail-outfits', id, garment?.wardrobe_id],
    queryFn: () => api.recommendations(garment!.wardrobe_id, 'everyday', 18),
    enabled: !!garment,
  });
  async function update(data: Partial<GarmentInput>) {
    setBusy(true);
    try {
      await api.updateGarment(id, data);
      await cache.invalidateQueries({ queryKey: ['garment', id] });
      await cache.invalidateQueries({ queryKey: ['garments'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  if (!garment) return null;
  const photo =
    garment.garment_images.find((i) => i.id === activeImage) ??
    garment.garment_images.find((i) => i.kind === 'garment') ??
    garment.garment_images[0];
  const aiActive = (activity.data ?? []).some(
    (a) => a.image_id === photo?.id && a.queued + a.processing > 0,
  );
  const suggestions =
    recommendations.data?.outfits.filter((o) => o.some((g) => g.id === id)).slice(0, 3) ?? [];
  return (
    <>
      <div className="detail-top">
        <Link to="/wardrobe" className="back-link">
          <ArrowLeft size={17} /> Twoja garderoba
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/garments/$id/edit" params={{ id }}>
              <Pencil size={15} />
              Edytuj
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label="Ulubione"
            onClick={() => void update({ favorite: !garment.favorite })}
          >
            <Heart size={20} fill={garment.favorite ? 'currentColor' : 'none'} />
          </Button>
        </div>
      </div>
      <div className="detail-layout">
        <section className="detail-main">
          <div className={'detail-photo ' + (variant === 'cutout' ? 'transparent-preview' : '')}>
            {photo ? (
              <img
                src={imageUrl(photo, variant)}
                alt={photo.kind === 'label' ? 'Metka ubrania' : garment.name}
              />
            ) : (
              <GarmentPhoto garment={garment} />
            )}
            <span className={'status-badge status-' + garment.cleanliness}>
              {cleanlinessLabels[garment.cleanliness]}
            </span>
          </div>
          {photo && (
            <>
              <div className="filter-tabs" aria-label="Wersja zdjęcia">
                {(['catalog', 'original', 'cutout'] as const).map((v) => (
                  <button
                    key={v}
                    disabled={v === 'cutout' && !photo.cutout_path}
                    className={variant === v ? 'selected' : ''}
                    onClick={() => setVariant(v)}
                  >
                    {v === 'catalog' ? 'Katalogowe' : v === 'original' ? 'Oryginał' : 'Bez tła'}
                  </button>
                ))}
              </div>
              <p role="status" className="source-note">
                {photo.stage}
                {photo.pipeline_version ? ' · ' + photo.pipeline_version : ''}
              </p>
              {!!photo.processing_error && (
                <ErrorNotice error={new Error(photo.processing_error)} />
              )}
              {!photo.catalog_path && photo.kind === 'garment' && (
                <p className="source-note">Do czasu zakończenia obróbki wyświetlamy oryginał.</p>
              )}
              {photo.process_status === 'completed' && photo.orientation && (
                <p className="source-note">{(photo.orientation as { reason?: string }).reason}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy || ['queued', 'processing'].includes(photo.process_status)}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await request(`/api/images/${photo.id}/reprocess`, imageSchema, 'POST', {});
                    await query.refetch();
                    await jobs.refetch();
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {['queued', 'processing'].includes(photo.process_status) ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    Przetwarzanie zdjęcia…
                  </>
                ) : (
                  'Ponów przetwarzanie'
                )}
              </Button>
              {aiActive && (
                <p role="status" className="source-note flex items-center gap-2">
                  <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                  Analiza AI w toku — oczekuje w kolejce lub jest przetwarzana.
                </p>
              )}
              {activity.error && <ErrorNotice error={activity.error} />}
              {capabilities.data?.manualAnalysis && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      busy ||
                      aiActive ||
                      activity.isPending ||
                      !!activity.error ||
                      jobs.data?.some(
                        (j) =>
                          j.image_id === photo.id &&
                          j.type !== 'process_image' &&
                          ['queued', 'processing'].includes(j.status),
                      )
                    }
                    onClick={async () => {
                      setBusy(true);
                      setError(undefined);
                      try {
                        await request(`/api/images/${photo.id}/analyze`, jobSchema, 'POST', {});
                        await Promise.all([jobs.refetch(), activity.refetch()]);
                        notify('Zlecono analizę AI tylko tego zdjęcia.');
                      } catch (e) {
                        setError(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {aiActive ? (
                      <>
                        <LoaderCircle size={16} className="animate-spin" />
                        Analiza AI w toku…
                      </>
                    ) : (
                      'Powtórz analizę AI'
                    )}
                  </Button>
                </>
              )}
              <ImageAnalysis key={photo.id + ':' + photo.revision} image={photo} garmentId={id} />
            </>
          )}
          <div className="thumbnail-row">
            {garment.garment_images.map((i) => (
              <button
                key={i.id}
                className={i.id === photo?.id ? 'selected' : ''}
                onClick={() => {
                  setActiveImage(i.id);
                  setVariant(i.kind === 'label' ? 'original' : 'catalog');
                }}
                aria-label={i.kind === 'label' ? 'Pokaż metkę' : 'Pokaż zdjęcie ubrania'}
              >
                <img src={imageUrl(i)} alt="" />
                {i.kind === 'label' && <Tag size={13} />}
              </button>
            ))}
            <Link
              to="/garments/$id/edit"
              params={{ id }}
              className="add-photo"
              aria-label="Dodaj zdjęcie"
            >
              <Plus />
            </Link>
          </div>
          {photo && (
            <div className="flex gap-2 mb-5">
              {(['left', 'right'] as const).map((direction) => (
                <Button
                  key={direction}
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(undefined);
                    try {
                      await request(`/api/images/${photo.id}/rotate`, imageSchema, 'POST', {
                        direction,
                      });
                      await cache.invalidateQueries({ queryKey: ['garment', id] });
                      await cache.invalidateQueries({ queryKey: ['garments'] });
                      notify('Zlecono obrót i ponowne przygotowanie zdjęcia.');
                    } catch (e) {
                      setError(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <RotateCcw size={15} />
                  {direction === 'left' ? 'Obróć w lewo' : 'Obróć w prawo'}
                </Button>
              ))}
            </div>
          )}
          <span className="eyebrow">{garment.brand || 'TWOJA OSOBISTA KOLEKCJA'}</span>
          <h1 className="detail-title">{garment.name}</h1>
          <dl className="metadata">
            {[
              {
                icon: Shirt,
                label: 'Kategoria',
                value:
                  categoryLabels[garment.category] +
                  (garment.subcategory ? ' · ' + garment.subcategory : ''),
              },
              {
                icon: Palette,
                label: 'Kolor',
                value:
                  [garment.primary_color, garment.secondary_color].filter(Boolean).join(', ') ||
                  'Nie określono',
              },
              { icon: Tag, label: 'Rozmiar', value: garment.size || 'Nie określono' },
              { icon: Layers, label: 'Materiał', value: garment.material || 'Nieznany skład' },
              {
                icon: Thermometer,
                label: 'Grubość / ciepło',
                value:
                  { thin: 'Cienkie', medium: 'Średnie', thick: 'Grube' }[garment.thickness] +
                  (garment.category === 'accessories'
                    ? ' · ciepło nie dotyczy'
                    : ` · ${garment.warmth}/5`),
              },
              {
                icon: CalendarDays,
                label: 'Sezon',
                value: garment.seasons.map((s) => seasonLabels[s]).join(' · ') || 'Nie określono',
              },
            ].map((m) => (
              <div key={m.label}>
                <dt>
                  <m.icon size={17} strokeWidth={1.4} />
                  {m.label}
                </dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
          <p className="source-note">
            Skład materiału:{' '}
            {garment.material_source === 'label'
              ? 'odczytany z metki'
              : garment.material_source === 'user'
                ? 'wpisany przez użytkownika'
                : 'brak potwierdzonych danych'}
            . Nie jest zgadywany ze zdjęcia.
          </p>
          <div className="tags">
            {garment.style && <span>{garment.style}</span>}
            {garment.occasions.map((o) => (
              <span key={o}>{occasionLabels[o]}</span>
            ))}
          </div>
          {garment.notes && <p className="garment-notes">{garment.notes}</p>}
          <label className="mt-6">
            Gotowe na kolejny dzień?
            <select
              disabled={busy}
              value={garment.cleanliness}
              onChange={(e) =>
                void update({ cleanliness: e.target.value as Garment['cleanliness'] })
              }
            >
              {cleanliness.map((s) => (
                <option key={s} value={s}>
                  {cleanlinessLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              try {
                await request(`/api/garments/${id}/wear`, z.object({ ok: z.boolean() }), 'POST', {
                  worn_on: new Date().toLocaleDateString('sv-SE'),
                });
                await cache.invalidateQueries({ queryKey: ['history', id] });
                await cache.invalidateQueries({ queryKey: ['garment', id] });
                await cache.invalidateQueries({ queryKey: ['garments'] });
                notify('Zapisano dzisiejsze założenie ubrania.');
              } catch (e) {
                setError(e);
              }
            }}
          >
            <CalendarDays size={17} />
            Mam to dziś na sobie
          </Button>
          {history.data && (
            <p className="source-note">
              Zapisane założenia: {history.data.length}
              {history.data[0]
                ? ' · Ostatnio: ' + new Date(history.data[0].worn_on).toLocaleDateString('pl-PL')
                : ''}
            </p>
          )}
          {!!error && <ErrorNotice error={error} />}
          <div className="detail-tools">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void update({ archived: !garment.archived })}
            >
              <Archive size={15} />
              {garment.archived ? 'Przywróć z archiwum' : 'Archiwizuj'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRemoveOpen(true)}>
              <Trash2 size={15} />
              Usuń ubranie
            </Button>
          </div>
        </section>
        <aside className="detail-outfits">
          <span className="eyebrow">DOBRZE RAZEM</span>
          <h2>Propozycje stylizacji</h2>
          <p className="text-muted mb-6">Nowe połączenia z Twoich własnych rzeczy.</p>
          {recommendations.isPending ? (
            <Loading />
          ) : suggestions.length ? (
            <div className="outfit-suggestions">
              {suggestions.map((outfit, i) => (
                <article className="outfit-card" key={i}>
                  <div className="outfit-collage">
                    {outfit.map((g) => (
                      <Link key={g.id} to="/garments/$id" params={{ id: g.id }}>
                        <GarmentPhoto garment={g} />
                      </Link>
                    ))}
                  </div>
                  <div className="p-5">
                    <h3>Na co dzień · zestaw {i + 1}</h3>
                    <p>{outfit.map((g) => g.name).join(' + ')}</p>
                    <span className="outfit-meta">
                      <CalendarDays size={15} /> Czyste i dostępne w Twojej szafie
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.saveOutfit({
                            wardrobe_id: garment.wardrobe_id,
                            name: `Na co dzień ${i + 1}`,
                            occasion: 'everyday',
                            garment_ids: outfit.map((g) => g.id),
                          });
                          await cache.invalidateQueries({ queryKey: ['outfits'] });
                          notify('Zestaw zapisany.');
                        } catch (e) {
                          setError(e);
                        }
                      }}
                    >
                      <Heart size={15} />
                      Zapisz zestaw
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="recommendation-empty">
              <Sparkles size={30} strokeWidth={1} />
              <h3>Dobry zestaw potrzebuje towarzystwa</h3>
              <p>
                Dodaj czystą górę i dół lub sukienkę. Propozycje powstaną wyłącznie z rzeczy w tej
                garderobie.
              </p>
              <Button variant="outline" asChild>
                <Link to="/garments/new">
                  Dodaj kolejne ubranie <Plus size={15} />
                </Link>
              </Button>
            </div>
          )}
          <div className="detail-info">
            <LeafIcon />
            <h3>Twoje ubrania, prawdziwe możliwości.</h3>
            <p>
              Te propozycje opierają się na prostych regułach, okazji i dostępności ubrań.
              Wizualizacje AI pojawią się w kolejnym etapie.
            </p>
          </div>
          {jobs.data && jobs.data.length > 0 && (
            <div className="jobs-panel">
              <h3>Zdjęcia i analiza AI</h3>
              {jobs.data.map((j) => (
                <div key={j.id}>
                  <span>
                    {['queued', 'processing'].includes(j.status) && (
                      <LoaderCircle
                        size={14}
                        className="inline animate-spin mr-2"
                        aria-label="Zadanie w toku"
                      />
                    )}
                    {j.status === 'cancelled'
                      ? 'Anulowano'
                      : j.status === 'completed'
                        ? 'Gotowe'
                        : j.status === 'failed'
                          ? 'Błąd przetwarzania'
                          : j.status === 'queued'
                            ? 'W kolejce'
                            : 'Przetwarzanie…'}
                  </span>
                  <small>
                    {j.type === 'process_image'
                      ? 'Obróbka'
                      : j.type === 'analyze_label'
                        ? 'Odczyt metki'
                        : 'Analiza AI'}{' '}
                    · {j.progress}%
                  </small>
                  {j.error && <span className="source-note">{j.error}</span>}
                  {j.status === 'failed' && (
                    <button
                      aria-label="Ponów przetwarzanie"
                      onClick={async () => {
                        try {
                          await api.retry(j.id);
                          await jobs.refetch();
                        } catch (e) {
                          setError(e);
                        }
                      }}
                    >
                      <RotateCcw size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      <Dialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Usunąć ubranie?"
        description="Zdjęcia i historia tego ubrania zostaną usunięte. Możesz zamiast tego przenieść je do archiwum."
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setRemoveOpen(false)}>
            Zachowaj
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.deleteGarment(id);
                await cache.invalidateQueries({ queryKey: ['garments'] });
                await navigate({ to: '/wardrobe' });
              } catch (e) {
                setError(e);
                setRemoveOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            Usuń na stałe
          </Button>
        </div>
      </Dialog>
    </>
  );
}
function LeafIcon() {
  return <Sparkles size={22} strokeWidth={1.2} />;
}
