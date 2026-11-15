import {
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
  type SelectHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type DropdownOption = { value: string; label: string; disabled: boolean };
type DropdownSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>;
};

function getAssociatedLabel(select: HTMLSelectElement | null) {
  const label = select?.closest('label');

  if (!label) return '';

  const copy = label.cloneNode(true) as HTMLLabelElement;

  copy.querySelectorAll('select').forEach((element) => element.remove());

  return copy.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function DropdownSelect(props: DropdownSelectProps) {
  const { t } = useTranslation('common');
  const {
    children,
    multiple = false,
    onBlur,
    onKeyDown,
    onPointerDown,
    onFocus,
    onClick,
    onChange,
    ref: externalRef,
    ...selectProps
  } = props;
  const selectRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ value: '', timer: 0 });
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const id = useId().replaceAll(':', '');
  const listId = `${id}-options`;
  const setSelectRef = useCallback(
    (element: HTMLSelectElement | null) => {
      selectRef.current = element;
      if (typeof externalRef === 'function') externalRef(element);
      else if (externalRef) externalRef.current = element;
    },
    [externalRef],
  );

  const syncPosition = useCallback(() => {
    const rect = selectRef.current?.getBoundingClientRect();

    if (rect) setPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, []);

  const openMenu = useCallback(() => {
    const select = selectRef.current;

    if (!select || select.disabled) return;

    const entries = Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.label || option.textContent || option.value,
      disabled: option.disabled,
    }));
    const selected = Math.max(
      0,
      Array.from(select.options).findIndex((option) => option.selected),
    );

    setLocalValue(select.value);
    setOptions(entries);
    setActiveIndex(selected);
    syncPosition();
    setOpen(true);
  }, [syncPosition]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;

      if (!selectRef.current?.contains(target) && !menuRef.current?.contains(target))
        setOpen(false);
    };

    const reposition = () => syncPosition();

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, syncPosition]);

  useEffect(
    () => () => {
      window.clearTimeout(typeahead.current.timer);
    },
    [],
  );

  function choose(value: string) {
    const select = selectRef.current;

    if (!select || select.disabled) return;

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

    setter?.call(select, value);
    setLocalValue(value);
    onChange?.({
      target: select,
      currentTarget: select,
      nativeEvent: new Event('change', { bubbles: true }),
      bubbles: true,
      cancelable: false,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      timeStamp: Date.now(),
      type: 'change',
      preventDefault() {},
      isDefaultPrevented: () => false,
      stopPropagation() {},
      isPropagationStopped: () => false,
      persist() {},
    } as unknown as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    select.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSelectElement>) {
    const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]));
    const move = (direction: 1 | -1) => {
      if (!enabledIndexes.length) return;

      const current = enabledIndexes.indexOf(activeIndex);
      const next =
        current < 0 ? 0 : (current + direction + enabledIndexes.length) % enabledIndexes.length;

      setActiveIndex(enabledIndexes[next]!);
    };

    if (open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        move(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setActiveIndex(
          event.key === 'Home' ? (enabledIndexes[0] ?? 0) : (enabledIndexes.at(-1) ?? 0),
        );
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();

        const option = options[activeIndex];

        if (option && !option.disabled) choose(option.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typeahead.current.value += event.key.toLocaleLowerCase();
        window.clearTimeout(typeahead.current.timer);
        typeahead.current.timer = window.setTimeout(() => (typeahead.current.value = ''), 700);

        const found = options.findIndex(
          (option) =>
            !option.disabled &&
            option.label.toLocaleLowerCase().startsWith(typeahead.current.value),
        );

        if (found >= 0) setActiveIndex(found);
      }
    } else if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }

    onKeyDown?.(event);
  }

  function handlePointerDown(event: PointerEvent<HTMLSelectElement>) {
    onPointerDown?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    event.preventDefault();
    selectRef.current?.focus();
    if (!open) openMenu();
  }

  if (multiple) {
    return (
      <select
        {...selectProps}
        multiple
        ref={setSelectRef}
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={onChange}
        onKeyDown={onKeyDown}
      >
        {children}
      </select>
    );
  }

  const selectedValue = String(selectProps.value ?? selectProps.defaultValue ?? localValue);

  return (
    <div className="dropdown-select-wrap">
      <select
        {...selectProps}
        ref={setSelectRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
        onBlur={(event) => {
          setOpen(false);
          onBlur?.(event);
        }}
        onFocus={onFocus}
        onClick={(event) => {
          onClick?.(event);

          if (!event.defaultPrevented && !open) {
            event.preventDefault();
            openMenu();
          }
        }}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
      >
        {children}
      </select>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={
              selectProps['aria-label'] ??
              (getAssociatedLabel(selectRef.current) || t('actions.chooseValue'))
            }
            data-inline-editor-id={
              selectRef.current
                ?.closest('[data-inline-editor-id]')
                ?.getAttribute('data-inline-editor-id') ?? undefined
            }
            className="app-dropdown-list"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {options.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={option.value === selectedValue}
                aria-disabled={option.disabled}
                className={
                  'app-dropdown-option' +
                  (index === activeIndex ? ' is-active' : '') +
                  (option.disabled ? ' is-disabled' : '')
                }
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) choose(option.value);
                }}
              >
                <span>{option.label}</span>
                {option.value === selectedValue && <Check size={15} aria-hidden="true" />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
