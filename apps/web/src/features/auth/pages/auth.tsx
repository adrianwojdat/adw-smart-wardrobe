import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Check, LockKeyhole, Shirt } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { loginSchema, registerSchema } from '@wardrobe/shared';

import { ErrorNotice } from '../../../app/providers/context';
import { Button } from '../../../components/ui/button';
import { api, request } from '../../../lib/api/client';

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { t } = useTranslation('auth');
  const { t: tv } = useTranslation('validation');
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState('');
  const schema =
    mode === 'register'
      ? registerSchema
      : mode === 'login'
        ? loginSchema
        : mode === 'forgot'
          ? z.object({ email: z.email() })
          : z.object({ password: registerSchema.shape.password });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email?: string; password?: string; name?: string; rememberMe?: boolean }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { rememberMe: true },
  });
  const titles = {
    login: t('page.loginTitle'),
    register: t('page.registerTitle'),
    forgot: t('page.forgotTitle'),
    reset: t('page.resetTitle'),
  };
  const descriptions = {
    login: t('page.loginDescription'),
    register: t('page.registerDescription'),
    forgot: t('page.forgotDescription'),
    reset: t('page.resetDescription'),
  };

  async function submit(data: {
    email?: string;
    password?: string;
    name?: string;
    rememberMe?: boolean;
  }) {
    setError(undefined);

    try {
      if (mode === 'login') {
        await api.login(loginSchema.parse(data));
        cache.clear();
        await navigate({ to: '/dashboard' });
      }

      if (mode === 'register') {
        const result = await api.register(registerSchema.parse(data));

        if (result.confirmationRequired) setMessage(t('page.confirmationSent'));
        else {
          cache.clear();
          await navigate({ to: '/dashboard' });
        }
      }

      if (mode === 'forgot') {
        await request('/api/auth/forgot-password', z.object({ ok: z.boolean() }), 'POST', data);
        setMessage(t('page.forgotSent'));
      }

      if (mode === 'reset') {
        await request('/api/auth/password', z.object({ ok: z.boolean() }), 'POST', data);
        cache.clear();
        setMessage(t('page.passwordChanged'));
      }
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Shirt size={22} />
          </span>
          <span>
            smart<span className="brand-light">wardrobe</span>
          </span>
        </Link>
        <div>
          <span className="eyebrow">{t('page.storyEyebrow')}</span>
          <h2>
            {t('page.storyFirst')}
            <br />
            {t('page.storySecond')}
          </h2>
          <p>{t('page.storyText')}</p>
        </div>
        <span className="auth-story-footer">
          <LockKeyhole size={17} /> {t('page.serverPrivacy')}
        </span>
      </aside>
      <main className="auth-form-wrap">
        <Link to="/" className="back-link">
          {t('page.home')}
        </Link>
        <div className="auth-form">
          <span className="eyebrow">SMART WARDROBE</span>
          <h1>{titles[mode]}</h1>
          <p className="text-muted mb-8">{descriptions[mode]}</p>
          {message ? (
            <div role="status" className="success-panel">
              <Check />
              <p>{message}</p>
              <Link to="/login">{t('page.goToLogin')}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(submit)} noValidate>
              {mode === 'register' && (
                <label>
                  {t('page.yourName')}
                  <input
                    {...register('name')}
                    autoComplete="given-name"
                    placeholder={t('page.namePlaceholder')}
                    className="input input-bordered h-[45px] px-[14px]"
                  />
                  {errors.name && <span className="field-error">{t('page.nameRequired')}</span>}
                </label>
              )}
              {mode !== 'reset' && (
                <label>
                  {t('page.email')}
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    placeholder={t('page.emailPlaceholder')}
                    className="input input-bordered h-[45px] px-[14px]"
                  />
                  {errors.email && <span className="field-error">{t('page.emailInvalid')}</span>}
                </label>
              )}
              {mode !== 'forgot' && (
                <label>
                  {t('page.password')}
                  <input
                    {...register('password')}
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={mode === 'login' ? t('page.yourPassword') : t('page.passwordMin')}
                    className="input input-bordered h-[45px] px-[14px]"
                  />
                  {errors.password && (
                    <span className="field-error">
                      {errors.password.message?.includes('128')
                        ? t('page.passwordMaxError')
                        : errors.password.message?.includes('12')
                          ? t('page.passwordMinError')
                          : tv('invalid')}
                    </span>
                  )}
                </label>
              )}
              {mode === 'login' && (
                <label className="!flex !flex-row items-start gap-3 !my-4 !font-normal">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm !min-h-5 !h-5 !w-5 !p-0 mt-1 shrink-0"
                    {...register('rememberMe')}
                    aria-describedby="remember-me-description"
                    aria-labelledby="remember-me-label"
                  />
                  <span>
                    <span id="remember-me-label" className="block font-medium">
                      {t('page.rememberMe')}
                    </span>
                    <span
                      id="remember-me-description"
                      className="block text-xs text-base-content/60 mt-1 leading-relaxed"
                    >
                      {t('page.rememberMeDescription')}
                    </span>
                  </span>
                </label>
              )}
              {mode === 'login' && (
                <Link to="/forgot-password" className="forgot-link">
                  {t('page.forgotPassword')}
                </Link>
              )}
              {!!error && <ErrorNotice error={error} />}
              <Button disabled={isSubmitting} className="w-full mt-5">
                {isSubmitting
                  ? '…'
                  : mode === 'login'
                    ? t('page.submitLogin')
                    : mode === 'register'
                      ? t('page.submitRegister')
                      : mode === 'forgot'
                        ? t('page.sendReset')
                        : t('page.setPassword')}
                <ArrowRight size={17} />
              </Button>
            </form>
          )}
          {mode === 'login' ? (
            <p className="auth-switch">
              {t('page.firstTime')} <Link to="/register">{t('page.createAccount')}</Link>
            </p>
          ) : mode === 'register' ? (
            <p className="auth-switch">
              {t('page.alreadyHaveWardrobe')} <Link to="/login">{t('page.logIn')}</Link>
            </p>
          ) : null}
          <div className="auth-privacy">
            <LockKeyhole size={15} /> {t('page.privateServer')}
          </div>
        </div>
      </main>
    </div>
  );
}
