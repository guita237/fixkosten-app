// Bekannte Exportformate + generische Erkennung über Spaltennamen.
import {
  BankTransaction,
  ColumnMapping,
  CsvFormatError,
  decode,
  detectDelimiter,
  normalizeHeader,
  parseAmountCents,
  parseBankDate,
  ParseResult,
  splitLine,
  splitRecords,
} from './CsvReader';

interface KnownFormat {
  name: string;
  /** Alle diese Spalten (normalisiert) müssen vorhanden sein */
  requires: string[];
  mapping: ColumnMapping;
}

// Spaltennamen werden normalisiert verglichen (klein, ä->ae, ...).
const KNOWN_FORMATS: KnownFormat[] = [
  {
    name: 'SPARKASSE',
    requires: ['buchungstag', 'beguenstigter/zahlungspflichtiger', 'betrag'],
    mapping: { date: 'buchungstag', amount: 'betrag', counterparty: 'beguenstigter/zahlungspflichtiger', reference: 'verwendungszweck' },
  },
  {
    name: 'N26',
    requires: ['booking date', 'partner name', 'amount (eur)'],
    mapping: { date: 'booking date', amount: 'amount (eur)', counterparty: 'partner name', reference: 'payment reference' },
  },
  {
    name: 'N26_LEGACY',
    requires: ['date', 'payee', 'amount (eur)'],
    mapping: { date: 'date', amount: 'amount (eur)', counterparty: 'payee', reference: 'payment reference' },
  },
  {
    name: 'REVOLUT',
    requires: ['completed date', 'description', 'amount', 'state'],
    mapping: { date: 'completed date', amount: 'amount', counterparty: 'description', reference: 'description', state: 'state' },
  },
];

// Generische Erkennung (z. B. Vivid oder andere Banken): erste passende Spalte gewinnt.
const ALIASES: Record<keyof Omit<ColumnMapping, 'state'>, string[]> = {
  date: ['buchungstag', 'buchungsdatum', 'booking date', 'completed date', 'date', 'datum', 'wertstellung', 'valutadatum', 'value date', 'transaction date'],
  amount: ['betrag', 'amount (eur)', 'amount', 'betrag (eur)', 'umsatz', 'value', 'summe'],
  counterparty: ['beguenstigter/zahlungspflichtiger', 'empfaenger', 'zahlungsempfaenger', 'auftraggeber', 'partner name', 'payee', 'counterparty', 'merchant', 'name', 'description', 'beschreibung'],
  reference: ['verwendungszweck', 'payment reference', 'reference', 'referenz', 'description', 'beschreibung', 'notiz', 'note'],
};

function findColumn(headers: string[], candidates: string[]): string | undefined {
  for (const c of candidates) {
    if (headers.includes(c)) {
      return c;
    }
  }
  return undefined;
}

export function detectFormat(headers: string[]): { name: string; mapping: ColumnMapping } | null {
  for (const f of KNOWN_FORMATS) {
    if (f.requires.every((r) => headers.includes(r))) {
      return { name: f.name, mapping: f.mapping };
    }
  }
  const date = findColumn(headers, ALIASES.date);
  const amount = findColumn(headers, ALIASES.amount);
  if (!date || !amount) {
    return null;
  }
  return {
    name: 'GENERIC',
    mapping: {
      date,
      amount,
      counterparty: findColumn(headers, ALIASES.counterparty),
      reference: findColumn(headers, ALIASES.reference),
    },
  };
}

/** Kopfzeile suchen: manche Exporte haben Vorspann-Zeilen (Kontoname, Zeitraum, ...). */
function findHeaderRow(records: string[], delimiter: string, manual?: ColumnMapping): number {
  const limit = Math.min(records.length, 15);
  for (let i = 0; i < limit; i++) {
    const headers = splitLine(records[i], delimiter).map(normalizeHeader);
    if (manual) {
      if (headers.includes(normalizeHeader(manual.date)) && headers.includes(normalizeHeader(manual.amount))) {
        return i;
      }
    } else if (detectFormat(headers)) {
      return i;
    }
  }
  return -1;
}

function normalizeMapping(m: ColumnMapping): ColumnMapping {
  const result: ColumnMapping = { date: normalizeHeader(m.date), amount: normalizeHeader(m.amount) };
  if (m.counterparty) {
    result.counterparty = normalizeHeader(m.counterparty);
  }
  if (m.reference) {
    result.reference = normalizeHeader(m.reference);
  }
  if (m.state) {
    result.state = normalizeHeader(m.state);
  }
  return result;
}

export function parseBankCsv(buffer: Buffer, manualMapping?: ColumnMapping): ParseResult {
  const text = decode(buffer);
  const records = splitRecords(text);
  if (records.length < 2) {
    throw new CsvFormatError('Die Datei enthält keine Buchungen');
  }

  // Trennzeichen an der Zeile mit den meisten Feldern festmachen (Vorspann ignorieren)
  let delimiter = ';';
  let maxFields = 0;
  for (const r of records.slice(0, 15)) {
    const d = detectDelimiter(r);
    const n = splitLine(r, d).length;
    if (n > maxFields) {
      maxFields = n;
      delimiter = d;
    }
  }

  const headerIndex = findHeaderRow(records, delimiter, manualMapping);
  if (headerIndex < 0) {
    throw new CsvFormatError('Format nicht erkannt: keine Spalten für Datum und Betrag gefunden. Spalten bitte manuell angeben.');
  }
  const headers = splitLine(records[headerIndex], delimiter).map(normalizeHeader);

  let format = 'MANUAL';
  let mapping: ColumnMapping;
  if (manualMapping) {
    mapping = normalizeMapping(manualMapping);
  } else {
    const detected = detectFormat(headers);
    if (!detected) {
      throw new CsvFormatError('Format nicht erkannt');
    }
    format = detected.name;
    mapping = detected.mapping;
  }

  const col = (name?: string): number => {
    if (!name) {
      return -1;
    }
    return headers.indexOf(name);
  };
  const iDate = col(mapping.date);
  const iAmount = col(mapping.amount);
  const iParty = col(mapping.counterparty);
  const iRef = col(mapping.reference);
  const iState = col(mapping.state);
  if (iDate < 0 || iAmount < 0) {
    throw new CsvFormatError(`Spalten nicht gefunden: ${mapping.date} / ${mapping.amount}`);
  }

  const transactions: BankTransaction[] = [];
  let skipped = 0;
  for (let r = headerIndex + 1; r < records.length; r++) {
    const fields = splitLine(records[r], delimiter);
    const date = parseBankDate(fields[iDate] ?? '');
    const amount = parseAmountCents(fields[iAmount] ?? '');
    let stateOk = true;
    if (iState >= 0 && (fields[iState] ?? '').toUpperCase() !== 'COMPLETED') {
      stateOk = false;
    }
    if (!date || amount === null || amount === 0 || !stateOk) {
      skipped++;
      continue;
    }
    let counterparty = '';
    if (iParty >= 0) {
      counterparty = fields[iParty] ?? '';
    }
    let reference = '';
    if (iRef >= 0 && iRef !== iParty) {
      reference = fields[iRef] ?? '';
    }
    transactions.push({ index: transactions.length, date, amountCents: amount, counterparty, reference });
  }

  return { format, mapping, headers, transactions, skippedRows: skipped };
}
