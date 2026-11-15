import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CustomPropertyDefinition, CustomPropertyType } from '@wardrobe/shared';

import { Button } from '../../../components/ui/button';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { api } from '../../../lib/api/client';
import { userErrorMessage } from '../../../lib/api/user-error';

import { useInlineEditCoordinator } from '../hooks/inline-edit-coordinator';
import { CustomPropertyManager } from './custom-property-manager';

export function CustomPropertySection({
  wardrobeId,
  garmentId,
  definitions,
  values,
  canEdit,
  onChanged,
}: {
  wardrobeId: string;
  garmentId: string;
  definitions: CustomPropertyDefinition[];
  values: { property_id: string; value: unknown }[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation('garments');
  const [manage, setManage] = useState(false);
  const [error, setError] = useState('');

  async function save(propertyId: string, value: unknown) {
    setError('');

    try {
      await api.saveCustomPropertyValue(garmentId, propertyId, value);
      await onChanged();
    } catch (cause) {
      setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
      throw cause;
    }
  }

  async function clear(propertyId: string) {
    setError('');

    try {
      await api.clearCustomPropertyValue(garmentId, propertyId);
      await onChanged();
    } catch (cause) {
      setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
      throw cause;
    }
  }

  const ordered = [...definitions].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section className="custom-properties" aria-labelledby="custom-properties-title">
      <div className="custom-properties-heading">
        <h3 id="custom-properties-title">{t('customProperties.title')}</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setManage(true)}>
            {t('customProperties.manage')}
          </Button>
        )}
      </div>
      {ordered.filter((definition) => definition.visible).length === 0 ? (
        <p className="text-sm text-muted">
          {canEdit ? t('customProperties.emptyOwner') : t('customProperties.emptyViewer')}
        </p>
      ) : (
        <dl className="custom-properties-list">
          {ordered
            .filter((definition) => definition.visible)
            .map((definition) => (
              <CustomPropertyField
                key={definition.id}
                definition={definition}
                value={values.find((item) => item.property_id === definition.id)?.value}
                canEdit={canEdit}
                onSave={(value) => save(definition.id, value)}
                onClear={() => clear(definition.id)}
              />
            ))}
        </dl>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <CustomPropertyManager
        open={manage}
        onOpenChange={setManage}
        wardrobeId={wardrobeId}
        definitions={ordered}
        onChanged={onChanged}
      />
    </section>
  );
}

