import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/ui/button';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { userErrorMessage } from '../../../lib/api/user-error';

import { useInlineEditCoordinator } from '../hooks/inline-edit-coordinator';

type InlineValue = string | string[];

function normalizePropertyValue(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function uniquePropertyValues(values: Array<string | undefined>, locale = 'pl-PL') {
  const byNormalizedValue = new Map<string, string>();

  for (const raw of values) {
    const value = normalizePropertyValue(raw ?? '');
    const key = value.toLocaleLowerCase(locale);

    if (value && !byNormalizedValue.has(key)) byNormalizedValue.set(key, value);
  }

  return [...byNormalizedValue.values()].sort((a, b) => a.localeCompare(b, locale));
}

type InlinePropertyProps = {
  label: string;
  value: InlineValue;
  display: string;
  heading?: boolean;
  kind?: 'text' | 'number' | 'select' | 'multi' | 'autocomplete';
  options?: { value: string; label: string }[];
  suggestions?: string[];
  onSave: (value: InlineValue) => Promise<void | boolean> | void | boolean;
};

export function InlineProperty({
  label,
  value,
  display,
  heading = false,
  kind = 'text',
  options = [],
  suggestions = [],
  onSave,
}: InlinePropertyProps) {
  const { t, i18n } = useTranslation('garments');
  const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US';
  const coordinator = useInlineEditCoordinator();
  const editorId = label;
  const editing = coordinator.activeId === editorId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<InlineValue>(value);
  const [saving, setSaving] = useState(false);
  const savePromise = useRef<Promise<boolean> | null>(null);
  const [error, setError] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const autocompleteId = `inline-suggestions-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const draftText = Array.isArray(draft) ? draft.join(', ') : String(draft);
  const filteredSuggestions =
    kind === 'autocomplete'
      ? suggestions
          .filter((item) =>
            normalizePropertyValue(item)
              .toLocaleLowerCase(locale)
              .startsWith(normalizePropertyValue(draftText).toLocaleLowerCase(locale)),
          )
          .slice(0, 8)
      : [];

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (!editing) return;

    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(draft) !== JSON.stringify(value)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [draft, editing, value]);

  const saveDraft = useCallback((): Promise<boolean> => {
    if (savePromise.current) return savePromise.current;

    const operation = (async () => {
      if (JSON.stringify(draft) === JSON.stringify(value)) {
        coordinator.finish(editorId);

        return true;
      }

      setSaving(true);
      setError('');

      try {
        const normalized =
          kind === 'autocomplete' || kind === 'text'
            ? normalizePropertyValue(String(draft))
            : draft;
        const value =
          kind === 'autocomplete'
            ? (suggestions.find(
                (item) =>
                  normalizePropertyValue(item).toLocaleLowerCase(locale) ===
                  String(normalized).toLocaleLowerCase(locale),
              ) ?? normalized)
            : normalized;
        const saved = await onSave(value);

        if (saved === false) throw new Error(t('inline.saveFailed'));
        coordinator.finish(editorId);

        return true;
      } catch (e) {
        setError(userErrorMessage(e, (key) => t(key, { ns: 'common' })));

        return false;
      } finally {
        setSaving(false);
      }
    })();

    savePromise.current = operation;

    const clear = () => {
      if (savePromise.current === operation) savePromise.current = null;
    };

    void operation.then(clear, clear);

    return operation;
  }, [draft, value, kind, suggestions, onSave, coordinator, editorId, locale, t]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await saveDraft();
  }

  function cancelEditing() {
    setDraft(value);
    setError('');
    coordinator.finish(editorId);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!editing) return;
    coordinator.register(editorId, saveDraft);

    return () => coordinator.unregister(editorId);
  }, [editing, draft, value, saving, onSave, coordinator, editorId, saveDraft]);

  const labelNode = <dt>{label}</dt>;
  const displayNode = editing ? (
    <div className="inline-editor" data-inline-editor-id={editorId}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="inline-editor-control">
          {kind === 'select' || kind === 'multi' ? (
            <DropdownSelect
              autoFocus
              disabled={saving}
              multiple={kind === 'multi'}
              value={Array.isArray(draft) ? draft : String(draft)}
              onChange={(event) =>
                setDraft(
                  kind === 'multi'
                    ? Array.from(event.currentTarget.selectedOptions, (option) => option.value)
                    : event.currentTarget.value,
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setDraft(value);
                  cancelEditing();
                }
              }}
              aria-label={label}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </DropdownSelect>
          ) : (
            <>
              <input
                autoFocus
                disabled={saving}
                type={kind === 'number' ? 'number' : 'text'}
                min={kind === 'number' ? 1 : undefined}
                max={kind === 'number' ? 5 : undefined}
                value={draftText}
                role={kind === 'autocomplete' ? 'combobox' : undefined}
                aria-autocomplete={kind === 'autocomplete' ? 'list' : undefined}
                aria-expanded={
                  kind === 'autocomplete' ? listOpen && filteredSuggestions.length > 0 : undefined
                }
                aria-controls={kind === 'autocomplete' ? autocompleteId : undefined}
                aria-activedescendant={
                  kind === 'autocomplete' && activeSuggestion >= 0
                    ? `${autocompleteId}-${activeSuggestion}`
                    : undefined
                }
                onFocus={() => {
                  if (kind === 'autocomplete') setListOpen(true);
                }}
                onChange={(event) => {
                  setDraft(event.currentTarget.value);
                  setActiveSuggestion(-1);
                  if (kind === 'autocomplete') setListOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setDraft(value);
                    cancelEditing();
                    setListOpen(false);
                  } else if (
                    kind === 'autocomplete' &&
                    event.key === 'ArrowDown' &&
                    filteredSuggestions.length
                  ) {
                    event.preventDefault();
                    setListOpen(true);
                    setActiveSuggestion((activeSuggestion + 1) % filteredSuggestions.length);
                  } else if (
                    kind === 'autocomplete' &&
                    event.key === 'ArrowUp' &&
                    filteredSuggestions.length
                  ) {
                    event.preventDefault();
                    setListOpen(true);
                    setActiveSuggestion(
                      (activeSuggestion - 1 + filteredSuggestions.length) %
                        filteredSuggestions.length,
                    );
                  } else if (
                    kind === 'autocomplete' &&
                    event.key === 'Enter' &&
                    listOpen &&
                    activeSuggestion >= 0
                  ) {
                    event.preventDefault();
                    setDraft(filteredSuggestions[activeSuggestion] ?? draftText);
                    setListOpen(false);
                    setActiveSuggestion(-1);
                  }
                }}
                aria-label={label}
                className="input input-bordered h-[45px] px-[14px]"
              />
              {kind === 'autocomplete' && listOpen && filteredSuggestions.length > 0 && (
                <div
                  id={autocompleteId}
                  className="inline-suggestions"
                  role="listbox"
                  aria-label={t('inline.savedValues', { label })}
                >
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      id={`${autocompleteId}-${index}`}
                      key={suggestion}
                      type="button"
                      role="option"
                      aria-selected={index === activeSuggestion}
                      className={index === activeSuggestion ? 'is-active' : ''}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setDraft(suggestion);
                        setListOpen(false);
                        setActiveSuggestion(-1);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          aria-label={t('inline.save', { label })}
          disabled={saving}
        >
          {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('inline.cancel', { label })}
          disabled={saving}
          onClick={() => {
            setDraft(value);
            cancelEditing();
            setError('');
          }}
        >
          <X size={15} />
        </Button>
        {JSON.stringify(draft) !== JSON.stringify(value) && (
          <span className="inline-unsaved">{t('customProperties.unsaved')}</span>
        )}
        {error && (
          <span className="inline-error" role="alert">
            {error}
          </span>
        )}
      </form>
    </div>
  ) : (
    <button
      type="button"
      className="field-value"
      ref={triggerRef}
      data-inline-edit-trigger
      onClick={() => {
        void coordinator.activate(editorId).then((activated) => {
          if (activated) {
            setDraft(value);
            setError('');
          }
        });
      }}
      aria-label={t('inline.edit', { label, value: display })}
    >
      {display}
      <Pencil size={12} aria-hidden="true" />
    </button>
  );

  return heading ? (
    <h1 className="detail-title inline-heading">
      <span className="sr-only">{label}</span>
      {displayNode}
    </h1>
  ) : (
    <div className="metadata-row">
      {labelNode}
      <dd>{displayNode}</dd>
    </div>
  );
}
