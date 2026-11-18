// Reine Logik: erwartete Fälligkeiten mit erfassten Zahlungen abgleichen.
import { BalanceItem, entriesBetween } from './BalanceCalculator';
import { addDays } from '../utils/dateOnly';

/** Tage Toleranz, bevor eine offene Fälligkeit als überfällig gilt (Lastschriften kommen oft später). */
export const OVERDUE_GRACE_DAYS = 3;

export type TrackedStatus = 'OPEN' | 'OVERDUE' | 'PAID' | 'SKIPPED';

export interface RecordedPayment {
  dueDate: string;
  status: 'PAID' | 'SKIPPED';
  paidDate?: string | null;
  amountCents?: number | null;
  source?: string;
}

export interface TrackableItem extends BalanceItem {
  payments: RecordedPayment[];
}

export interface TrackedDue {
  expenseId: number;
  name: string;
  dueDate: string;
  expectedCents: number;
  status: TrackedStatus;
  paidDate: string | null;
  paidCents: number | null;
  /** paidCents - expectedCents, wenn bezahlt (z. B. höhere Abbuchung) */
  differenceCents: number | null;
  source: string | null;
}

export interface TrackingSummary {
  expectedCents: number;
  paidCents: number;
  openCents: number;
  overdueCount: number;
}

export function trackDues(items: TrackableItem[], from: string, to: string, referenceDate: string): TrackedDue[] {
  const byId = new Map<number, TrackableItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }

  const result: TrackedDue[] = [];
  for (const entry of entriesBetween(items, from, to)) {
    if (entry.type !== 'EXPENSE') {
      continue;
    }
    const item = byId.get(entry.expenseId);
    let recorded: RecordedPayment | undefined = undefined;
    if (item) {
      recorded = item.payments.find((p) => p.dueDate === entry.date);
    }

    let status: TrackedStatus = 'OPEN';
    let paidDate: string | null = null;
    let paidCents: number | null = null;
    let difference: number | null = null;
    let source: string | null = null;

    if (recorded) {
      status = recorded.status;
      source = recorded.source ?? null;
      if (recorded.status === 'PAID') {
        paidDate = recorded.paidDate ?? null;
        paidCents = recorded.amountCents ?? entry.amountCents;
        difference = paidCents - entry.amountCents;
      }
    } else if (addDays(entry.date, OVERDUE_GRACE_DAYS) < referenceDate) {
      status = 'OVERDUE';
    }

    result.push({
      expenseId: entry.expenseId,
      name: entry.name,
      dueDate: entry.date,
      expectedCents: entry.amountCents,
      status,
      paidDate,
      paidCents,
      differenceCents: difference,
      source,
    });
  }
  return result;
}

export function summarize(dues: TrackedDue[]): TrackingSummary {
  let expected = 0;
  let paid = 0;
  let open = 0;
  let overdue = 0;
  for (const d of dues) {
    if (d.status === 'SKIPPED') {
      continue;
    }
    expected += d.expectedCents;
    if (d.status === 'PAID') {
      paid += d.paidCents ?? d.expectedCents;
    } else {
      open += d.expectedCents;
      if (d.status === 'OVERDUE') {
        overdue++;
      }
    }
  }
  return { expectedCents: expected, paidCents: paid, openCents: open, overdueCount: overdue };
}
