import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type InlineEditCoordinator = {
  activeId: string | null;
  activate: (id: string) => Promise<boolean>;
  register: (id: string, commit: () => Promise<boolean>) => void;
  unregister: (id: string) => void;
  finish: (id: string) => void;
};

export const InlineEditContext = createContext<InlineEditCoordinator | null>(null);

export function useInlineEditCoordinator() {
  const coordinator = useContext(InlineEditContext);

  if (!coordinator) throw new Error('Inline edit coordinator is missing.');

  return coordinator;
}

export function useInlineEditCoordinatorState() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const activeCommitRef = useRef<{ id: string; commit: () => Promise<boolean> } | null>(null);

  const activate = useCallback(async (id: string) => {
    if (activeIdRef.current !== id && activeCommitRef.current) {
      const saved = await activeCommitRef.current.commit();

      if (!saved) return false;
    }

    activeIdRef.current = id;
    setActiveId(id);

    return true;
  }, []);

  const register = useCallback((id: string, commit: () => Promise<boolean>) => {
    if (activeIdRef.current === id) activeCommitRef.current = { id, commit };
  }, []);

  const unregister = useCallback((id: string) => {
    if (activeCommitRef.current?.id === id) activeCommitRef.current = null;
  }, []);

  const finish = useCallback(
    (id: string) => {
      unregister(id);
      if (activeIdRef.current === id) activeIdRef.current = null;
      setActiveId((current) => (current === id ? null : current));
    },
    [unregister],
  );

  const commitActive = useCallback(async () => {
    const active = activeCommitRef.current;

    return active ? active.commit() : true;
  }, []);

  const context = useMemo(
    () => ({ activeId, activate, register, unregister, finish }),
    [activeId, activate, register, unregister, finish],
  );

  useEffect(() => {
    if (!activeId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) return;
      if (
        target.closest('[data-inline-editor-id]') ||
        target.closest('[data-inline-edit-trigger]') ||
        target.closest('[data-inline-edit-action]')
      )
        return;
      void commitActive();
    };

    document.addEventListener('pointerdown', onPointerDown);

    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [activeId, commitActive]);

  return { context, commitActive };
}
