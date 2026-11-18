// Reine Logik: Bankbuchungen den erwarteten Fälligkeiten und Auszahlungen zuordnen.
import { BankTransaction } from './CsvReader';
import { amountAt, dueDatesBetween } from '../services/CostCalculator';
import { TrackableItem } from '../services/PaymentTracker';
import { addDays, diffDays } from '../utils/dateOnly';

export const DATE_WINDOW_DAYS = 10;
const MIN_SCORE = 60;

export interface MatchSuggestion {
  transactionIndex: number;
  type: 'EXPENSE' | 'PAYOUT';
  expenseId: number;
  name: string;
  /** Fälligkeit (EXPENSE) bzw. geplantes Auszahlungsdatum (PAYOUT) */
  targetDate: string;
  expectedCents: number;
  bookedCents: number;
  bookingDate: string;
  score: number;
  confidence: 'HIGH' | 'MEDIUM';
  reasons: string[];
}

export interface MatchableItem extends TrackableItem {
  provider?: string | null;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function tokens(s: string): string[] {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Wie viele Namens-/Anbieter-Wörter kommen im Buchungstext vor? */
function textScore(item: MatchableItem, tx: BankTransaction): number {
  const haystack = normalizeText(`${tx.counterparty} ${tx.reference}`);
  const words = tokens(`${item.name} ${item.provider ?? ''}`);
  let hits = 0;
  for (const w of words) {
    if (haystack.includes(w)) {
      hits++;
    }
  }
  if (hits >= 2) {
    return 30;
  } else if (hits === 1) {
    return 20;
  }
  return 0;
}

function amountScore(expected: number, booked: number): number {
  const diff = Math.abs(expected - booked);
  if (diff === 0) {
    return 50;
  } else if (diff <= Math.max(100, Math.round(expected * 0.02))) {
    return 30; // bis 2 % oder 1 € Abweichung
  }
  return 0;
}

function dateScore(days: number): number {
  const d = Math.abs(days);
  if (d <= 3) {
    return 20;
  } else if (d <= 7) {
    return 10;
  }
  return 5;
}

function confidence(score: number): 'HIGH' | 'MEDIUM' {
  if (score >= 80) {
    return 'HIGH';
  }
  return 'MEDIUM';
}

/**
 * Für jede Buchung den besten Kandidaten finden; jede Fälligkeit/Auszahlung wird höchstens
 * einmal vergeben (beste Punktzahl zuerst). Bereits bezahlte Fälligkeiten und erhaltene
 * Auszahlungen werden übersprungen.
 */
export function matchTransactions(transactions: BankTransaction[], items: MatchableItem[]): MatchSuggestion[] {
  const candidates: MatchSuggestion[] = [];

  for (const tx of transactions) {
    const from = addDays(tx.date, -DATE_WINDOW_DAYS);
    const to = addDays(tx.date, DATE_WINDOW_DAYS);

    for (const item of items) {
      if (tx.amountCents < 0) {
        const booked = -tx.amountCents;
        let until = to;
        if (item.endDate && item.endDate < until) {
          until = item.endDate;
        }
        if (until < from) {
          continue;
        }
        for (const due of dueDatesBetween(item.firstDueDate, item.frequency, from, until)) {
          if (item.payments.some((p) => p.dueDate === due)) {
            continue;
          }
          const expected = amountAt(item.amountCents, item.priceChanges ?? [], due);
          const a = amountScore(expected, booked);
          const t = textScore(item, tx);
          if (a === 0 && t < 30) {
            continue; // falscher Betrag nur bei klarem Namenstreffer vorschlagen
          }
          const days = diffDays(due, tx.date);
          const score = a + t + dateScore(days);
          // Abweichender Betrag (z. B. nicht erfasste Erhöhung): nur bei klarem Namen und nahem Datum
          let accepted = score >= MIN_SCORE;
          if (a === 0) {
            accepted = t >= 30 && Math.abs(days) <= 3;
          }
          if (!accepted) {
            continue;
          }
          const reasons: string[] = [];
          if (a === 50) {
            reasons.push('AMOUNT_EXACT');
          } else if (a === 30) {
            reasons.push('AMOUNT_CLOSE');
          } else {
            reasons.push('AMOUNT_DIFFERENT');
          }
          if (t > 0) {
            reasons.push('NAME');
          }
          reasons.push(`DAYS_${Math.abs(days)}`);
          candidates.push({
            transactionIndex: tx.index,
            type: 'EXPENSE',
            expenseId: item.id,
            name: item.name,
            targetDate: due,
            expectedCents: expected,
            bookedCents: booked,
            bookingDate: tx.date,
            score,
            confidence: confidence(score),
            reasons,
          });
        }
      } else {
        for (const p of item.payouts) {
          if (p.received || p.date < from || p.date > to) {
            continue;
          }
          const a = amountScore(p.amountCents, tx.amountCents);
          if (a === 0) {
            continue;
          }
          const days = diffDays(p.date, tx.date);
          const score = a + textScore(item, tx) + dateScore(days);
          if (score < MIN_SCORE) {
            continue;
          }
          let amountReason = 'AMOUNT_CLOSE';
          if (a === 50) {
            amountReason = 'AMOUNT_EXACT';
          }
          candidates.push({
            transactionIndex: tx.index,
            type: 'PAYOUT',
            expenseId: item.id,
            name: item.name,
            targetDate: p.date,
            expectedCents: p.amountCents,
            bookedCents: tx.amountCents,
            bookingDate: tx.date,
            score,
            confidence: confidence(score),
            reasons: [amountReason, `DAYS_${Math.abs(days)}`],
          });
        }
      }
    }
  }

  // Greedy: höchste Punktzahl zuerst, jede Buchung und jedes Ziel nur einmal
  candidates.sort((x, y) => y.score - x.score);
  const usedTx = new Set<number>();
  const usedTarget = new Set<string>();
  const result: MatchSuggestion[] = [];
  for (const c of candidates) {
    const targetKey = `${c.type}:${c.expenseId}:${c.targetDate}`;
    if (usedTx.has(c.transactionIndex) || usedTarget.has(targetKey)) {
      continue;
    }
    usedTx.add(c.transactionIndex);
    usedTarget.add(targetKey);
    result.push(c);
  }
  return result.sort((x, y) => x.transactionIndex - y.transactionIndex);
}
