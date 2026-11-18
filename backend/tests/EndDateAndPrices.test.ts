import { describe, expect, it } from 'vitest';
import { Frequency, NoticeUnit } from '../src/enums/Frequency';
import { amountAt, contractStatus, effectiveEndDate } from '../src/services/CostCalculator';
import { BalanceItem, entriesBetween, monthBalance } from '../src/services/BalanceCalculator';

const kfzContract = {
  endDate: '2026-12-31',
  noticeValue: 1,
  noticeUnit: NoticeUnit.MONTHS,
  autoRenewMonths: 12,
  cancelled: false,
};

describe('contractStatus mit cancelledOn', () => {
  it('rechtzeitig gekündigt: endet zum ersten Laufzeitende', () => {
    const s = contractStatus({ ...kfzContract, cancelled: true, cancelledOn: '2026-11-20' }, '2026-11-25');
    expect(s.termEnd).toBe('2026-12-31');
  });

  it('zu spät gekündigt: endet erst nach der Verlängerung', () => {
    const s = contractStatus({ ...kfzContract, cancelled: true, cancelledOn: '2026-12-10' }, '2026-12-15');
    expect(s.termEnd).toBe('2027-12-31');
  });
});

describe('effectiveEndDate', () => {
  it('ohne Ende und ohne Kündigung: unbegrenzt', () => {
    expect(effectiveEndDate(null, kfzContract)).toBeNull();
  });
  it('nimmt das Laufzeitende eines gekündigten Vertrags', () => {
    expect(effectiveEndDate(null, { ...kfzContract, cancelled: true, cancelledOn: '2026-11-20' })).toBe('2026-12-31');
  });
  it('nimmt das frühere von Enddatum und Vertragsende', () => {
    expect(effectiveEndDate('2026-10-31', { ...kfzContract, cancelled: true, cancelledOn: '2026-11-20' })).toBe('2026-10-31');
    expect(effectiveEndDate('2027-06-30', { ...kfzContract, cancelled: true, cancelledOn: '2026-11-20' })).toBe('2026-12-31');
  });
});

describe('amountAt', () => {
  const changes = [
    { validFrom: '2027-01-01', amountCents: 88000 },
    { validFrom: '2028-01-01', amountCents: 90000 },
  ];
  it('Grundbetrag vor der ersten Änderung', () => {
    expect(amountAt(85000, changes, '2026-12-01')).toBe(85000);
  });
  it('gilt ab dem Stichtag (inklusive)', () => {
    expect(amountAt(85000, changes, '2027-01-01')).toBe(88000);
    expect(amountAt(85000, changes, '2027-06-01')).toBe(88000);
    expect(amountAt(85000, changes, '2028-03-01')).toBe(90000);
  });
  it('Reihenfolge der Änderungen egal', () => {
    expect(amountAt(85000, [...changes].reverse(), '2027-06-01')).toBe(88000);
  });
});

describe('Bilanz mit Ende und Preisänderungen', () => {
  const miete: BalanceItem = {
    id: 1,
    name: 'Miete',
    firstDueDate: '2026-08-01',
    frequency: Frequency.MONTHLY,
    amountCents: 85000,
    payouts: [],
    priceChanges: [{ validFrom: '2027-01-01', amountCents: 88000 }],
  };

  it('alte Monate behalten den alten Betrag, neue den neuen', () => {
    const amounts = entriesBetween([miete], '2026-11-01', '2027-02-28').map((e) => e.amountCents);
    expect(amounts).toEqual([85000, 85000, 88000, 88000]);
  });

  it('keine Fälligkeiten nach dem Enddatum', () => {
    const tontine: BalanceItem = {
      id: 2,
      name: 'Tontine A',
      firstDueDate: '2026-08-05',
      frequency: Frequency.MONTHLY,
      amountCents: 10000,
      payouts: [],
      endDate: '2027-07-31',
    };
    expect(monthBalance([tontine], '2027-07').outgoingCents).toBe(10000);
    expect(monthBalance([tontine], '2027-08').outgoingCents).toBe(0);
  });

  it('gekündigte Kfz-Versicherung: keine Jahreszahlung im Januar', () => {
    const kfz: BalanceItem = {
      id: 3,
      name: 'Kfz',
      firstDueDate: '2026-01-01',
      frequency: Frequency.YEARLY,
      amountCents: 60000,
      payouts: [],
      endDate: effectiveEndDate(null, { ...kfzContract, cancelled: true, cancelledOn: '2026-11-20' }),
    };
    expect(monthBalance([kfz], '2027-01').outgoingCents).toBe(0);
  });
});

describe('Verbrauchervertrag (§ 309 Nr. 9 BGB)', () => {
  const internet = {
    endDate: '2028-07-31',
    noticeValue: 1,
    noticeUnit: NoticeUnit.MONTHS,
    autoRenewMonths: 12,
    cancelled: false,
    consumerContract: true,
  };

  it('in der Erstlaufzeit: normale Frist', () => {
    const s = contractStatus(internet, '2027-01-01');
    expect(s.termEnd).toBe('2028-07-31');
    expect(s.cancellationDeadline).toBe('2028-06-30');
  });

  it('nach der Frist: keine 12-Monats-Verlängerung, monatlich kündbar', () => {
    const s = contractStatus(internet, '2028-09-10');
    expect(s.termEnd).toBeNull();
    expect(s.cancellationDeadline).toBeNull();
    expect(s.earliestEndIfCancelledToday).toBe('2028-10-10');
  });

  it('Frist knapp verpasst: Ende frühestens Laufzeitende', () => {
    expect(contractStatus(internet, '2028-07-05').earliestEndIfCancelledToday).toBe('2028-08-05');
  });

  it('spät gekündigt: Ende einen Monat nach Kündigung', () => {
    const s = contractStatus({ ...internet, cancelled: true, cancelledOn: '2028-09-10' }, '2028-09-15');
    expect(s.termEnd).toBe('2028-10-10');
    expect(effectiveEndDate(null, { ...internet, cancelled: true, cancelledOn: '2028-09-10' })).toBe('2028-10-10');
  });

  it('rechtzeitig gekündigt: Ende der Erstlaufzeit', () => {
    expect(effectiveEndDate(null, { ...internet, cancelled: true, cancelledOn: '2028-06-01' })).toBe('2028-07-31');
  });
});