function CustomPropertyField({
  definition,
  value,
  canEdit,
  onSave,
  onClear,
}: {
  definition: CustomPropertyDefinition;
  value: unknown;
  canEdit: boolean;
  onSave: (value: unknown) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation('garments');
  const coordinator = useInlineEditCoordinator();
  const editorId = `custom:${definition.id}`;
  const editing = coordinator.activeId === editorId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<unknown>(value ?? initialCustomValue(definition.type));
  const savePromise = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? initialCustomValue(definition.type));
  }, [definition.type, editing, value]);

  const options = [...definition.garment_property_options].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const saveDraft = useCallback((): Promise<boolean> => {
    if (savePromise.current) return savePromise.current;

    const operation = (async () => {
      if (JSON.stringify(draft) === JSON.stringify(value ?? initialCustomValue(definition.type))) {
        coordinator.finish(editorId);

        return true;
      }

      setSaving(true);
      setError('');

      try {
        if (definition.type === 'select' && !draft) await onClear();
        else await onSave(draft);
        coordinator.finish(editorId);

        return true;
      } catch (cause) {
        setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));

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
  }, [draft, value, definition.type, onClear, onSave, coordinator, editorId, t]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await saveDraft();
  }

  function cancelEditing() {
    setDraft(value ?? initialCustomValue(definition.type));
    setError('');
    coordinator.finish(editorId);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!editing) return;
    coordinator.register(editorId, saveDraft);

    return () => coordinator.unregister(editorId);
  }, [
    editing,
    draft,
    value,
    saving,
    definition.type,
    onSave,
    onClear,
    coordinator,
    editorId,
    saveDraft,
  ]);

  const rendered = editing ? (
    <form
      className="custom-value-editor"
      onSubmit={(event) => void submit(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelEditing();
        }
      }}
      data-inline-editor-id={editorId}
    >
      {definition.type === 'text' && (
        <input
          autoFocus
          maxLength={1000}
          aria-label={definition.name}
          value={typeof draft === 'string' ? draft : ''}
          onChange={(event) => setDraft(event.currentTarget.value)}
          disabled={saving}
          className="input input-bordered h-[45px] px-[14px]"
        />
      )}
      {definition.type === 'number' && (
        <input
          autoFocus
          type="number"
          step="any"
          aria-label={definition.name}
          value={draft === '' ? '' : String(draft)}
          onChange={(event) =>
            setDraft(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))
          }
          disabled={saving}
          className="input input-bordered h-[45px] px-[14px]"
        />
      )}
      {definition.type === 'currency' && (
        <div className="custom-currency-editor">
          <input
            autoFocus
            type="number"
            min="0"
            step="0.01"
            aria-label={t('customProperties.amount', { name: definition.name })}
            value={
              currencyValue(draft).amount === undefined ? '' : String(currencyValue(draft).amount)
            }
            onChange={(event) =>
              setDraft({
                ...currencyValue(draft),
                amount: event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value),
              })
            }
            disabled={saving}
            className="input input-bordered h-[45px] px-[14px]"
          />
          <input
            aria-label={t('customProperties.currency', { name: definition.name })}
            maxLength={3}
            value={currencyValue(draft).currency ?? 'PLN'}
            onChange={(event) =>
              setDraft({
                ...currencyValue(draft),
                currency: event.currentTarget.value.toUpperCase(),
              })
            }
            disabled={saving}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </div>
      )}
      {definition.type === 'date' && (
        <input
          autoFocus
          type="date"
          aria-label={definition.name}
          value={typeof draft === 'string' ? draft : ''}
          onChange={(event) => setDraft(event.currentTarget.value)}
          disabled={saving}
          className="input input-bordered h-[45px] px-[14px]"
        />
      )}
      {definition.type === 'select' && (
        <DropdownSelect
          autoFocus
          aria-label={definition.name}
          value={typeof draft === 'string' ? draft : ''}
          onChange={(event) => setDraft(event.currentTarget.value)}
          disabled={saving || options.length === 0}
          className="select select-bordered h-[45px] px-[14px]"
        >
          <option value="">{t('customProperties.choose')}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </DropdownSelect>
      )}
      {definition.type === 'multi_select' && (
        <div className="custom-multi-options" aria-label={definition.name}>
          {options.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={stringArray(draft).includes(option.id)}
                disabled={saving}
                onChange={(event) =>
                  setDraft(
                    event.currentTarget.checked
                      ? [...stringArray(draft), option.id]
                      : stringArray(draft).filter((id) => id !== option.id),
                  )
                }
                className="checkbox"
              />
              {option.label}
            </label>
          ))}
          {options.length === 0 && <span>{t('customProperties.addOptionsHint')}</span>}
        </div>
      )}
      {definition.type === 'boolean' && (
        <DropdownSelect
          autoFocus
          aria-label={definition.name}
          value={String(draft)}
          onChange={(event) => setDraft(event.currentTarget.value === 'true')}
          disabled={saving}
          className="select select-bordered h-[45px] px-[14px]"
        >
          <option value="true">{t('customProperties.yes')}</option>
          <option value="false">{t('customProperties.no')}</option>
        </DropdownSelect>
      )}
      <Button
        size="icon"
        type="submit"
        aria-label={t('customProperties.save', { name: definition.name })}
        disabled={saving}
      >
        {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
      </Button>
      <Button
        size="icon"
        type="button"
        variant="ghost"
        aria-label={t('customProperties.cancel', { name: definition.name })}
        disabled={saving}
        onClick={() => {
          cancelEditing();
        }}
      >
        <X size={15} />
      </Button>
      {definition.type === 'select' && options.length === 0 && (
        <span className="inline-error">{t('customProperties.addOptionFirst')}</span>
      )}
      {error && (
        <span className="inline-error" role="alert">
          {error}
        </span>
      )}
    </form>
  ) : canEdit ? (
    <button
      type="button"
      className="field-value"
      ref={triggerRef}
      data-inline-edit-trigger
      aria-label={t('customProperties.edit', { name: definition.name })}
      onClick={() => {
        void coordinator.activate(editorId).then((activated) => {
          if (activated) {
            setDraft(value ?? initialCustomValue(definition.type));
            setError('');
          }
        });
      }}
    >
      {formatCustomValue(definition, value, t, i18n.language)}
      <Pencil size={12} aria-hidden="true" />
    </button>
  ) : (
    <span>{formatCustomValue(definition, value, t, i18n.language)}</span>
  );

  return (
    <div className="custom-property-row" data-inline-editor-id={editing ? editorId : undefined}>
      <dt>{definition.name}</dt>
      <dd>{rendered}</dd>
    </div>
  );
}

function currencyValue(value: unknown): { amount?: number; currency?: string } {
  if (typeof value !== 'object' || value === null) return {};

  const amount = 'amount' in value && typeof value.amount === 'number' ? value.amount : undefined;
  const currency =
    'currency' in value && typeof value.currency === 'string' ? value.currency : undefined;

  return {
    ...(amount === undefined ? {} : { amount }),
    ...(currency === undefined ? {} : { currency }),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function initialCustomValue(type: CustomPropertyType): unknown {
  if (type === 'multi_select') return [];
  if (type === 'currency') return { amount: 0, currency: 'PLN' };
  if (type === 'boolean') return false;

  return '';
}

function formatCustomValue(
  definition: CustomPropertyDefinition,
  value: unknown,
  t: (key: string) => string,
  language: string,
) {
  if (value === undefined || value === null || value === '') return t('customProperties.unfilled');

  const options = definition.garment_property_options;

  if (definition.type === 'select')
    return (
      options.find((option) => option.id === value)?.label ?? t('customProperties.unknownOption')
    );
  if (definition.type === 'multi_select' && Array.isArray(value))
    return (
      value
        .map(
          (id) =>
            options.find((option) => option.id === id)?.label ??
            t('customProperties.unknownOption'),
        )
        .join(', ') || t('customProperties.unfilled')
    );
  if (definition.type === 'boolean')
    return value ? t('customProperties.yes') : t('customProperties.no');

  if (definition.type === 'currency' && typeof value === 'object') {
    const money = currencyValue(value);

    try {
      return new Intl.NumberFormat(language === 'pl' ? 'pl-PL' : 'en-US', {
        style: 'currency',
        currency: money.currency,
      }).format(money.amount ?? 0);
    } catch {
      return `${money.amount ?? 0} ${money.currency ?? ''}`.trim();
    }
  }

  if (definition.type === 'date' && typeof value === 'string') {
    const date = new Date(`${value}T00:00:00`);

    return Number.isNaN(date.valueOf())
      ? value
      : new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-US').format(date);
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value);

  return t('customProperties.unfilled');
}
