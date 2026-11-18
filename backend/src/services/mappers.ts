import { Expense } from '../entities/Expense';
import { effectiveEndDate } from './CostCalculator';
import { BalanceItem } from './BalanceCalculator';
import { TrackableItem } from './PaymentTracker';

/** Entity -> reine Datenstruktur für die Berechnungen (Collections müssen geladen sein). */
export function toBalanceItem(e: Expense): BalanceItem {
  return {
    id: e.id,
    name: e.name,
    firstDueDate: e.firstDueDate,
    frequency: e.frequency,
    amountCents: e.amountCents,
    payouts: e.payouts.getItems().map((p) => ({ date: p.date, amountCents: p.amountCents, received: p.received })),
    priceChanges: e.priceChanges.getItems().map((c) => ({ validFrom: c.validFrom, amountCents: c.amountCents })),
    endDate: effectiveEndDate(e.endDate, e.contract ?? null),
  };
}

export function toTrackableItem(e: Expense): TrackableItem {
  return {
    ...toBalanceItem(e),
    payments: e.payments.getItems().map((p) => ({
      dueDate: p.dueDate,
      status: p.status,
      paidDate: p.paidDate ?? null,
      amountCents: p.amountCents ?? null,
      source: p.source,
    })),
  };
}
