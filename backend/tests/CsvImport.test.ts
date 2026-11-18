import { describe, expect, it } from 'vitest';
import { parseBankCsv } from '../src/import/BankFormats';
import { parseAmountCents, parseBankDate } from '../src/import/CsvReader';
import { matchTransactions, MatchableItem } from '../src/import/TransactionMatcher';
import { Frequency } from '../src/enums/Frequency';

// Synthetische Beispiel-Exporte (keine echten Daten)
const SPARKASSE = [
  '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"',
  '"DE00123";"01.12.26";"01.12.26";"DAUERAUFTRAG";"Miete Dezember Whg 3";"";"";"";"";"";"";"Hausverwaltung Müller";"DE00999";"XXX";"-850,00";"EUR";"Umsatz gebucht"',
  '"DE00123";"03.12.26";"03.12.26";"FOLGELASTSCHRIFT";"Telekom Rechnung 12/2026";"DE00ZZZ";"M1";"";"";"";"";"Telekom Deutschland GmbH";"DE00888";"XXX";"-39,99";"EUR";"Umsatz gebucht"',
  '"DE00123";"05.12.26";"05.12.26";"GUTSCHR. UEBERWEISUNG";"Gehalt 12/2026";"";"";"";"";"";"";"Arbeitgeber GmbH";"DE00777";"XXX";"3.000,00";"EUR";"Umsatz gebucht"',
].join('\r\n');

const N26 = [
  '"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"',
  '"2026-12-15","2026-12-15","Netflix","","Presentment","","Main Account","-13.99","","",""',
  '"2026-12-05","2026-12-05","Tontine Gruppe","DE00555","Debit Transfer","Tontine Dezember","Main Account","-100.00","","",""',
].join('\n');

const N26_LEGACY = [
  '"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)","Amount (Foreign Currency)","Type Foreign Currency","Exchange Rate"',
  '"2026-12-05","Mobilfunk AG","","MasterCard Payment","Handy 12/2026","-15.0","","",""',
].join('\n');

const REVOLUT = [
  'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
  'CARD_PAYMENT,Current,2026-12-01 08:00:00,2026-12-02 09:12:00,Fitnessstudio,-29.90,0.00,EUR,COMPLETED,500.00',
  'CARD_PAYMENT,Current,2026-12-03 10:00:00,,Pending Shop,-5.00,0.00,EUR,PENDING,',
].join('\n');

// Unbekanntes Format (z. B. Vivid): Erkennung über Spaltennamen, Komma als Dezimaltrennzeichen
const GENERIC = [
  'Kontoauszug Vivid Money',
  '',
  'Datum;Empfänger;Verwendungszweck;Betrag (EUR)',
  '20.12.2026;Tontine Gruppe;Tontine B Dezember;-50,00',
].join('\n');

describe('CsvReader', () => {
  it('Beträge in allen Schreibweisen', () => {
    expect(parseAmountCents('-850,00')).toBe(-85000);
    expect(parseAmountCents('-1.234,56')).toBe(-123456);
    expect(parseAmountCents('1,234.56')).toBe(123456);
    expect(parseAmountCents('-13.99')).toBe(-1399);
    expect(parseAmountCents('-15.0')).toBe(-1500);
    expect(parseAmountCents('3.000,00')).toBe(300000);
    expect(parseAmountCents('-850')).toBe(-85000);
    expect(parseAmountCents('abc')).toBeNull();
  });

  it('Datumsformate', () => {
    expect(parseBankDate('01.12.26')).toBe('2026-12-01');
    expect(parseBankDate('1.2.2027')).toBe('2027-02-01');
    expect(parseBankDate('2026-12-02 09:12:00')).toBe('2026-12-02');
    expect(parseBankDate('15/12/2026')).toBe('2026-12-15');
    expect(parseBankDate('')).toBeNull();
  });
});

