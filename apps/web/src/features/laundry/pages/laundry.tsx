import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { flexRender } from '@tanstack/react-table';
import {
  getCoreRowModel,
  type LegacyColumnDef,
  useLegacyTable,
} from '@tanstack/react-table/legacy';
import { Shirt } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cleanliness, cleanlinessLabels, type Garment } from '@wardrobe/shared';

import { Empty, ErrorNotice, Loading, useWardrobe } from '../../../app/providers/context';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { api } from '../../../lib/api/client';

import { GarmentPhoto, PageHeading, useGarments } from '../../catalog';

export function Laundry() {
  const { t } = useTranslation('laundry');
  const { t: tc } = useTranslation('common');
  const query = useGarments();
  const cache = useQueryClient();
  const { notify } = useWardrobe();
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<unknown>();
  const [updating, setUpdating] = useState('');
  const data = useMemo(
    () => (query.data ?? []).filter((g) => status === 'all' || g.cleanliness === status),
    [query.data, status],
  );
  const columns = useMemo<LegacyColumnDef<Garment>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('page.garment'),
        cell: (info) => (
          <Link
            to="/garments/$id"
            params={{ id: info.row.original.id }}
            className="laundry-garment"
          >
            <GarmentPhoto garment={info.row.original} />
            <span>
              <strong>{info.row.original.name}</strong>
              <small>{info.row.original.brand || t('page.yourWardrobe')}</small>
            </span>
          </Link>
        ),
      },
      {
        accessorKey: 'cleanliness',
        header: t('page.status'),
        cell: (info) => (
          <span className={'status-pill badge status-' + info.row.original.cleanliness}>
            {tc(`vocabulary.cleanliness.${info.row.original.cleanliness}`, {
              defaultValue: cleanlinessLabels[info.row.original.cleanliness],
            })}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('page.changeStatus'),
        cell: (info) => (
          <DropdownSelect
            aria-label={t('page.statusFor', { name: info.row.original.name })}
            disabled={updating === info.row.original.id}
            value={info.row.original.cleanliness}
            onChange={async (e) => {
              const id = info.row.original.id;

              setUpdating(id);

              try {
                await api.updateGarment(id, {
                  cleanliness: e.target.value as Garment['cleanliness'],
                });
                await cache.invalidateQueries({ queryKey: ['garments'] });
                notify(t('page.statusUpdated'));
              } catch (e) {
                setError(e);
              } finally {
                setUpdating('');
              }
            }}
            className="select select-bordered h-[45px] px-[14px]"
          >
            {cleanliness.map((s) => (
              <option key={s} value={s}>
                {tc(`vocabulary.cleanliness.${s}`, { defaultValue: cleanlinessLabels[s] })}
              </option>
            ))}
          </DropdownSelect>
        ),
      },
    ],
    [cache, notify, updating, t, tc],
  );
  const table = useLegacyTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={t('page.description')}
      />
      <div className="filter-tabs">
        <button className={status === 'all' ? 'selected' : ''} onClick={() => setStatus('all')}>
          {t('page.all')}
        </button>
        {cleanliness.map((s) => (
          <button key={s} className={status === s ? 'selected' : ''} onClick={() => setStatus(s)}>
            {tc(`vocabulary.cleanliness.${s}`, { defaultValue: cleanlinessLabels[s] })}{' '}
            <span>{query.data?.filter((g) => g.cleanliness === s).length ?? 0}</span>
          </button>
        ))}
      </div>
      {!!error && <ErrorNotice error={error} />}{' '}
      {query.isPending && query.fetchStatus !== 'idle' ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : !data.length ? (
        <Empty title={t('page.emptyTitle')} description={t('page.emptyDescription')} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="editorial-note">
        <Shirt size={22} />
        <p>{t('page.careTip')}</p>
      </div>
    </>
  );
}
