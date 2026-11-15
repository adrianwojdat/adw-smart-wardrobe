import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, Copy, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ErrorNotice, useMe, useWardrobe } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { DropdownSelect } from '../../../components/ui/dropdown-select';
import { api, request } from '../../../lib/api/client';

import { PageHeading } from '../../catalog';

export function Family() {
  const { t } = useTranslation('family');
  const { wardrobe, wardrobes, create, choose, notify } = useWardrobe();
  const me = useMe();
  const cache = useQueryClient();
  const members = useQuery({
    queryKey: ['members', wardrobe?.id],
    queryFn: () => api.members(wardrobe!.id),
    enabled: !!wardrobe,
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [link, setLink] = useState('');
  const [token, setToken] = useState(
    new URLSearchParams(window.location.search).get('invite') ?? '',
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const owner = wardrobe?.owner_id === me.data?.id;

  return (
    <>
      <PageHeading
        eyebrow={t('page.eyebrow')}
        title={t('page.title')}
        description={t('page.description')}
        action={
          <Button onClick={create}>
            <Plus size={17} />
            {t('page.newWardrobe')}
          </Button>
        }
      />
      <div className="family-layout">
        <section className="form-panel card bg-base-100">
          <h2>{t('page.wardrobes')}</h2>
          <div className="wardrobe-list">
            {wardrobes.map((w) => (
              <button
                key={w.id}
                className={w.id === wardrobe?.id ? 'selected' : ''}
                onClick={() => {
                  choose(w.id);
                  setLink('');
                }}
              >
                <Users size={21} />
                <span>
                  <strong>{w.name}</strong>
                  <small>{w.kind === 'family' ? t('page.shared') : t('page.private')}</small>
                </span>
                {w.id === wardrobe?.id && <Check size={18} />}
              </button>
            ))}
          </div>
          {wardrobe && (
            <>
              <h3 className="mt-6 mb-3">{t('page.members', { name: wardrobe.name })}</h3>
              {members.data?.map((m) => (
                <div className="member-row" key={m.user_id}>
                  <span className="avatar">{m.user_id === me.data?.id ? t('page.you') : 'U'}</span>
                  <div>
                    <strong>{m.user_id === me.data?.id ? me.data?.name : t('page.member')}</strong>
                    <small>
                      {m.user_id.slice(0, 8)} ·{' '}
                      {m.role === 'owner'
                        ? t('page.owner')
                        : m.role === 'editor'
                          ? t('page.editor')
                          : t('page.viewer')}
                    </small>
                  </div>
                  {owner && m.role !== 'owner' && (
                    <>
                      <DropdownSelect
                        aria-label={t('page.memberRole')}
                        value={m.role}
                        onChange={async (e) => {
                          try {
                            await request(
                              `/api/wardrobes/${wardrobe.id}/members/${m.user_id}`,
                              z.unknown(),
                              'PATCH',
                              { role: e.target.value },
                            );
                            await members.refetch();
                          } catch (e) {
                            setError(e);
                          }
                        }}
                        className="select select-bordered h-[45px] px-[14px]"
                      >
                        <option value="viewer">{t('page.viewer')}</option>
                        <option value="editor">{t('page.editor')}</option>
                      </DropdownSelect>
                      <button
                        aria-label={t('page.removeMember')}
                        onClick={async () => {
                          try {
                            await request(
                              `/api/wardrobes/${wardrobe.id}/members/${m.user_id}`,
                              z.unknown(),
                              'DELETE',
                            );
                            await members.refetch();
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </section>
        <section className="form-panel card bg-base-100">
          <h2>{t('page.inviteTitle')}</h2>
          <p className="text-muted">{t('page.inviteDescription')}</p>
          {owner && wardrobe?.kind === 'family' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);

                try {
                  const data = await request(
                    `/api/wardrobes/${wardrobe.id}/invitations`,
                    z.object({ url: z.string() }),
                    'POST',
                    { email, role },
                  );

                  setLink(data.url);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t('page.email')}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('page.inviteEmailPlaceholder')}
                  className="input input-bordered h-[45px] px-[14px]"
                />
              </label>
              <label>
                {t('page.permissions')}
                <DropdownSelect
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="select select-bordered h-[45px] px-[14px]"
                >
                  <option value="viewer">{t('page.viewerPermission')}</option>
                  <option value="editor">{t('page.editorPermission')}</option>
                </DropdownSelect>
              </label>
              <Button disabled={busy}>
                {t('page.createInvite')} <ArrowUpRight size={16} />
              </Button>
              {link && (
                <div className="invite-result">
                  <label>
                    {t('page.inviteLink')}
                    <input
                      readOnly
                      value={link}
                      className="input input-bordered h-[45px] px-[14px]"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link);
                        notify(t('page.copied'));
                      } catch {
                        notify(t('page.copyManually'));
                      }
                    }}
                  >
                    <Copy size={15} />
                    {t('page.copyLink')}
                  </Button>
                  <p>{t('page.manualDelivery')}</p>
                </div>
              )}
            </form>
          ) : (
            <div className="privacy-note">
              <ShieldCheck size={22} />
              {t('page.ownerOnly')}
            </div>
          )}
          <hr className="my-6" />
          <h3>{t('page.haveInvite')}</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);

              try {
                const raw = token.includes('?invite=')
                  ? new URL(token).searchParams.get('invite')
                  : token;

                await request(
                  '/api/invitations/accept',
                  z.object({ wardrobe_id: z.string() }),
                  'POST',
                  { token: raw },
                );
                await cache.invalidateQueries({ queryKey: ['wardrobes'] });
                await cache.invalidateQueries({ queryKey: ['members'] });
                setToken('');
                window.history.replaceState({}, '', window.location.pathname);
                notify(t('page.joined'));
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t('page.inviteToken')}
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="input input-bordered h-[45px] px-[14px]"
              />
            </label>
            <Button variant="outline" disabled={busy}>
              {t('page.join')}
            </Button>
          </form>
          {!!error && <ErrorNotice error={error} />}
        </section>
      </div>
    </>
  );
}