describe('Formaterkennung', () => {
  it('Sparkasse (Latin-1 kodiert)', () => {
    const r = parseBankCsv(Buffer.from(SPARKASSE, 'latin1'));
    expect(r.format).toBe('SPARKASSE');
    expect(r.transactions).toHaveLength(3);
    expect(r.transactions[0]).toMatchObject({ date: '2026-12-01', amountCents: -85000, counterparty: 'Hausverwaltung Müller', reference: 'Miete Dezember Whg 3' });
    expect(r.transactions[2].amountCents).toBe(300000);
  });

  it('Sparkasse (UTF-8 mit BOM)', () => {
    const r = parseBankCsv(Buffer.from('﻿' + SPARKASSE, 'utf8'));
    expect(r.format).toBe('SPARKASSE');
    expect(r.transactions[0].counterparty).toBe('Hausverwaltung Müller');
  });

  it('N26 (aktuell und alt)', () => {
    expect(parseBankCsv(Buffer.from(N26)).format).toBe('N26');
    const legacy = parseBankCsv(Buffer.from(N26_LEGACY));
    expect(legacy.format).toBe('N26_LEGACY');
    expect(legacy.transactions[0]).toMatchObject({ amountCents: -1500, counterparty: 'Mobilfunk AG' });
  });

  it('Revolut: nur abgeschlossene Buchungen', () => {
    const r = parseBankCsv(Buffer.from(REVOLUT));
    expect(r.format).toBe('REVOLUT');
    expect(r.transactions).toHaveLength(1);
    expect(r.skippedRows).toBe(1);
    expect(r.transactions[0].date).toBe('2026-12-02');
  });

  it('Unbekanntes Format mit Vorspann (z. B. Vivid)', () => {
    const r = parseBankCsv(Buffer.from(GENERIC));
    expect(r.format).toBe('GENERIC');
    expect(r.transactions[0]).toMatchObject({ date: '2026-12-20', amountCents: -5000, counterparty: 'Tontine Gruppe' });
  });

  it('manuelle Spaltenzuordnung', () => {
    const csv = 'Wann;Wieviel;Wer\n01.12.2026;-10,00;Test';
    expect(() => parseBankCsv(Buffer.from(csv))).toThrow();
    const r = parseBankCsv(Buffer.from(csv), { date: 'Wann', amount: 'Wieviel', counterparty: 'Wer' });
    expect(r.format).toBe('MANUAL');
    expect(r.transactions[0].amountCents).toBe(-1000);
  });
});

describe('Zuordnung', () => {
  const items: MatchableItem[] = [
    { id: 1, name: 'Miete', provider: 'Hausverwaltung Müller', firstDueDate: '2026-08-01', frequency: Frequency.MONTHLY, amountCents: 85000, payouts: [], payments: [] },
    { id: 2, name: 'Internet', provider: 'Telekom', firstDueDate: '2026-08-03', frequency: Frequency.MONTHLY, amountCents: 3999, payouts: [], payments: [] },
    { id: 3, name: 'Tontine A', provider: null, firstDueDate: '2026-08-05', frequency: Frequency.MONTHLY, amountCents: 10000, payouts: [{ date: '2027-03-05', amountCents: 120000, received: false }], payments: [] },
    { id: 4, name: 'Strom', provider: null, firstDueDate: '2026-08-01', frequency: Frequency.MONTHLY, amountCents: 6200, payouts: [], payments: [] },
  ];

  it('Sparkasse: Miete und Internet, Gehalt bleibt ohne Zuordnung', () => {
    const tx = parseBankCsv(Buffer.from(SPARKASSE, 'latin1')).transactions;
    const m = matchTransactions(tx, items);
    expect(m.map((x) => [x.transactionIndex, x.expenseId, x.targetDate, x.confidence])).toEqual([
      [0, 1, '2026-12-01', 'HIGH'],
      [1, 2, '2026-12-03', 'HIGH'],
    ]);
  });

  it('bereits bezahlte Fälligkeit wird nicht erneut vorgeschlagen', () => {
    const paid = items.map((i) => ({ ...i, payments: [...i.payments] }));
    paid[0].payments.push({ dueDate: '2026-12-01', status: 'PAID' });
    const tx = parseBankCsv(Buffer.from(SPARKASSE, 'latin1')).transactions;
    expect(matchTransactions(tx, paid).some((x) => x.expenseId === 1)).toBe(false);
  });

  it('abweichender Betrag nur mit Namenstreffer, dann MEDIUM', () => {
    const tx = [{ index: 0, date: '2026-12-01', amountCents: -88000, counterparty: 'Hausverwaltung Müller', reference: 'Miete' }];
    const [m] = matchTransactions(tx, items);
    expect(m.expenseId).toBe(1);
    expect(m.reasons).toContain('AMOUNT_DIFFERENT');
    expect(m.confidence).toBe('MEDIUM');
  });

  it('gleicher Betrag ohne Namen: keine Zuordnung zu Strom bei 62 € Fremdbuchung weit weg', () => {
    const tx = [{ index: 0, date: '2026-12-20', amountCents: -6200, counterparty: 'Irgendwer', reference: '' }];
    expect(matchTransactions(tx, items)).toHaveLength(0);
  });

  it('Auszahlung (Eingang) wird der Tontine zugeordnet', () => {
    const tx = [{ index: 0, date: '2027-03-06', amountCents: 120000, counterparty: 'Tontine Gruppe', reference: 'Auszahlung Tontine' }];
    const [m] = matchTransactions(tx, items);
    expect(m).toMatchObject({ type: 'PAYOUT', expenseId: 3, targetDate: '2027-03-05', confidence: 'HIGH' });
  });
});
