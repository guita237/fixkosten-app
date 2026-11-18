// Reine Berechnungslogik ohne Datenbank – vollständig unit-testbar.
import { Frequency, NoticeUnit } from '../enums/Frequency';
import { addDays, addMonths, diffDays, monthsBetween, parseDate } from '../utils/dateOnly';

export function monthsPerPeriod(frequency: Frequency): number {
  if (frequency === Frequency.MONTHLY) {
    return 1;
  } else if (frequency === Frequency.QUARTERLY) {
    return 3;
  } else if (frequency === Frequency.HALF_YEARLY) {
    return 6;
  } else {
    return 12;
  }
}

/** Auf einen Monat umgerechnete Kosten in Cent (z. B. 600 €/Jahr -> 50 €/Monat). */
export function monthlyCostCents(amountCents: number, frequency: Frequency): number {
  return Math.round(amountCents / monthsPerPeriod(frequency));
}

/** Alle Fälligkeiten zwischen from und to (beide inklusive). */
export function dueDatesBetween(firstDueDate: string, frequency: Frequency, from: string, to: string): string[] {
  const step = monthsPerPeriod(frequency);
  const anchorDay = parseDate(firstDueDate).day;
  const result: string[] = [];

  // Direkt in die Nähe von "from" springen, statt ab der ersten Fälligkeit zu iterieren
  let k = Math.floor(monthsBetween(firstDueDate, from) / step) - 1;
  if (k < 0) {
    k = 0;
  }

  for (;;) {
    const due = addMonths(firstDueDate, k * step, anchorDay);
    if (due > to) {
      break;
    }
    if (due >= from) {
      result.push(due);
    }
    k++;
  }
  return result;
}

export interface ContractInput {
  endDate?: string | null;
  noticeValue: number;
  noticeUnit: NoticeUnit;
  autoRenewMonths: number;
  cancelled: boolean;
  /** Datum, an dem gekündigt wurde; bestimmt, welche Laufzeitperiode endet */
  cancelledOn?: string | null;
}

export interface ContractStatus {
  /** Ende der aktuell laufenden Vertragsperiode (null = unbefristet) */
  termEnd: string | null;
  /** Letzter Tag, an dem die Kündigung eingehen muss (null = gekündigt oder unbefristet) */
  cancellationDeadline: string | null;
  /** Tage bis zur Kündigungsfrist (negativ = verpasst) */
  daysUntilDeadline: number | null;
  /** Bei unbefristeten Verträgen: frühestmögliches Ende bei Kündigung heute */
  earliestEndIfCancelledToday: string | null;
}

export function subtractNotice(date: string, value: number, unit: NoticeUnit): string {
  if (unit === NoticeUnit.DAYS) {
    return addDays(date, -value);
  } else if (unit === NoticeUnit.WEEKS) {
    return addDays(date, -7 * value);
  } else {
    return addMonths(date, -value);
  }
}

export function addNotice(date: string, value: number, unit: NoticeUnit): string {
  if (unit === NoticeUnit.DAYS) {
    return addDays(date, value);
  } else if (unit === NoticeUnit.WEEKS) {
    return addDays(date, 7 * value);
  } else {
    return addMonths(date, value);
  }
}

/**
 * Berechnet die aktuelle Laufzeit und die Kündigungsfrist eines Vertrags zum Stichtag.
 * Wurde die Frist einer Periode verpasst und verlängert sich der Vertrag automatisch,
 * zählt die nächste Periode.
 */
export function contractStatus(contract: ContractInput, referenceDate: string): ContractStatus {
  if (!contract.endDate) {
    return {
      termEnd: null,
      cancellationDeadline: null,
      daysUntilDeadline: null,
      earliestEndIfCancelledToday: addNotice(referenceDate, contract.noticeValue, contract.noticeUnit),
    };
  }

  let termEnd = contract.endDate;
  let deadline = subtractNotice(termEnd, contract.noticeValue, contract.noticeUnit);

  // Bis zu welchem Stichtag laufen Verlängerungen? Ungekündigt: heute.
  // Gekündigt: das Kündigungsdatum (ohne Datum bleibt die erste Laufzeit).
  let renewUntil: string | null = referenceDate;
  if (contract.cancelled) {
    renewUntil = contract.cancelledOn ?? null;
  }
  if (renewUntil !== null && contract.autoRenewMonths > 0) {
    while (deadline < renewUntil) {
      termEnd = addMonths(termEnd, contract.autoRenewMonths);
      deadline = subtractNotice(termEnd, contract.noticeValue, contract.noticeUnit);
    }
  }

  if (contract.cancelled) {
    return { termEnd, cancellationDeadline: null, daysUntilDeadline: null, earliestEndIfCancelledToday: null };
  }

  return {
    termEnd,
    cancellationDeadline: deadline,
    daysUntilDeadline: diffDays(referenceDate, deadline),
    earliestEndIfCancelledToday: null,
  };
}

/**
 * Letzter Tag, an dem eine Ausgabe noch fällig sein kann (inklusive), oder null = unbegrenzt.
 * Kleinster Wert aus dem Enddatum der Ausgabe und – bei gekündigtem Vertrag – dem Laufzeitende.
 */
export function effectiveEndDate(expenseEndDate: string | null | undefined, contract: ContractInput | null | undefined): string | null {
  let end: string | null = expenseEndDate ?? null;
  if (contract && contract.cancelled && contract.endDate) {
    const termEnd = contractStatus(contract, contract.endDate).termEnd;
    if (termEnd !== null) {
      if (end === null || termEnd < end) {
        end = termEnd;
      }
    }
  }
  return end;
}

export interface PriceChange {
  validFrom: string;
  amountCents: number;
}

/** Betrag, der an einem Datum gilt: letzte Preisänderung mit validFrom <= date, sonst der Grundbetrag. */
export function amountAt(baseAmountCents: number, changes: PriceChange[], date: string): number {
  let amount = baseAmountCents;
  let latest = '';
  for (const c of changes) {
    if (c.validFrom <= date && c.validFrom >= latest) {
      latest = c.validFrom;
      amount = c.amountCents;
    }
  }
  return amount;
}
