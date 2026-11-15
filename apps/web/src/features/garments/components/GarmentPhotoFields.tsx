import { Check, Plus, Shirt, Tag, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Garment } from '@wardrobe/shared';

import { imageUrl } from '../../../lib/api/client';

type GarmentPhotoFieldsProps = {
  existing?: Garment;
  files: File[];
  labelFiles: File[];
  onSelectFiles: (list: FileList | null, kind: 'garment' | 'label') => void;
  onRemoveFile: (file: File, kind: 'garment' | 'label') => void;
};

export function GarmentPhotoFields({
  existing,
  files,
  labelFiles,
  onSelectFiles,
  onRemoveFile,
}: GarmentPhotoFieldsProps) {
  const { t } = useTranslation('garments');

  return (
    <section className="form-panel card bg-base-100">
      <h2>{t('form.photoTitle')}</h2>
      <p className="text-muted">{t('form.photoDescription')}</p>
      <label className="upload-zone">
        <Upload size={30} strokeWidth={1.2} />
        <strong>{t('form.choosePhotos')}</strong>
        <span>{t('form.photoLimits')}</span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label={t('form.garmentPhotos')}
          onChange={(event) => {
            onSelectFiles(event.target.files, 'garment');
            event.target.value = '';
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`}>
              <Shirt size={16} />
              <span>{file.name}</span>
              <button type="button" onClick={() => onRemoveFile(file, 'garment')}>
                {t('form.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {existing && (
        <div className="existing-images">
          {existing.garment_images.map((image) => (
            <img
              key={image.id}
              src={imageUrl(image)}
              alt={image.kind === 'label' ? t('form.labelAlt') : t('form.garmentAlt')}
            />
          ))}
        </div>
      )}
      <label className="label-upload">
        <Tag size={20} />
        <span>
          <strong>{t('form.addLabel')}</strong>
          <small>{t('form.labelHelp')}</small>
        </span>
        <Plus size={20} />
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label={t('form.labelAlt')}
          onChange={(event) => {
            onSelectFiles(event.target.files, 'label');
            event.target.value = '';
          }}
        />
      </label>
      {labelFiles.map((file, index) => (
        <p className="text-sm" key={`${file.name}-${file.lastModified}-${index}`}>
          {file.name}{' '}
          <button type="button" onClick={() => onRemoveFile(file, 'label')}>
            {t('form.remove')}
          </button>
        </p>
      ))}
      <div className="privacy-note">
        <Check size={17} /> {t('form.privatePhotos')}
      </div>
    </section>
  );
}
