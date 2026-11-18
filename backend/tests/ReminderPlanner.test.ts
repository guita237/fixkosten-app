import { describe, expect, it } from 'vitest';
import { buildDigest, planReminders, withoutAlreadySent } from '../src/services/ReminderPlanner';

const input = {
  deadlines: [
    { expenseId: 1, name: 'Kfz-Versicherung', cancellationDeadline: '2026-11-30', termEnd: '2026-12-31' },
    { expenseId: 2, name: 'Internet', cancellationDeadline: '2028-06-30', termEnd: '2028-07-31' },
    { expenseId: 3, name: 'Gekündigt', cancellationDeadline: null, termEnd: '2026-12-31' },
  ],
  payouts: [{ expenseId: 4, name: 'Tontine A', date: '2027-03-05', amountCents: 120000 }],
  overdue: [{ expenseId: 5, name: 'Miete', dueDate: '2026-11-15', expectedCents: 85000 }],
};

describe('planReminders', () => {
  it('Frist im Vorlauf: "early", überfällige Zahlung immer', () => {
    const r = planReminders(input, '2026-11-25', 7);
    expect(r.map((x) => x.key)).toEqual(['overdue:5:2026-11-15', 'deadline:1:2026-11-30:early']);
  });

  it('alte Überfällige (> 14 Tage) werden nicht mehr gemeldet', () => {
    const old = { ...input, overdue: [{ expenseId: 5, name: 'Miete', dueDate: '2026-10-01', expectedCents: 85000 }] };
    expect(planReminders(old, '2026-11-25', 7).some((x) => x.kind === 'OVERDUE')).toBe(false);
  });

  it('Frist zu weit weg: nichts', () => {
    const r = planReminders({ ...input, overdue: [] }, '2026-11-01', 7);
    expect(r).toHaveLength(0);
  });

  it('letzter Tag: zweite Erinnerung "last"', () => {
    const r = planReminders({ ...input, overdue: [] }, '2026-11-29', 7);
    expect(r[0].key).toBe('deadline:1:2026-11-30:last');
    expect(r[0].daysUntil).toBe(1);
  });

  it('verpasster Cron-Lauf wird nachgeholt (Fenster statt exakter Tag)', () => {
    const r = planReminders({ ...input, overdue: [] }, '2026-11-27', 7);
    expect(r.map((x) => x.key)).toEqual(['deadline:1:2026-11-30:early']);
  });

  it('Auszahlung im Vorlauf', () => {
    const r = planReminders({ ...input, overdue: [] }, '2027-03-01', 7);
    expect(r.map((x) => x.kind)).toEqual(['PAYOUT']);
  });

  it('bereits gesendete werden herausgefiltert', () => {
    const r = planReminders(input, '2026-11-25', 7);
    expect(withoutAlreadySent(r, new Set(['overdue:5:2026-11-15']))).toHaveLength(1);
  });
});

describe('buildDigest', () => {
  const r = planReminders(input, '2026-11-25', 7);

  it('deutsch', () => {
    const m = buildDigest(r, 'de');
    expect(m.subject).toBe('Fixkosten: 2 Erinnerungen');
    expect(m.text).toContain('Kündigungsfrist „Kfz-Versicherung“: bis 30.11.2026 (in 5 Tagen)');
    expect(m.text).toContain('850,00');
  });

  it('französisch', () => {
    const m = buildDigest(r, 'fr');
    expect(m.subject).toBe('Fixkosten : 2 rappels');
    expect(m.text).toContain('Préavis « Kfz-Versicherung » : jusqu’au 30/11/2026 (dans 5 jours)');
  });

  it('Einzahl', () => {
    expect(buildDigest(r.slice(0, 1), 'en').subject).toBe('Fixkosten: 1 reminder');
  });
});
