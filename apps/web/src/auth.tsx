import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shirt, ArrowUpRight, ArrowRight, LockKeyhole, Leaf, Users, Check } from 'lucide-react';
import { registerSchema, loginSchema } from '@wardrobe/shared';
import { api, request } from './api';
import { Button } from './components/ui/button';
import { ErrorNotice } from './context';
export function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Shirt size={22} />
          </span>
          <span>
            smart<span className="brand-light">wardrobe</span>
          </span>
        </Link>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link to="/login">Zaloguj się</Link>
          </Button>
          <Button asChild>
            <Link to="/register">
              Otwórz swoją szafę <ArrowUpRight size={17} />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <span className="eyebrow">
              <span className="small-dot" /> TWOJA GARDEROBA. NOWA PERSPEKTYWA.
            </span>
            <h1>
              Mniej szukania.
              <br />
              Więcej <em>Twojego stylu.</em>
            </h1>
            <p>
              Odkryj na nowo ubrania, które już masz. Uporządkuj garderobę, zadbaj o ulubione rzeczy
              i znajdź zestaw na każdy dzień.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/register">
                  Stwórz swoją garderobę <ArrowRight size={18} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/login">Mam już konto</Link>
              </Button>
            </div>
            <div className="landing-proof">
              <LockKeyhole size={15} /> Twoje zdjęcia. Twój serwer. Twoja prywatność.
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-frame">
              <span className="art-caption">THE EVERYDAY COLLECTION</span>
              <div className="art-hanger">
                <Shirt strokeWidth={0.55} />
              </div>
              <span className="art-bottom">
                Miejsce na Twoje ulubione rzeczy.
                <br />
                <small>01 — TWÓJ NOWY POCZĄTEK</small>
              </span>
            </div>
            <span className="art-sticker">
              <Leaf size={20} />
              <span>
                Najlepsza garderoba?
                <br />
                <strong>Ta, którą już masz.</strong>
              </span>
            </span>
            <span className="art-number">W.</span>
          </div>
        </section>
        <section className="landing-features">
          {[
            {
              icon: Shirt,
              title: 'Wszystko na swoim miejscu',
              text: 'Zdjęcia, rozmiary, materiały i ulubione ubrania. Cała szafa pod ręką.',
            },
            {
              icon: Leaf,
              title: 'Noś więcej. Kupuj mniej.',
              text: 'Twórz nowe połączenia ze swoich rzeczy i dbaj o nie na dłużej.',
            },
            {
              icon: Users,
              title: 'Przestrzeń dla rodziny',
              text: 'Prywatne garderoby i wspólne szafy. To Ty decydujesz, kto ma dostęp.',
            },
          ].map((f, i) => (
            <article key={f.title}>
              <span className="feature-number">0{i + 1}</span>
              <f.icon size={23} strokeWidth={1.3} />
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className="landing-footer">
        Smart Wardrobe<span>Świadoma garderoba zaczyna się tutaj.</span>
      </footer>
    </div>
  );
}
export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
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
  } = useForm<{ email?: string; password?: string; name?: string }>({
    resolver: zodResolver(schema) as never,
  });
  const titles = {
    login: 'Dobrze Cię widzieć.',
    register: 'Zrób miejsce na swój styl.',
    forgot: 'Odzyskaj dostęp.',
    reset: 'Nowy początek.',
  };
  const descriptions = {
    login: 'Twoje ulubione rzeczy czekają na Ciebie.',
    register: 'Twoja przemyślana garderoba zaczyna się tutaj.',
    forgot: 'Wyślemy Ci link do ustawienia nowego hasła.',
    reset: 'Ustaw nowe, bezpieczne hasło do swojego konta.',
  };
  async function submit(data: { email?: string; password?: string; name?: string }) {
    setError(undefined);
    try {
      if (mode === 'login') {
        await api.login(loginSchema.parse(data));
        cache.clear();
        await navigate({ to: '/dashboard' });
      }
      if (mode === 'register') {
        const result = await api.register(registerSchema.parse(data));
        if (result.confirmationRequired)
          setMessage('Sprawdź skrzynkę email i potwierdź utworzenie konta.');
        else {
          cache.clear();
          await navigate({ to: '/dashboard' });
        }
      }
      if (mode === 'forgot') {
        await request('/api/auth/forgot-password', z.object({ ok: z.boolean() }), 'POST', data);
        setMessage('Jeśli konto istnieje, otrzymasz wiadomość z instrukcjami.');
      }
      if (mode === 'reset') {
        await request('/api/auth/password', z.object({ ok: z.boolean() }), 'POST', data);
        cache.clear();
        setMessage('Hasło zostało zmienione. Zaloguj się ponownie.');
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
          <span className="eyebrow">TWOJA CODZIENNOŚĆ, W DOBRYM STYLU</span>
          <h2>
            Wszystko, czego
            <br />
            potrzebujesz,
            <br />
            już jest <em>w Twojej szafie.</em>
          </h2>
          <p>
            Daj swoim ulubionym rzeczom
            <br />
            więcej okazji, żeby je nosić.
          </p>
        </div>
        <span className="auth-story-footer">
          <LockKeyhole size={17} /> Prywatna przestrzeń na Twoim serwerze
        </span>
      </aside>
      <main className="auth-form-wrap">
        <Link to="/" className="back-link">
          ← Strona główna
        </Link>
        <div className="auth-form">
          <span className="eyebrow">SMART WARDROBE</span>
          <h1>{titles[mode]}</h1>
          <p className="text-muted mb-8">{descriptions[mode]}</p>
          {message ? (
            <div role="status" className="success-panel">
              <Check />
              <p>{message}</p>
              <Link to="/login">Przejdź do logowania →</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(submit)} noValidate>
              {mode === 'register' && (
                <label>
                  Jak masz na imię?
                  <input {...register('name')} autoComplete="given-name" placeholder="Twoje imię" />
                  {errors.name && <span className="field-error">{errors.name.message}</span>}
                </label>
              )}
              {mode !== 'reset' && (
                <label>
                  Adres email
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    placeholder="ty@example.com"
                  />
                  {errors.email && <span className="field-error">Podaj poprawny adres email.</span>}
                </label>
              )}
              {mode !== 'forgot' && (
                <label>
                  Hasło
                  <input
                    {...register('password')}
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={mode === 'login' ? 'Twoje hasło' : 'Co najmniej 12 znaków'}
                  />
                  {errors.password && (
                    <span className="field-error">{errors.password.message}</span>
                  )}
                </label>
              )}
              {mode === 'login' && (
                <Link to="/forgot-password" className="forgot-link">
                  Nie pamiętasz hasła?
                </Link>
              )}
              {!!error && <ErrorNotice error={error} />}
              <Button disabled={isSubmitting} className="w-full mt-5">
                {isSubmitting
                  ? 'Chwileczkę…'
                  : mode === 'login'
                    ? 'Zaloguj się'
                    : mode === 'register'
                      ? 'Utwórz konto'
                      : mode === 'forgot'
                        ? 'Wyślij link'
                        : 'Zapisz nowe hasło'}
                <ArrowRight size={17} />
              </Button>
            </form>
          )}
          {mode === 'login' ? (
            <p className="auth-switch">
              Pierwszy raz tutaj? <Link to="/register">Utwórz konto</Link>
            </p>
          ) : mode === 'register' ? (
            <p className="auth-switch">
              Masz już swoją garderobę? <Link to="/login">Zaloguj się</Link>
            </p>
          ) : null}
          <div className="auth-privacy">
            <LockKeyhole size={15} /> Dane pozostają na serwerze właściciela aplikacji.
          </div>
        </div>
      </main>
    </div>
  );
}
