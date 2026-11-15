import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { type GarmentImage, imageSchema } from '@wardrobe/shared';

import { request } from '../../../lib/api/client';

type RotationPreview = { imageId: string; target: number; base: number };
type RotationState = 'idle' | 'waiting' | 'saving' | 'processing' | 'failed';

type UseGarmentRotationOptions = {
  photo: GarmentImage | undefined;
  garmentId: string;
  cache: QueryClient;
  refetchGarment: () => Promise<unknown>;
  setError: Dispatch<SetStateAction<unknown>>;
};

function getAppliedRotation(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null || !('applied' in value)) return undefined;

  return typeof value.applied === 'number' ? value.applied : undefined;
}

export function useGarmentRotation({
  photo,
  garmentId,
  cache,
  refetchGarment,
  setError,
}: UseGarmentRotationOptions) {
  const { t } = useTranslation('garments');
  const [preview, setPreview] = useState<RotationPreview | null>(null);
  const [state, setState] = useState<RotationState>('idle');
  const [pending, setPending] = useState<{
    imageId: string;
    angle: number;
    revision: number;
  } | null>(null);
  const previewRef = useRef<RotationPreview | null>(null);
  const latestAngleRef = useRef<number | null>(null);
  const committedAngleRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const imageIdRef = useRef<string | null>(null);
  const serverAngle = photo?.rotation ?? getAppliedRotation(photo?.orientation) ?? 0;

  useEffect(() => {
    if (imageIdRef.current === photo?.id) return;
    imageIdRef.current = photo?.id ?? null;
    committedAngleRef.current = serverAngle;
    previewRef.current = null;
    latestAngleRef.current = null;
    setPreview(null);
    setPending(null);
    setState('idle');
  }, [photo?.id, serverAngle]);

  useEffect(() => {
    if (!pending || photo?.id !== pending.imageId || photo.revision < pending.revision) return;

    if (photo.process_status === 'failed') {
      setState('failed');
      setError(new Error(t('detail.rotationFailed')));

      return;
    }

    if (photo.process_status === 'completed') {
      previewRef.current = null;
      setPreview(null);
      setPending(null);
      setState('idle');
    }
  }, [photo?.id, photo?.revision, photo?.process_status, pending, setError, t]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function sendRotation(imageId: string, angle: number) {
    if (savingRef.current || latestAngleRef.current !== angle) return;
    savingRef.current = true;
    setState('saving');
    setError(undefined);

    try {
      const updated = await request(`/api/images/${imageId}/reprocess`, imageSchema, 'POST', {
        rotation: angle,
      });

      committedAngleRef.current = angle;
      setPending({ imageId, angle, revision: updated.revision });
      setState('processing');
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['garment', garmentId] }),
        cache.invalidateQueries({ queryKey: ['garments'] }),
        refetchGarment(),
      ]);
    } catch (cause) {
      setError(cause);
      setState('failed');
    } finally {
      savingRef.current = false;

      const latest = latestAngleRef.current;

      if (latest !== null && latest !== angle) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void sendRotation(imageId, latest), 800);
        setState('waiting');
      }
    }
  }

  function requestRotation(direction: 'left' | 'right') {
    if (!photo || photo.kind !== 'garment') return;

    const previous = previewRef.current;
    const base = previous?.imageId === photo.id ? previous.base : serverAngle;
    const current = previous?.imageId === photo.id ? previous.target : serverAngle;
    const target = (current + (direction === 'right' ? 90 : 270)) % 360;
    const next = { imageId: photo.id, target, base };

    previewRef.current = next;
    latestAngleRef.current = target;
    setPreview(next);
    setState('waiting');
    setError(undefined);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (target === committedAngleRef.current && !pending) {
        previewRef.current = null;
        latestAngleRef.current = null;
        setPreview(null);
        setState('idle');

        return;
      }

      void sendRotation(photo.id, target);
    }, 800);
  }

  const activePreview = preview?.imageId === photo?.id ? preview : null;
  const previewDelta = activePreview ? (activePreview.target - activePreview.base + 360) % 360 : 0;

  return {
    activePreview,
    previewDelta,
    state,
    requestRotation,
    retry: () => {
      if (activePreview && photo) void sendRotation(photo.id, activePreview.target);
    },
  };
}
