import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { Language } from '../api/types';
import { MESSAGES, MessageKey } from './messages';

interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

function initialLanguage(): Language {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('lang');
  } catch {
    stored = null;
  }
  if (stored === 'de' || stored === 'fr' || stored === 'en') {
    return stored;
  }
  const browser = navigator.language.substring(0, 2);
  if (browser === 'fr' || browser === 'en') {
    return browser;
  }
  return 'de';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem('lang', next);
    } catch {
      // Speicher nicht verfügbar: Sprache gilt nur für diese Sitzung
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => {
      let text = MESSAGES[lang][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.split(`{${k}}`).join(String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n außerhalb von I18nProvider');
  }
  return ctx;
}
