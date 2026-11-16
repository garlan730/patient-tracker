import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Month and day names follow the app language (set by the language switch).
let locale = idLocale;
export const setDateLanguage = (lang) => { locale = lang === 'id' ? idLocale : undefined; };
export const fmt = (date, pattern) => format(date, pattern, { locale });

// Dates are stored as ISO calendar dates (YYYY-MM-DD) and parsed into Date objects for display/compare.
export const toDate = (iso) => {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
};

export const fmtDate = (iso, pattern = 'dd MMM yyyy') => {
  const d = toDate(iso);
  return d ? fmt(d, pattern) : '';
};

export const fmtDateTime = (iso) => fmtDate(iso, 'dd MMM yyyy, HH:mm');

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');

export const daysSince = (iso) => {
  const d = toDate(iso);
  return d ? differenceInCalendarDays(new Date(), d) : null;
};
