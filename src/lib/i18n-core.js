import { setDateLanguage } from './dates.js';
import { ID } from './i18n-id.js';

// Indonesian is the default; English is available from the sidebar switch.
// Text is written in English in the code and looked up in ID (src/lib/i18n-id.js);
// anything missing falls back to English (and is logged while developing).
const STORAGE_KEY = 'pt.lang';
const readSaved = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
};

let current = readSaved();
setDateLanguage(current);
if (typeof document !== 'undefined') document.documentElement.lang = current;

const missing = new Set();

// t('Saved {n} items', { n: 3 }) — usable anywhere, including outside components.
export function t(text, vars) {
  let out = text;
  if (current === 'id') {
    if (ID[text] != null) out = ID[text];
    else if (import.meta.env?.DEV && !missing.has(text)) {
      missing.add(text);
      console.warn('[i18n] missing Indonesian:', text);
    }
  }
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : out;
}

export const getLanguage = () => current;

export function setLanguage(next) {
  current = next;
  setDateLanguage(next);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
}
