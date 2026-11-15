import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Wardrobe } from '@wardrobe/shared';

export function WardrobePicker({
  wardrobes,
  selectedId,
  onSelect,
}: {
  wardrobes: Wardrobe[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const currentIndex = Math.max(
    0,
    wardrobes.findIndex((item) => item.id === selectedId),
  );
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const activeOptionId = `${listId}-option-${activeIndex}`;

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);

    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      if (!open) {
        setActiveIndex(currentIndex);
        setOpen(true);
      } else {
        setActiveIndex((index) =>
          event.key === 'ArrowDown'
            ? (index + 1) % wardrobes.length
            : (index - 1 + wardrobes.length) % wardrobes.length,
        );
      }
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(wardrobes.length - 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();

      const wardrobe = wardrobes[activeIndex];

      if (wardrobe) onSelect(wardrobe.id);
      setOpen(false);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className="wardrobe-picker"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        id="active-wardrobe"
        type="button"
        className="wardrobe-picker-trigger"
        role="combobox"
        aria-label={t('shell.chooseWardrobe')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? activeOptionId : undefined}
        disabled={!wardrobes.length}
        onClick={() => {
          setActiveIndex(currentIndex);
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span title={wardrobes[currentIndex]?.name}>
          {wardrobes[currentIndex]?.name ?? t('shell.chooseWardrobe')}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="wardrobe-picker-options"
          id={listId}
          role="listbox"
          aria-label={t('shell.wardrobes')}
        >
          {wardrobes.map((item, index) => (
            <div
              key={item.id}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={item.id === selectedId}
              className={'wardrobe-picker-option' + (index === activeIndex ? ' is-active' : '')}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                onSelect(item.id);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <span>{item.name}</span>
              {item.id === selectedId && <Check size={15} aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
