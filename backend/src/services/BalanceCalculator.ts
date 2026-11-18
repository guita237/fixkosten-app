// Reine Logik: Monatsbilanz aus Ausgaben (wiederkehrend) und Auszahlungen (einmalig).
import { Frequency } from '../enums/Frequency';
import { amountAt, dueDatesBetween, PriceChange } from './CostCalculator';
import { addDays, addMonths } from '../utils/dateOnly';

export interface BalanceItem {
  id: number;
  name: string;
  firstDueDate: string;
  frequency: Frequency;
  amountCents: number; // Grundbetrag ab erster Fälligkeit
  payouts: { date: string; amountCents: number; received: boolean }[];
  priceChanges?: PriceChange[];
  /** Letzter möglicher Fälligkeitstag (inklusive), null = unbegrenzt */
  endDate?: string | null;
}

export type EntryType = 'EXPENSE' | 'PAYOUT';

export interface BalanceEntry {
  type: EntryType;
  expenseId: number;
  name: string;
  date: string;
  amountCents: number; // immer positiv; das Vorzeichen ergibt sich aus type
  received?: boolean;
}

export interface MonthBalance {
  month: string; // 'YYYY-MM'
  outgoingCents: number;
  incomingCents: number;
  netCents: number; // incoming - outgoing
  entries: BalanceEntry[];
}

/** Alle Buchungen (Ausgaben und Auszahlungen) zwischen from und to, nach Datum sortiert. */
export function entriesBetween(items: BalanceItem[], from: string, to: string): BalanceEntry[] {
  const entries: BalanceEntry[] = [];
  for (const item of items) {
    let until = to;
    if (item.endDate && item.endDate < until) {
      until = item.endDate;
    }
    if (until >= from) {
      for (const date of dueDatesBetween(item.firstDueDate, item.frequency, from, until)) {
        const amount = amountAt(item.amountCents, item.priceChanges ?? [], date);
        entries.push({ type: 'EXPENSE', expenseId: item.id, name: item.name, date, amountCents: amount });
      }
    }
    for (const p of item.payouts) {
      if (p.date >= from && p.date <= to) {
        entries.push({ type: 'PAYOUT', expenseId: item.id, name: item.name, date: p.date, amountCents: p.amountCents, received: p.received });
      }
    }
  }
  return entries.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    } else if (a.type !== b.type) {
      // Bei gleichem Datum Auszahlungen zuerst
      if (a.type === 'PAYOUT') {
        return -1;
      } else {
        return 1;
      }
    } else {
      return a.name.localeCompare(b.name);
    }
  });
}

export function monthBalance(items: BalanceItem[], month: string): MonthBalance {
  const from = `${month}-01`;
  const to = addDays(addMonths(from, 1), -1);
  const entries = entriesBetween(items, from, to);

  let outgoing = 0;
  let incoming = 0;
  for (const e of entries) {
    if (e.type === 'PAYOUT') {
      incoming += e.amountCents;
    } else {
      outgoing += e.amountCents;
    }
  }
  return { month, outgoingCents: outgoing, incomingCents: incoming, netCents: incoming - outgoing, entries };
}
