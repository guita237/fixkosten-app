import type { Language } from '../api/types';

const LOCALE: Record<Language, string> = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };

export function money(cents: number, lang: Language, currency = 'EUR'): string {
  return (cents / 100).toLocaleString(LOCALE[lang], { style: 'currency', currency });
}

/** Mit Vorzeichen, z. B. "+1.200,00 €" */
export function signedMoney(cents: number, lang: Language, currency = 'EUR'): string {
  const formatted = money(Math.abs(cents), lang, currency);
  if (cents > 0) {
    return '+' + formatted;
  } else if (cents < 0) {
    return '−' + formatted;
  }
  return formatted;
}

/** Betrag für ein Eingabefeld, z. B. 85000 -> "850,00" (de) */
export function centsToInput(cents: number | null | undefined, lang: Language): string {
  if (cents === null || cents === undefined) {
    return '';
  }
  return (cents / 100).toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Eingabe in Cent: "850", "850,5", "1.234,56", "1234.56", "1,234.56".
 * Das letzte Trennzeichen mit 1–2 Nachkommastellen ist das Dezimaltrennzeichen.
 */
export function parseMoneyInput(value: string): number | null {
  let v = value.replace(/[€\s]/g, '');
  if (v === '') {
    return null;
  }
  let negative = false;
  if (v.startsWith('-')) {
    negative = true;
    v = v.substring(1);
  }
  const lastSep = Math.max(v.lastIndexOf(','), v.lastIndexOf('.'));
  let intPart = v;
  let fracPart = '';
  if (lastSep >= 0 && v.length - lastSep - 1 >= 1 && v.length - lastSep - 1 <= 2) {
    intPart = v.substring(0, lastSep);
    fracPart = v.substring(lastSep + 1);
  }
  intPart = intPart.replace(/[.,']/g, '');
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart) || (intPart === '' && fracPart === '')) {
    return null;
  }
  const cents = Number(intPart || '0') * 100 + Number(fracPart.padEnd(2, '0') || '0');
  if (negative) {
    return -cents;
  }
  return cents;
}

/** 'YYYY-MM-DD' -> lokal formatiert (z. B. 01.12.2026) */
export function date(value: string | null | undefined, lang: Language): string {
  if (!value) {
    return '—';
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALE[lang], { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 'YYYY-MM-DD' -> kurz (z. B. 01.12.) */
export function shortDate(value: string, lang: Language): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALE[lang], { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
}

/** 'YYYY-MM' -> "Dezember 2026" */
export function monthLabel(month: string, lang: Language): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(LOCALE[lang], { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonth(): string {
  return todayIso().substring(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function percent(part: number, total: number, lang: Language): string {
  if (total <= 0) {
    return '0 %';
  }
  return (part / total).toLocaleString(LOCALE[lang], { style: 'percent', maximumFractionDigits: 1 });
}
