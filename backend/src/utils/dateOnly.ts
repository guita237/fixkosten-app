// Hilfsfunktionen für reine Kalenderdaten im Format 'YYYY-MM-DD'.
// Alles wird in UTC gerechnet, damit Zeitzonen und Sommerzeit keine Tage verschieben.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  year: number;
  month: number; // 1–12
  day: number;
}

export function parseDate(value: string): DateParts {
  const match = DATE_RE.exec(value);
  if (!match) {
    throw new Error(`Ungültiges Datum: ${value} (erwartet YYYY-MM-DD)`);
  }
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) {
    throw new Error(`Ungültiges Datum: ${value}`);
  }
  return parts;
}

export function formatDate(parts: DateParts): string {
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}

export function isValidDate(value: string): boolean {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Addiert Monate zu einem Datum. Der Tag wird auf das Monatsende begrenzt,
 * wobei anchorDay (Standard: Tag des Startdatums) als gewünschter Tag dient.
 * Beispiel: 2026-01-31 + 1 Monat = 2026-02-28, + 2 Monate = 2026-03-31.
 */
export function addMonths(value: string, months: number, anchorDay?: number): string {
  const start = parseDate(value);
  let day = start.day;
  if (anchorDay !== undefined) {
    day = anchorDay;
  }
  const totalMonths = start.year * 12 + (start.month - 1) + months;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return formatDate({ year, month, day: Math.min(day, daysInMonth(year, month)) });
}

export function addDays(value: string, days: number): string {
  const p = parseDate(value);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return formatDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

export function diffDays(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

export function monthsBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function today(): string {
  const d = new Date();
  return formatDate({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
}
