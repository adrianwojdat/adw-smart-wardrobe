import { Link } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, Leaf, LockKeyhole, Shirt, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/ui/button';

export function Landing() {
  const { t } = useTranslation('auth');

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
            <Link to="/login">{t('landing.login')}</Link>
          </Button>
          <Button asChild>
            <Link to="/register">
              {t('landing.openWardrobe')} <ArrowUpRight size={17} />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <span className="eyebrow">
              <span className="small-dot" /> {t('landing.eyebrow')}
            </span>
            <h1>
              {t('landing.headlineFirst')}
              <br />
              {t('landing.headlineSecond')} <em>{t('landing.headlineEmphasis')}</em>
            </h1>
            <p>{t('landing.intro')}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/register">
                  {t('landing.createWardrobe')} <ArrowRight size={18} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/login">{t('landing.haveAccount')}</Link>
              </Button>
            </div>
            <div className="landing-proof">
              <LockKeyhole size={15} /> {t('landing.privacy')}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-frame">
              <span className="art-caption">{t('landing.artCaption')}</span>
              <div className="art-hanger">
                <Shirt strokeWidth={0.55} />
              </div>
              <span className="art-bottom">
                {t('landing.artBottom')}
                <br />
                <small>{t('landing.artNumber')}</small>
              </span>
            </div>
            <span className="art-sticker">
              <Leaf size={20} />
              <span>
                {t('landing.stickerFirst')}
                <br />
                <strong>{t('landing.stickerSecond')}</strong>
              </span>
            </span>
            <span className="art-number">W.</span>
          </div>
        </section>
        <section className="landing-features">
          {[
            {
              icon: Shirt,
              title: t('landing.featureOneTitle'),
              text: t('landing.featureOneText'),
            },
            {
              icon: Leaf,
              title: t('landing.featureTwoTitle'),
              text: t('landing.featureTwoText'),
            },
            {
              icon: Users,
              title: t('landing.featureThreeTitle'),
              text: t('landing.featureThreeText'),
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
        Smart Wardrobe<span>{t('landing.footer')}</span>
      </footer>
    </div>
  );
}
