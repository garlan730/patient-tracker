import { Fragment, createContext, useCallback, useContext, useState } from 'react';
import { getLanguage, setLanguage } from './i18n-core.js';

export { t } from './i18n-core.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getLanguage());
  const change = useCallback((next) => {
    setLanguage(next);
    setLang(next);
  }, []);
  // Re-mounting the app on a switch re-renders every label in the new language.
  return (
    <LanguageContext.Provider value={{ lang, setLanguage: change }}>
      <Fragment key={lang}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
