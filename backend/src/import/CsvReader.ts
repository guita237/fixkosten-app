// Liest Bank-CSV-Exporte: Kodierung, Trennzeichen, Kopfzeile, Datum und Betrag erkennen.

export interface BankTransaction {
  index: number;
  date: string; // YYYY-MM-DD (Buchungstag)
  amountCents: number; // negativ = Ausgang, positiv = Eingang
  counterparty: string;
  reference: string;
}

export interface ColumnMapping {
  date: string;
  amount: string;
  counterparty?: string;
  reference?: string;
  /** Optional: Spalte, deren Wert "COMPLETED" sein muss (Revolut) */
  state?: string;
}

export interface ParseResult {
  format: string;
  mapping: ColumnMapping;
  headers: string[];
  transactions: BankTransaction[];
  skippedRows: number;
}

export class CsvFormatError extends Error {}

/** UTF-8 (mit/ohne BOM), sonst Windows-1252/Latin-1 (ältere Sparkassen-Exporte). */
export function decode(buffer: Buffer): string {
  let text = buffer.toString('utf8');
  if (text.includes('�')) {
    text = buffer.toString('latin1');
  }
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.substring(1);
  }
  return text;
}

export function detectDelimiter(line: string): string {
  const candidates = [';', ',', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const c of candidates) {
    const count = splitLine(line, c).length;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

/** RFC-4180-artig: Anführungszeichen, verdoppelte "" und Trennzeichen in Feldern. */
export function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/** Zeilen trennen, aber Zeilenumbrüche innerhalb von Anführungszeichen beibehalten. */
export function splitRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
      if (current.trim() !== '') {
        records.push(current);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') {
    records.push(current);
  }
  return records;
}

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Datum: 2026-11-03, 2026-11-03 06:23:24, 03.11.2026, 03.11.26, 03/11/2026 (Tag zuerst). */
export function parseBankDate(value: string): string | null {
  const v = value.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(v);
  if (m) {
    let year = m[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Betrag in Cent: "-1.234,56", "-1234,56", "-1234.56", "1,234.56", "-850", "−12,00 €".
 * Das letzte Trennzeichen mit 1–2 Nachkommastellen ist das Dezimaltrennzeichen.
 */
export function parseAmountCents(value: string): number | null {
  let v = value.replace(/[€\s]/g, '').replace(/EUR/gi, '').replace('−', '-');
  if (v === '') {
    return null;
  }
  let negative = false;
  if (v.startsWith('-')) {
    negative = true;
    v = v.substring(1);
  } else if (v.startsWith('+')) {
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
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) {
    return null;
  }
  const cents = Number(intPart || '0') * 100 + Number(fracPart.padEnd(2, '0') || '0');
  if (negative) {
    return -cents;
  }
  return cents;
}
