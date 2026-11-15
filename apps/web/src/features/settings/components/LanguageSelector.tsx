import { useTranslation } from 'react-i18next';

import { isAppLanguage } from '../../../app/i18n/types';
import { DropdownSelect } from '../../../components/ui/dropdown-select';

export function LanguageSelector() {
  const { t, i18n } = useTranslation('settings');

  return (
    <section className="form-panel card bg-base-100 mb-6" aria-labelledby="language-title">
      <h2 id="language-title">{t('language.title')}</h2>
      <label>
        {t('language.label')}
        <DropdownSelect
          value={isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'}
          onChange={(event) => {
            const language = event.target.value;

            if (isAppLanguage(language)) void i18n.changeLanguage(language);
          }}
          aria-label={t('language.label')}
          className="select select-bordered h-[45px] px-[14px]"
        >
          <option value="en">{t('language.english')}</option>
          <option value="pl">{t('language.polish')}</option>
        </DropdownSelect>
      </label>
    </section>
  );
}
