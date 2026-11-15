import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LoaderCircle, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  geminiCredentialInputSchema,
  geminiCredentialStatusSchema,
  geminiModelUpdateSchema,
  geminiSettingsSchema,
  geminiTaskSchema,
} from '@wardrobe/shared';

import { ErrorNotice, useMe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { request } from '../../../lib/api/client';
import { userErrorMessage } from '../../../lib/api/user-error';

export function GeminiSettingsPanel() {
  const { t } = useTranslation('settings');
  const me = useMe();
  const cache = useQueryClient();
  const key = ['gemini-settings', me.data?.id];
  const settings = useQuery({
    queryKey: key,
    queryFn: () => request('/api/gemini/settings', geminiSettingsSchema),
    enabled: !!me.data,
    refetchInterval: (query) =>
      ['queued', 'running', 'retrying'].includes(query.state.data?.active_task?.status ?? '')
        ? 1200
        : false,
  });
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const active = settings.data?.active_task;
  const working = !!active && ['queued', 'running', 'retrying'].includes(active.status);
  const models =
    active?.kind === 'list_models' && active.status === 'completed'
      ? (active.result?.models ?? [])
      : [];

  useEffect(() => {
    if (settings.data?.model) setModel(settings.data.model);
  }, [settings.data?.model]);
  useEffect(() => {
    if (active?.status === 'completed' && active.kind === 'connection_test')
      setMessage(t('gemini.connectionOk'));
    if (active?.status === 'completed' && active.kind === 'list_models')
      setMessage(t('gemini.modelsLoaded', { count: active.result?.models?.length ?? 0 }));
    if (active?.status === 'failed') setError(t('gemini.taskFailed'));
    if (active?.status === 'cancelled') setMessage(t('gemini.taskCancelled'));
  }, [active, t]);

  async function runTask(kind: 'connection_test' | 'list_models') {
    setBusy(true);
    setError('');
    setMessage(t('gemini.taskQueued'));

    try {
      const task = await request('/api/gemini/tasks', geminiTaskSchema, 'POST', { kind });

      cache.setQueryData(key, (old: z.infer<typeof geminiSettingsSchema> | undefined) =>
        old ? { ...old, active_task: task } : old,
      );
      await settings.refetch();
    } catch (cause) {
      setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-panel card bg-base-100 mb-6" aria-labelledby="gemini-title">
      <h2 id="gemini-title">{t('gemini.title')}</h2>
      <p className="source-note">{t('gemini.security')}</p>
      {settings.isPending && <p role="status">{t('gemini.loading')}</p>}
      {settings.error && <ErrorNotice error={settings.error} />}
      <div className="settings-grid mt-4">
        <label>
          {settings.data?.configured ? t('gemini.replaceKey') : t('gemini.apiKey')}
          <input
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              settings.data?.configured
                ? `${t('gemini.apiKey')} ····${settings.data.key_hint}`
                : t('gemini.pasteKey')
            }
            aria-label={t('gemini.apiKey')}
            className="input input-bordered h-[45px] px-[14px]"
          />
        </label>
        <label>
          {t('gemini.model')}
          <DropdownSelect
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={!settings.data?.configured || busy || working}
            className="select select-bordered h-[45px] px-[14px]"
          >
            <option value="">{t('gemini.selectModel')}</option>
            {settings.data?.model && !models.some((item) => item.name === settings.data?.model) && (
              <option value={settings.data.model}>
                {settings.data.model} {t('gemini.modelCheck')}
              </option>
            )}
            {models.map((item) => (
              <option key={item.name} value={item.name}>
                {item.displayName}
              </option>
            ))}
          </DropdownSelect>
        </label>
      </div>
      <p className="source-note">{t('gemini.limit', { count: settings.data?.rpm_limit ?? 12 })}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          disabled={busy || working || apiKey.trim().length < 20}
          onClick={async () => {
            setBusy(true);
            setError('');
            setMessage('');

            try {
              await request(
                '/api/gemini/settings',
                geminiCredentialStatusSchema,
                'PUT',
                geminiCredentialInputSchema.parse({ apiKey }),
              );
              setApiKey('');
              await cache.invalidateQueries({ queryKey: key });
              setMessage(t('gemini.keySaved'));
            } catch (cause) {
              setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('gemini.saveKey')}
        </Button>
        <Button
          variant="outline"
          disabled={busy || working || !settings.data?.configured}
          onClick={() => void runTask('list_models')}
        >
          {working && active?.kind === 'list_models' ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {t('gemini.loadModels')}
        </Button>
        <Button
          variant="outline"
          disabled={busy || working || !settings.data?.configured || !settings.data.model}
          onClick={() => void runTask('connection_test')}
        >
          {working && active?.kind === 'connection_test' ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          {t('gemini.checkConnection')}
        </Button>
        {working && active && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              try {
                const task = await request(
                  `/api/gemini/tasks/${active.id}/cancel`,
                  geminiTaskSchema,
                  'POST',
                  {},
                );

                cache.setQueryData(key, (old: z.infer<typeof geminiSettingsSchema> | undefined) =>
                  old ? { ...old, active_task: task } : old,
                );
              } catch (cause) {
                setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
              }
            }}
          >
            {t('gemini.cancelTask')}
          </Button>
        )}
        {settings.data?.configured && !working && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(t('gemini.deleteConfirm'))) return;

              try {
                await request('/api/gemini/settings', z.object({ ok: z.boolean() }), 'DELETE');
                setModel('');
                setMessage(t('gemini.deletedKey'));
                await cache.invalidateQueries({ queryKey: key });
              } catch (cause) {
                setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
              }
            }}
          >
            <Trash2 size={16} />
            {t('gemini.deleteKey')}
          </Button>
        )}
        {settings.data?.configured && model && model !== settings.data.model && !working && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);

              try {
                await request(
                  '/api/gemini/settings/model',
                  geminiCredentialStatusSchema,
                  'PATCH',
                  geminiModelUpdateSchema.parse({ model }),
                );
                await cache.invalidateQueries({ queryKey: key });
                setMessage(t('gemini.savedModel'));
              } catch (cause) {
                setError(userErrorMessage(cause, (key) => t(key, { ns: 'common' })));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('gemini.saveModel')}
          </Button>
        )}
      </div>
      {working && (
        <p className="source-note" role="status">
          {active.kind === 'outfit_recommendation'
            ? active.status === 'queued'
              ? t('gemini.outfitQueued')
              : active.status === 'retrying'
                ? t('gemini.outfitRetry')
                : t('gemini.outfitRunning')
            : active.status === 'queued'
              ? t('gemini.queued')
              : active.status === 'retrying'
                ? t('gemini.retrying')
                : t('gemini.checking')}{' '}
          {t('gemini.queueCount', { count: settings.data?.queue_limit ?? 100 })}
        </p>
      )}
      {message && (
        <p className="source-note" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="source-note" role="alert">
          {error}
        </p>
      )}
      {active?.status === 'failed' && <p className="source-note">{t('gemini.failureHelp')}</p>}
    </section>
  );
}
