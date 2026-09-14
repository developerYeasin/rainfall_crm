import clsx from 'clsx';
import { LANGUAGES, useLang } from '@/i18n/index.jsx';

export const LanguageSwitch = ({ className }) => {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label="Language"
      className={clsx('inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold', className)}
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          aria-pressed={lang === option.value}
          onClick={() => setLang(option.value)}
          className={clsx(
            'rounded-md px-2.5 py-1 transition',
            lang === option.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {option.value === 'en' ? 'English' : 'বাংলা'}
        </button>
      ))}
    </div>
  );
};
