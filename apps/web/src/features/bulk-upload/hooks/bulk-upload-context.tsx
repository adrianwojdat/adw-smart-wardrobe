import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { garmentInput } from '@wardrobe/shared';

import { api } from '../../../lib/api/client';

import { BATCH_LIMIT, fileError, runUploads, type UploadFileError } from '../lib/bulk-queue';

export type Entry = {
  id: string;
  imageId: string;
  wardrobeId: string;
  file: File;
  state: 'waiting' | 'uploading' | 'uploaded' | 'failed';
  error?: UploadFileError | 'uploadFailed';
};
type Batch = {
  entries: Entry[];
  busy: boolean;
  add: (files: File[], wardrobeId: string) => void;
  retry: (id: string) => void;
  clear: () => void;
};

const Context = createContext<Batch | null>(null);

export function useBatch() {
  return useContext(Context)!;
}

export function BulkUploadProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('bulkUpload');
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
        } catch {
          change((all) =>
            all.map((e) =>
              e.id === item.id
                ? {
                    ...e,
                    state: 'failed',
                    error: 'uploadFailed',
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
            {t('page.backgroundProgress', {
              uploaded: entries.filter((e) => e.state === 'uploaded').length,
              total: entries.length,
            })}
          </Link>
          <span> {t('page.keepOpen')}</span>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
