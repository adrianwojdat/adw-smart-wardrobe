import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type GeminiTask, type PackingList, type Trip } from '@wardrobe/shared';

import { api } from '../../../lib/api/client';

import { packingApi } from '../api/packing-api';

export function usePackingList() {
  const cache = useQueryClient();
  const [status, setStatus] = useState<GeminiTask['status']>();
  const [list, setList] = useState<PackingList>();
  const [task, setTask] = useState<{ id: string; trip: Trip }>();
  const lists = useQuery({ queryKey: ['packing-lists'], queryFn: packingApi.lists });
  const save = useMutation({
    mutationFn: packingApi.save,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['packing-lists'] });
      await cache.invalidateQueries({ queryKey: ['packing-recommendations'] });
    },
  });
  const generate = useMutation({
    mutationFn: packingApi.generate,
    onSuccess: (result, trip) => {
      setStatus('queued');
      setTask({ id: result.id, trip });
    },
  });
  const poll = useQuery({
    queryKey: ['packing-task', task?.id],
    enabled: !!task,
    queryFn: async () => {
      const result = await api.geminiTask(task!.id);

      setStatus(result.status);
      if (result.status === 'completed' && result.result?.items) {
        const next: PackingList = {
          id: crypto.randomUUID(),
          name: task!.trip.destination,
          trip: task!.trip,
          items: result.result.items,
          allow_reuse: false,
          updated_at: new Date().toISOString(),
        };

        setList(next);
        setTask(undefined);
        await save.mutateAsync(next);
      } else if (['failed', 'cancelled'].includes(result.status)) setTask(undefined);

      return result;
    },
    retry: false,
    refetchInterval: (query) =>
      query.state.data && ['completed', 'failed', 'cancelled'].includes(query.state.data.status)
        ? false
        : 1200,
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelGeminiTask(task!.id),
    onSuccess: () => {
      setStatus('cancelled');
      setTask(undefined);
    },
  });
  const remove = useMutation({
    mutationFn: packingApi.remove,
    onSuccess: (_, id) => {
      if (list?.id === id) setList(undefined);

      return cache.invalidateQueries({ queryKey: ['packing-lists'] });
    },
  });
  const recommendations = useQuery({
    queryKey: ['packing-recommendations', list?.id],
    queryFn: () => packingApi.recommendations(list!.id),
    enabled: !!list && !!lists.data?.some((v) => v.id === list.id),
  });

  return {
    list,
    startNew: () => {
      setList(undefined);
      setStatus(undefined);
      save.reset();
      generate.reset();
    },
    setList: (next: PackingList) => {
      save.reset();
      setList(next);
    },
    task,
    lists,
    save,
    generate,
    poll,
    cancel,
    remove,
    recommendations,
    status,
  };
}
