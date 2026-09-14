import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EN } from './en.js';

/**
 * Bangla source strings are the translation keys: `t('সংরক্ষণ')` returns "Save" in English
 * and the original text in Bangla. Unknown strings (client names, notes) pass through untouched.
 * Placeholders use `{name}`: t('{n} অর্ডার', { n: 5 }).
 */
const STORAGE_KEY = 'rf_lang';
export const LANGUAGES = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'bn', label: 'বাংলা', short: 'বাং' },
];

const readStored = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'bn' || saved === 'en' ? saved : 'en';
  } catch {
    return 'en';
  }
};

// Module-level so plain helpers (toasts, confirms, label maps) can translate without a hook.
let current = readStored();

export const getLang = () => current;

export const t = (text, vars) => {
  if (typeof text !== 'string') return text;
  let out = current === 'en' ? (EN[text] ?? text) : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, key) => (vars[key] ?? m));
  return out;
};

const BN_DIGIT = /[০-৯]/g;
const DATA_PATTERNS = [
  [/^সপ্তাহ\s*(.+)$/, 'Week $1'],
  [/^মাস\s*(.+)$/, 'Month $1'],
  [/^(.+)\sমোট টার্গেট$/, '$1 total target'],
  [/^(.+)\sমোট$/, '$1 total'],
];

/**
 * For labels the server builds dynamically ("সপ্তাহ ১", "মাস ১ মোট"): exact dictionary hit first,
 * then a few known shapes with Bangla digits converted.
 */
export const tData = (text) => {
  if (typeof text !== 'string' || current !== 'en') return text;
  if (EN[text]) return EN[text];
  const ascii = text.replace(BN_DIGIT, (d) => String(d.charCodeAt(0) - 0x09e6));
  for (const [re, out] of DATA_PATTERNS) {
    if (re.test(ascii)) return ascii.replace(re, (...m) => out.replace('$1', tData(m[1])));
  }
  return ascii === text ? text : ascii;
};

const applyDocumentLang = (lang) => {
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;
};
applyDocumentLang(current);

const LanguageContext = createContext({ lang: current, setLang: () => {} });

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(current);

  const setLang = useCallback((next) => {
    current = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — choice just won't persist */
    }
    applyDocumentLang(next);
    setLangState(next);
  }, []);

  useEffect(() => applyDocumentLang(lang), [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLang = () => useContext(LanguageContext);

/** Remounts its subtree on language change so every `t()` call re-runs. */
export const LanguageBoundary = ({ children }) => {
  const { lang } = useLang();
  return <div key={lang} className="contents">{children}</div>;
};
