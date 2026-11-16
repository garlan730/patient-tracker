import { t, useLanguage } from '../lib/i18n.jsx';
import { cx } from './ui.jsx';

// ID / EN switch. `dark` for the green sidebar, light for the sign-in card.
export default function LanguageToggle({ dark }) {
  const { lang, setLanguage } = useLanguage();
  return (
    <div className={cx('flex rounded-md p-0.5 text-xs', dark ? 'bg-white/10' : 'bg-slate-100')} role="group" aria-label={t('Language')}>
      {[['id', 'ID', 'Bahasa Indonesia'], ['en', 'EN', 'English']].map(([code, label, name]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={lang === code}
          title={name}
          className={cx(
            'rounded px-2 py-0.5 font-semibold',
            lang === code
              ? dark ? 'bg-white text-brand-900' : 'bg-white text-slate-900 shadow-sm'
              : dark ? 'text-brand-100 hover:text-white' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
