import { describe, expect, it } from 'vitest';
import { Frequency, NoticeUnit } from '../src/enums/Frequency';
import { contractStatus, dueDatesBetween, monthlyCostCents } from '../src/services/CostCalculator';
import { addMonths } from '../src/utils/dateOnly';

describe('monthlyCostCents', () => {
  it('lässt monatliche Beträge unverändert', () => {
    expect(monthlyCostCents(85000, Frequency.MONTHLY)).toBe(85000);
  });
  it('rechnet jährliche Beträge auf den Monat um', () => {
    expect(monthlyCostCents(60000, Frequency.YEARLY)).toBe(5000);
  });
  it('rechnet Quartalsbeträge um (Rundfunkbeitrag 55,08 €)', () => {
    expect(monthlyCostCents(5508, Frequency.QUARTERLY)).toBe(1836);
  });
  it('rundet auf ganze Cent', () => {
    expect(monthlyCostCents(1000, Frequency.YEARLY)).toBe(83);
  });
});

describe('addMonths', () => {
  it('begrenzt auf das Monatsende', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
  it('geht über Jahresgrenzen', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2027-02-15', -3)).toBe('2026-11-15');
  });
});

describe('dueDatesBetween', () => {
  it('liefert monatliche Fälligkeiten im Zeitraum', () => {
    expect(dueDatesBetween('2026-07-01', Frequency.MONTHLY, '2026-11-01', '2027-01-31')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
  });
  it('behält den Ankertag 31 nach einem kurzen Monat bei', () => {
    expect(dueDatesBetween('2026-01-31', Frequency.MONTHLY, '2026-02-01', '2026-04-30')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });
  it('liefert jährliche Fälligkeit nur im passenden Monat', () => {
    expect(dueDatesBetween('2025-03-01', Frequency.YEARLY, '2026-11-01', '2026-12-31')).toEqual([]);
    expect(dueDatesBetween('2025-03-01', Frequency.YEARLY, '2027-01-01', '2027-12-31')).toEqual(['2027-03-01']);
  });
  it('liefert nichts vor der ersten Fälligkeit', () => {
    expect(dueDatesBetween('2027-01-15', Frequency.MONTHLY, '2026-11-01', '2026-12-31')).toEqual([]);
  });
});

describe('contractStatus', () => {
  const base = { noticeValue: 3, noticeUnit: NoticeUnit.MONTHS, autoRenewMonths: 0, cancelled: false };

  it('berechnet die Kündigungsfrist vor dem Laufzeitende', () => {
    const s = contractStatus({ ...base, endDate: '2027-06-30' }, '2026-11-17');
    expect(s.termEnd).toBe('2027-06-30');
    expect(s.cancellationDeadline).toBe('2027-03-30');
    expect(s.daysUntilDeadline).toBe(133);
  });

  it('springt bei verpasster Frist in die nächste Verlängerung', () => {
    const s = contractStatus({ ...base, endDate: '2026-12-31', autoRenewMonths: 12 }, '2026-11-17');
    expect(s.termEnd).toBe('2027-12-31');
    expect(s.cancellationDeadline).toBe('2027-09-30');
  });

  it('rechnet Wochenfristen', () => {
    const s = contractStatus({ ...base, endDate: '2027-06-30', noticeValue: 4, noticeUnit: NoticeUnit.WEEKS }, '2027-05-01');
    expect(s.cancellationDeadline).toBe('2027-06-02');
  });

  it('liefert für unbefristete Verträge das frühestmögliche Ende', () => {
    const s = contractStatus({ ...base, endDate: null, noticeValue: 1 }, '2026-11-17');
    expect(s.cancellationDeadline).toBeNull();
    expect(s.earliestEndIfCancelledToday).toBe('2026-12-17');
  });

  it('meldet keine Frist für gekündigte Verträge', () => {
    const s = contractStatus({ ...base, endDate: '2027-06-30', cancelled: true }, '2026-11-17');
    expect(s.cancellationDeadline).toBeNull();
    expect(s.termEnd).toBe('2027-06-30');
  });
});
