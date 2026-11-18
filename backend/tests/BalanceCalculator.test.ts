import { describe, expect, it } from 'vitest';
import { Frequency } from '../src/enums/Frequency';
import { BalanceItem, entriesBetween, monthBalance } from '../src/services/BalanceCalculator';

const tontineA: BalanceItem = {
  id: 1,
  name: 'Tontine A',
  firstDueDate: '2026-08-05',
  frequency: Frequency.MONTHLY,
  amountCents: 10000,
  payouts: [{ date: '2027-03-05', amountCents: 120000, received: false }],
};

const miete: BalanceItem = {
  id: 2,
  name: 'Miete',
  firstDueDate: '2026-08-01',
  frequency: Frequency.MONTHLY,
  amountCents: 85000,
  payouts: [],
};

describe('monthBalance', () => {
  it('normaler Monat: nur Ausgaben, Saldo negativ', () => {
    const b = monthBalance([tontineA, miete], '2026-12');
    expect(b.outgoingCents).toBe(95000);
    expect(b.incomingCents).toBe(0);
    expect(b.netCents).toBe(-95000);
    expect(b.entries).toHaveLength(2);
  });

  it('Auszahlungsmonat: Topf wird gegengerechnet', () => {
    const b = monthBalance([tontineA, miete], '2027-03');
    expect(b.outgoingCents).toBe(95000);
    expect(b.incomingCents).toBe(120000);
    expect(b.netCents).toBe(25000);
  });

  it('listet die Auszahlung vor der Zahlung am selben Tag', () => {
    const b = monthBalance([tontineA], '2027-03');
    expect(b.entries.map((e) => e.type)).toEqual(['PAYOUT', 'EXPENSE']);
  });

  it('funktioniert im Februar und am Jahresende', () => {
    expect(monthBalance([miete], '2027-02').entries.map((e) => e.date)).toEqual(['2027-02-01']);
    expect(monthBalance([miete], '2026-12').entries.map((e) => e.date)).toEqual(['2026-12-01']);
  });
});

describe('entriesBetween', () => {
  it('ignoriert Auszahlungen außerhalb des Zeitraums', () => {
    const entries = entriesBetween([tontineA], '2026-11-01', '2027-01-31');
    expect(entries.every((e) => e.type === 'EXPENSE')).toBe(true);
    expect(entries).toHaveLength(3);
  });
});
