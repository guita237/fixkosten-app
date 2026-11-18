import { describe, expect, it } from 'vitest';
import { Frequency } from '../src/enums/Frequency';
import { summarize, trackDues, TrackableItem } from '../src/services/PaymentTracker';

const miete: TrackableItem = {
  id: 1,
  name: 'Miete',
  firstDueDate: '2026-08-01',
  frequency: Frequency.MONTHLY,
  amountCents: 85000,
  payouts: [],
  payments: [
    { dueDate: '2026-10-01', status: 'PAID', paidDate: '2026-10-02', amountCents: 85000 },
    { dueDate: '2026-11-01', status: 'PAID', paidDate: '2026-11-03', amountCents: 86000 },
  ],
};

const tontine: TrackableItem = {
  id: 2,
  name: 'Tontine A',
  firstDueDate: '2026-08-05',
  frequency: Frequency.MONTHLY,
  amountCents: 10000,
  payouts: [],
  payments: [{ dueDate: '2026-12-05', status: 'SKIPPED' }],
};

describe('trackDues', () => {
  it('bezahlt mit Abweichung', () => {
    const [d] = trackDues([miete], '2026-11-01', '2026-11-30', '2026-11-18');
    expect(d.status).toBe('PAID');
    expect(d.paidDate).toBe('2026-11-03');
    expect(d.differenceCents).toBe(1000);
  });

  it('offen innerhalb der Toleranz, überfällig danach', () => {
    expect(trackDues([tontine], '2026-11-01', '2026-11-30', '2026-11-07')[0].status).toBe('OPEN');
    expect(trackDues([tontine], '2026-11-01', '2026-11-30', '2026-11-09')[0].status).toBe('OVERDUE');
  });

  it('zukünftige Fälligkeit bleibt offen', () => {
    expect(trackDues([miete], '2026-12-01', '2026-12-31', '2026-11-18')[0].status).toBe('OPEN');
  });

  it('ausgesetzt zählt nicht in die Summe', () => {
    const dues = trackDues([miete, tontine], '2026-12-01', '2026-12-31', '2026-12-20');
    expect(dues.find((d) => d.expenseId === 2)?.status).toBe('SKIPPED');
    const s = summarize(dues);
    expect(s.expectedCents).toBe(85000);
    expect(s.openCents).toBe(85000);
    expect(s.overdueCount).toBe(1);
  });

  it('Summe nutzt den tatsächlich gezahlten Betrag', () => {
    const s = summarize(trackDues([miete], '2026-10-01', '2026-11-30', '2026-11-18'));
    expect(s.paidCents).toBe(171000);
    expect(s.openCents).toBe(0);
  });
});
