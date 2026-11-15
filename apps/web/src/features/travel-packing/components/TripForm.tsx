import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Luggage, MapPin, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type Trip, tripSchema } from '@wardrobe/shared';

import { Button } from '../../../components/ui/button';
import { DropdownSelect } from '../../../components/ui/dropdown-select';

export function TripForm({
  wardrobeId,
  busy,
  onGenerate,
}: {
  wardrobeId: string;
  busy: boolean;
  onGenerate: (trip: Trip) => void;
}) {
  const { t, i18n } = useTranslation('travelPacking');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Trip>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      wardrobe_id: wardrobeId,
      destination: '',
      days: 10,
      activity: 'mixed',
      laundry: false,
      light: false,
      notes: '',
      language: i18n.language === 'pl' ? 'pl' : 'en',
    },
  });

  return (
    <form
      className="outfit-controls !mb-0"
      onSubmit={(e) =>
        void handleSubmit((v) =>
          onGenerate({
            ...v,
            wardrobe_id: wardrobeId,
            language: i18n.language === 'pl' ? 'pl' : 'en',
          }),
        )(e)
      }
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="rounded-full bg-base-200 p-3 text-primary">
          <Luggage size={22} />
        </span>
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h2 className="text-xl font-semibold">{t('plan')}</h2>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-2 text-xs font-medium min-w-0">
          <span className="flex items-center gap-2">
            <MapPin size={14} />
            {t('destination')}
          </span>
          <input
            className="input input-bordered w-full"
            {...register('destination')}
            required
            maxLength={160}
          />
        </label>
        <label className="grid gap-2 text-xs font-medium min-w-0">
          {t('days')}
          <input
            className="input input-bordered w-full"
            type="number"
            min={1}
            max={365}
            {...register('days', { valueAsNumber: true })}
            required
          />
        </label>
        <label className="grid gap-2 text-xs font-medium min-w-0">
          <span className="flex items-center gap-2">
            <CalendarDays size={14} />
            {t('departure')}
          </span>
          <input
            className="input input-bordered w-full"
            type="date"
            {...register('departure', { setValueAs: (v: unknown) => (v === '' ? undefined : v) })}
          />
        </label>
        <label className="grid gap-2 text-xs font-medium min-w-0">
          {t('activity')}
          <DropdownSelect className="select select-bordered w-full" {...register('activity')}>
            {(['sightseeing', 'relaxation', 'business', 'active', 'mixed'] as const).map((v) => (
              <option key={v} value={v}>
                {t(`activities.${v}`)}
              </option>
            ))}
          </DropdownSelect>
        </label>
      </div>
      <div className="flex flex-wrap gap-5 my-6 p-4 rounded-lg bg-base-200/60">
        <label className="flex items-center gap-2 text-sm !m-0">
          <input className="checkbox" type="checkbox" {...register('laundry')} />
          {t('laundry')}
        </label>
        <label className="flex items-center gap-2 text-sm !m-0">
          <input className="checkbox" type="checkbox" {...register('light')} />
          {t('light')}
        </label>
      </div>
      <label className="grid gap-2 text-xs font-medium min-w-0">
        {t('notes')}
        <textarea
          className="textarea textarea-bordered w-full min-h-24"
          maxLength={1000}
          {...register('notes')}
        />
      </label>
      {Object.keys(errors).length > 0 && <p role="alert">{t('invalid')}</p>}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between mt-6">
        <p className="text-xs text-base-content/60 max-w-xl leading-relaxed">
          {t('weatherNotice')}
        </p>
        <Button disabled={busy} className="shrink-0">
          <Sparkles size={16} />
          {t('generate')}
        </Button>
      </div>
    </form>
  );
}
