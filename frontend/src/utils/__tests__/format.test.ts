import { describe, expect, it } from 'vitest';
import { centsToInput, money, parseMoneyInput, shiftMonth } from '../format';
import { monthlyCost, nextDueDates } from '../schedule';

describe('parseMoneyInput', () => {
  it('versteht deutsche und englische Schreibweise', () => {
    expect(parseMoneyInput('850')).toBe(85000);
    expect(parseMoneyInput('850,5')).toBe(85050);
    expect(parseMoneyInput('1.234,56')).toBe(123456);
    expect(parseMoneyInput('1,234.56')).toBe(123456);
    expect(parseMoneyInput('3.000,00 €')).toBe(300000);
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
  });

  it('Rundreise mit centsToInput', () => {
    expect(parseMoneyInput(centsToInput(123456, 'de'))).toBe(123456);
    expect(parseMoneyInput(centsToInput(123456, 'fr'))).toBe(123456);
    expect(parseMoneyInput(centsToInput(123456, 'en'))).toBe(123456);
  });
});

describe('Anzeige', () => {
  it('Euro je Sprache', () => {
    expect(money(123456, 'de').replace(/\s/g, ' ')).toBe('1.234,56 €');
    expect(money(123456, 'en')).toBe('€1,234.56');
  });
  it('Monate verschieben', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });
});

describe('Fälligkeiten (wie Backend)', () => {
  it('Monatsende bleibt erhalten', () => {
    expect(nextDueDates('2026-01-31', 'MONTHLY', '2026-02-01', 3)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('Enddatum begrenzt', () => {
    expect(nextDueDates('2026-08-05', 'MONTHLY', '2027-06-01', 5, '2027-07-31')).toEqual(['2027-06-05', '2027-07-05']);
  });
  it('Monatskosten', () => {
    expect(monthlyCost(60000, 'YEARLY')).toBe(5000);
    expect(monthlyCost(5508, 'QUARTERLY')).toBe(1836);
  });
});
