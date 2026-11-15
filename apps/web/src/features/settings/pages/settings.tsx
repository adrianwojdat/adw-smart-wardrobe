import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { LoaderCircle, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { aiPreferencesSchema } from '@wardrobe/shared';

import { ErrorNotice, useMe, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { request } from '../../../lib/api/client';

import { PageHeading } from '../../catalog';
import { useAnalysisActivity } from '../../image-analysis';

import { GeminiSettingsPanel } from '../components/gemini-settings';
import { LanguageSelector } from '../components/LanguageSelector';

export function Settings() {
  const { t } = useTranslation('settings');
  const me = useMe();
  const activity = useAnalysisActivity();
  const [savingAi, setSavingAi] = useState(false);
  const [pendingAi, setPendingAi] = useState<boolean>();
  const [aiError, setAiError] = useState<unknown>();
  const preferences = useQuery({
    queryKey: ['ai-preferences', me.data?.id],
    queryFn: () => request('/api/preferences/ai', aiPreferencesSchema),
    enabled: !!me.data,
  });
  const cache = useQueryClient();
  const { notify, wardrobes, choose } = useWardrobe();
  const [deleting, setDeleting] = useState<(typeof wardrobes)[number]>();
  const [removing, setRemoving] = useState(false);
  const [analyzing, setAnalyzing] = useState<string>();
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [name, setName] = useState(me.data?.name ?? '');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () =>
      request(
        '/api/config',
        z.object({ smtpConfigured: z.boolean(), emailConfirmation: z.boolean() }),
      ),
  });

  return (
    <>
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={t('page.description')}
      />
      <LanguageSelector />
      <GeminiSettingsPanel />
      <section className="form-panel card bg-base-100 mb-6">
        <h2>{t('page.wardrobes')}</h2>
        <p className="source-note">{t('page.analysisNote')}</p>
        {analysisMessage && (
          <p role="status" className="source-note">
            {analysisMessage}
          </p>
        )}
        {!!error && <ErrorNotice error={error} />}
        {!wardrobes.length && <p>{t('page.noWardrobes')}</p>}
        {activity.error && <ErrorNotice error={activity.error} />}
        {wardrobes.map((w) => {
          const pending = (activity.data ?? [])
            .filter((a) => a.wardrobe_id === w.id)
            .reduce((sum, a) => sum + a.queued + a.processing, 0);
          const running = pending > 0 || analyzing === w.id;

          return (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                {w.name}
                {w.kind === 'family' ? ` · ${t('page.family')}` : ` · ${t('page.private')}`}
              </span>
              {w.owner_id === me.data?.id ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !!analyzing || removing || running || activity.isPending || !!activity.error
                    }
                    onClick={async () => {
                      setAnalyzing(w.id);
                      setError(undefined);
                      setAnalysisMessage('');

                      try {
                        const result = await request(
                          `/api/wardrobes/${w.id}/analyze`,
                          z.object({
                            queued: z.number().int().nonnegative(),
                            pending: z.number().int().nonnegative(),
                            missing: z.number().int().nonnegative(),
                          }),
                          'POST',
                          {},
                        );

                        setAnalysisMessage(t('page.queueResult', { name: w.name, ...result }));
                        await activity.refetch();
                        await cache.invalidateQueries({ queryKey: ['jobs'] });
                      } catch (e) {
                        setError(e);
                      } finally {
                        setAnalyzing(undefined);
                      }
                    }}
                  >
                    {running ? (
                      <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {analyzing === w.id
                      ? t('page.queueing')
                      : running
                        ? t('page.analysisPending', { count: pending })
                        : t('page.reanalyzeAll')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(undefined);
                      setDeleting(w);
                    }}
                  >
                    <Trash2 size={16} />
                    {t('page.remove')}
                  </Button>
                </div>
              ) : (
                <span className="source-note">{t('page.ownerOnly')}</span>
              )}
            </div>
          );
        })}
      </section>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !removing) setDeleting(undefined);
        }}
        title={t('page.deleteWardrobeTitle')}
        description={t('page.deleteWardrobeDescription', { name: deleting?.name ?? '' })}
      >
        <div className="flex gap-3">
          <Button variant="outline" disabled={removing} onClick={() => setDeleting(undefined)}>
            {t('page.cancel')}
          </Button>
          <Button
            disabled={removing}
            onClick={async () => {
              if (!deleting) return;
              setRemoving(true);
              setError(undefined);

              try {
                await request(
                  `/api/wardrobes/${deleting.id}`,
                  z.object({ ok: z.boolean() }),
                  'DELETE',
                );
                choose('');
                setDeleting(undefined);
                await Promise.all(
                  ['wardrobes', 'garments', 'outfits', 'jobs'].map((key) =>
                    cache.invalidateQueries({ queryKey: [key] }),
                  ),
                );
                notify(t('page.wardrobeDeleted'));
              } catch (e) {
                setError(e);
              } finally {
                setRemoving(false);
              }
            }}
          >
            {removing ? t('page.deleting') : t('page.deleteGarmentAndWardrobe')}
          </Button>
        </div>
        {!!error && <ErrorNotice error={error} />}
      </Dialog>
      <section className="form-panel card bg-base-100 mb-6">
        <h2>{t('page.aiAutomation')}</h2>
        <label className="flex items-start gap-3 mt-4">
          <input
            type="checkbox"
            style={{ width: 20, minHeight: 20 }}
            checked={pendingAi ?? preferences.data?.ai_overwrite_metadata ?? false}
            disabled={savingAi || preferences.isPending || !!preferences.error}
            onChange={async (e) => {
              const checked = e.target.checked;

              setSavingAi(true);
              setPendingAi(checked);
              setAiError(undefined);

              try {
                const saved = await request('/api/preferences/ai', aiPreferencesSchema, 'PATCH', {
                  ai_overwrite_metadata: checked,
                });

                cache.setQueryData(['ai-preferences', me.data?.id], saved);
                notify(t('page.settingSaved'));
              } catch (e) {
                setAiError(e);
              } finally {
                setSavingAi(false);
                setPendingAi(undefined);
              }
            }}
            className="checkbox"
          />
          <span>{t('page.allowOverwrite')}</span>
        </label>
        <p className="source-note">{t('page.allowOverwriteDescription')}</p>
        <p className="source-note">{t('page.allowOverwriteNote')}</p>
        {savingAi && <p role="status">{t('page.savingSetting')}</p>}
        {preferences.error && <ErrorNotice error={preferences.error} />}
        {!!aiError && <ErrorNotice error={aiError} />}
      </section>
      <div className="settings-grid">
        <section className="form-panel card bg-base-100">
          <h2>{t('page.profile')}</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);

              try {
                await request('/api/profile', z.unknown(), 'PATCH', { name });
                await cache.invalidateQueries({ queryKey: ['me'] });
                notify(t('page.profileUpdated'));
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t('page.name')}
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input input-bordered h-[45px] px-[14px]"
              />
            </label>
            <label>
              {t('page.email')}
              <input
                readOnly
                value={me.data?.email ?? ''}
                className="input input-bordered h-[45px] px-[14px]"
              />
            </label>
            <Button disabled={busy}>{t('page.saveChanges')}</Button>
          </form>
          {!!error && <ErrorNotice error={error} />}
          <hr className="my-6" />
          <h3>{t('page.security')}</h3>
          <p className="text-muted my-3">{t('page.passwordDescription')}</p>
          <Button variant="outline" asChild>
            <Link to="/reset-password">{t('page.changePassword')}</Link>
          </Button>
        </section>
        <section className="form-panel card bg-base-100">
          <ShieldCheck size={27} strokeWidth={1.3} />
          <h2 className="mt-4">{t('page.privacyTitle')}</h2>
          <p className="text-muted">{t('page.privacyDescription')}</p>
          <div className="setting-status">
            <span>{t('page.emailDelivery')}</span>
            <strong>
              {config.data?.smtpConfigured ? t('page.configured') : t('page.notConfigured')}
            </strong>
          </div>
          <div className="setting-status">
            <span>{t('page.aiAnalysis')}</span>
            <strong>{t('page.separateLanComputer')}</strong>
          </div>
          <div className="setting-status">
            <span>{t('page.outfitSuggestions')}</span>
            <strong>{t('page.rulesAndWardrobe')}</strong>
          </div>
          <h3 className="mt-6">{t('page.alwaysAtHand')}</h3>
          <p className="text-muted mt-2">{t('page.installDescription')}</p>
        </section>
      </div>
    </>
  );
}
