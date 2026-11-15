import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import type { Garment, GarmentInput } from '@wardrobe/shared';

import { useWardrobe } from '../../../app/providers/context';
import { api } from '../../../lib/api/client';

type UseGarmentSubmitOptions = {
  existing?: Garment;
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
  labelFiles: File[];
  setLabelFiles: Dispatch<SetStateAction<File[]>>;
};

export function useGarmentSubmit({
  existing,
  files,
  setFiles,
  labelFiles,
  setLabelFiles,
}: UseGarmentSubmitOptions) {
  const { t } = useTranslation('garments');
  const { notify } = useWardrobe();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [savedId, setSavedId] = useState(existing?.id);
  const [error, setError] = useState<unknown>();
  const [progress, setProgress] = useState('');

  async function submit(data: GarmentInput, nameWasEdited: boolean) {
    setError(undefined);

    try {
      const garment = savedId
        ? await api.updateGarment(
            savedId,
            existing && !nameWasEdited
              ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'name'))
              : data,
          )
        : await api.createGarment(data);

      setSavedId(garment.id);

      const uploads = [
        ...files.map((file) => ({ file, kind: 'garment' as const })),
        ...labelFiles.map((file) => ({ file, kind: 'label' as const })),
      ];

      for (let index = 0; index < uploads.length; index++) {
        const upload = uploads[index]!;

        setProgress(t('form.uploadProgress', { current: index + 1, total: uploads.length }));
        await api.upload(garment.id, upload.file, upload.kind);

        if (upload.kind === 'garment') {
          setFiles((current) => current.filter((file) => file !== upload.file));
        } else {
          setLabelFiles((current) => current.filter((file) => file !== upload.file));
        }
      }

      await cache.invalidateQueries({ queryKey: ['garments'] });
      await cache.invalidateQueries({ queryKey: ['garment', garment.id] });
      notify(t('form.savedNotification'));
      await navigate({ to: '/garments/$id', params: { id: garment.id } });
    } catch (submitError) {
      setError(submitError);
    } finally {
      setProgress('');
    }
  }

  return { savedId, error, progress, submit };
}
