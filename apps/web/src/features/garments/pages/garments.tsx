import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { type Garment, type GarmentInput, garmentInput } from '@wardrobe/shared';

import { Empty, ErrorNotice, Loading, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api/client';

import { PageHeading } from '../../catalog';

import { GarmentBasicFields } from '../components/GarmentBasicFields';
import { GarmentClassificationFields } from '../components/GarmentClassificationFields';
import { GarmentPhotoFields } from '../components/GarmentPhotoFields';
import { GarmentStatusFields } from '../components/GarmentStatusFields';
import { useGarmentWarmth } from '../hooks/use-garment-warmth';
import { useGarmentSubmit } from '../hooks/useGarmentSubmit';
import { validateGarmentFileSelection } from '../lib/garment-file-validation';

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
  const { t } = useTranslation('garments');
  const { wardrobe, wardrobes, create } = useWardrobe();
  const [files, setFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [manualWarmthInEdit, setManualWarmthInEdit] = useState(false);
  const [uploadError, setUploadError] = useState<Error>();
  const form = useForm<z.input<typeof garmentInput>, unknown, GarmentInput>({
    resolver: zodResolver(garmentInput),
    defaultValues:
      existing ??
      ({
        ...garmentInput.parse({
          name: 'Nowe ubranie',
          wardrobe_id: wardrobe?.id ?? '00000000-0000-0000-0000-000000000000',
          category: 'tops',
        }),
        name: '',
      } satisfies GarmentInput),
  });
  const category = useGarmentWarmth(form, !!existing, manualWarmthInEdit);
  const { savedId, error, progress, submit } = useGarmentSubmit({
    existing,
    files,
    setFiles,
    labelFiles,
    setLabelFiles,
  });

  function selectFiles(list: FileList | null, kind: 'garment' | 'label') {
    const selected = Array.from(list ?? []);
    const validationKey = validateGarmentFileSelection(
      selected,
      files.length + labelFiles.length,
      existing?.garment_images.length ?? 0,
    );

    if (validationKey) {
      setUploadError(new Error(t(`form.${validationKey}`)));

      return;
    }

    setUploadError(undefined);
    if (kind === 'garment') setFiles((current) => [...current, ...selected]);
    else setLabelFiles((current) => [...current, ...selected]);
  }

  function removeFile(file: File, kind: 'garment' | 'label') {
    const remove = (current: File[]) => current.filter((candidate) => candidate !== file);

    if (kind === 'garment') setFiles(remove);
    else setLabelFiles(remove);
  }

  if (!wardrobe && !existing) {
    return (
      <Empty
        title={t('form.createWardrobeFirst')}
        description={t('form.wardrobeRequired')}
        action={<Button onClick={create}>{t('form.createWardrobeFirst')}</Button>}
      />
    );
  }

  return (
    <>
      <Link to="/wardrobe" className="back-link">
        <ArrowLeft size={16} /> {t('form.back')}
      </Link>
      <PageHeading
        eyebrow={t('form.eyebrow')}
        title={existing ? t('form.editTitle') : t('form.createTitle')}
        description={t('form.description')}
      />
      <form
        onSubmit={(event) => {
          void form.handleSubmit((data) => {
            void submit(data, Boolean(form.formState.dirtyFields.name));
          })(event);
        }}
        className="garment-form"
        noValidate
      >
        <GarmentPhotoFields
          existing={existing}
          files={files}
          labelFiles={labelFiles}
          onSelectFiles={selectFiles}
          onRemoveFile={removeFile}
        />
        <section className="form-panel card bg-base-100">
          <GarmentBasicFields
            form={form}
            existing={existing}
            wardrobes={wardrobes}
            category={category}
            onManualWarmth={() => {
              setManualWarmthInEdit(true);
              form.setValue('warmth_manual', true, { shouldDirty: true });
            }}
          />
          <GarmentClassificationFields form={form} />
          <GarmentStatusFields form={form} />
          {Object.keys(form.formState.errors).length > 0 && (
            <p role="alert" className="field-error">
              {t('form.validation')}
            </p>
          )}
          {!!error && <ErrorNotice error={error} />}
          {uploadError && <ErrorNotice error={uploadError} />}
          <div className="form-actions">
            <Button variant="outline" asChild>
              <Link to="/wardrobe">{t('form.cancel')}</Link>
            </Button>
            <Button disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? progress || t('form.saving') : t('form.save')}
              <Check size={17} />
            </Button>
          </div>
          {savedId && !existing && <p className="text-sm text-muted">{t('form.saved')}</p>}
        </section>
      </form>
    </>
  );
}
