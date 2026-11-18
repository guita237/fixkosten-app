// Fälligkeiten im Browser berechnen (gleiche Regeln wie backend/src/services/CostCalculator.ts)
import type { Frequency } from '../api/types';

export function monthsPerPeriod(f: Frequency): number {
  if (f === 'MONTHLY') {
    return 1;
  } else if (f === 'QUARTERLY') {
    return 3;
  } else if (f === 'HALF_YEARLY') {
    return 6;
  }
  return 12;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(value: string, months: number, anchorDay?: number): string {
  const [y, m, d] = value.split('-').map(Number);
  let day = d;
  if (anchorDay !== undefined) {
    day = anchorDay;
  }
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const clamped = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

/** Die nächsten `count` Fälligkeiten ab `from` (inklusive), begrenzt durch `endDate`. */
export function nextDueDates(firstDueDate: string, frequency: Frequency, from: string, count: number, endDate?: string | null): string[] {
  const step = monthsPerPeriod(frequency);
  const anchor = Number(firstDueDate.substring(8, 10));
  const result: string[] = [];
  for (let k = 0; k < 2400 && result.length < count; k++) {
    const due = addMonths(firstDueDate, k * step, anchor);
    if (endDate && due > endDate) {
      break;
    }
    if (due >= from) {
      result.push(due);
    }
  }
  return result;
}

export function monthlyCost(amountCents: number, frequency: Frequency): number {
  return Math.round(amountCents / monthsPerPeriod(frequency));
}
