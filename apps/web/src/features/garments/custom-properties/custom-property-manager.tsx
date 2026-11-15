import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  type CustomPropertyDefinition,
  type CustomPropertyType,
  customPropertyTypes,
} from '@wardrobe/shared';

import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { api } from '../../../lib/api/client';
import { userErrorMessage } from '../../../lib/api/user-error';

export function CustomPropertyManager({
  open,
  onOpenChange,
  wardrobeId,
  definitions,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wardrobeId: string;
  definitions: CustomPropertyDefinition[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation('garments');
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomPropertyType>('text');
  const [optionDraft, setOptionDraft] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ordered = [...definitions].sort((a, b) => a.sort_order - b.sort_order);
  const typeLabels: Record<CustomPropertyType, string> = {
    text: t('customProperties.types.text'),
    number: t('customProperties.types.number'),
    currency: t('customProperties.types.currency'),
    date: t('customProperties.types.date'),
    select: t('customProperties.types.select'),
    multi_select: t('customProperties.types.multi_select'),
    boolean: t('customProperties.types.boolean'),
  };

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');

    try {
      await action();
      await onChanged();
    } catch (cause) {
      setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('customProperties.managerTitle')}
      description={t('customProperties.managerDescription')}
    >
      <div className="custom-property-manager">
        {ordered.map((definition, index) => (
          <div className="custom-property-manager-row" key={definition.id}>
            <input
              aria-label={t('customProperties.fieldName', { name: definition.name })}
              value={names[definition.id] ?? definition.name}
              onChange={(event) =>
                setNames({ ...names, [definition.id]: event.currentTarget.value })
              }
              disabled={busy}
              className="input input-bordered h-[45px] px-[14px]"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || (names[definition.id] ?? definition.name) === definition.name}
              onClick={() =>
                void perform(async () => {
                  await api.updateCustomProperty(definition.id, {
                    name: names[definition.id] ?? definition.name,
                  });
                  setNames({ ...names, [definition.id]: names[definition.id] ?? definition.name });
                })
              }
            >
              {t('customProperties.rename')}
            </Button>
            <label className="custom-visible">
              <input
                type="checkbox"
                checked={definition.visible}
                disabled={busy}
                onChange={(event) =>
                  void perform(() =>
                    api.updateCustomProperty(definition.id, {
                      visible: event.currentTarget.checked,
                    }),
                  )
                }
                className="checkbox"
              />{' '}
              {t('customProperties.visible')}
            </label>
            <div className="custom-order-actions">
              <Button
                size="icon"
                variant="ghost"
                aria-label={t('customProperties.moveUp', { name: definition.name })}
                disabled={busy || index === 0}
                onClick={() =>
                  void perform(async () => {
                    const previous = ordered[index - 1]!;

                    await api.updateCustomProperty(definition.id, {
                      sort_order: previous.sort_order,
                    });
                    await api.updateCustomProperty(previous.id, {
                      sort_order: definition.sort_order,
                    });
                  })
                }
              >
                <ArrowUp size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t('customProperties.moveDown', { name: definition.name })}
                disabled={busy || index === ordered.length - 1}
                onClick={() =>
                  void perform(async () => {
                    const next = ordered[index + 1]!;

                    await api.updateCustomProperty(definition.id, { sort_order: next.sort_order });
                    await api.updateCustomProperty(next.id, { sort_order: definition.sort_order });
                  })
                }
              >
                <ArrowDown size={15} />
              </Button>
            </div>
            {(definition.type === 'select' || definition.type === 'multi_select') && (
              <div className="custom-option-manager">
                <span>
                  {definition.garment_property_options.map((option) => option.label).join(' · ') ||
                    t('customProperties.noOptions')}
                </span>
                <div>
                  <input
                    aria-label={t('customProperties.newOption', { name: definition.name })}
                    placeholder={t('customProperties.addOptionPlaceholder')}
                    value={optionDraft[definition.id] ?? ''}
                    onChange={(event) =>
                      setOptionDraft({ ...optionDraft, [definition.id]: event.currentTarget.value })
                    }
                    disabled={busy}
                    className="input input-bordered h-[45px] px-[14px]"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !(optionDraft[definition.id] ?? '').trim()}
                    onClick={() =>
                      void perform(async () => {
                        const label = (optionDraft[definition.id] ?? '')
                          .trim()
                          .replace(/\s+/g, ' ');

                        await api.addCustomPropertyOption(definition.id, label);
                        setOptionDraft({ ...optionDraft, [definition.id]: '' });
                      })
                    }
                  >
                    {t('customProperties.addOption')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        <form
          className="custom-property-create"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              await api.createCustomProperty(wardrobeId, {
                name,
                type,
                sort_order: (ordered.at(-1)?.sort_order ?? -100) + 100,
                visible: true,
              });
              setName('');
            });
          }}
        >
          <label>
            {t('customProperties.newName')}
            <input
              value={name}
              maxLength={80}
              required
              onChange={(event) => setName(event.currentTarget.value)}
              className="input input-bordered h-[45px] px-[14px]"
            />
          </label>
          <label>
            {t('customProperties.type')}
            <DropdownSelect
              value={type}
              onChange={(event) => {
                const selected = customPropertyTypes.find(
                  (candidate) => candidate === event.currentTarget.value,
                );

                if (selected) setType(selected);
              }}
              className="select select-bordered h-[45px] px-[14px]"
            >
              {customPropertyTypes.map((kind) => (
                <option key={kind} value={kind}>
                  {typeLabels[kind]}
                </option>
              ))}
            </DropdownSelect>
          </label>
          <Button type="submit" disabled={busy || !name.trim()}>
            <Plus size={16} /> {t('customProperties.addField')}
          </Button>
        </form>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
