import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../entities/User';
import { Expense } from '../entities/Expense';
import { amountAt, contractStatus, effectiveEndDate, monthlyCostCents } from './CostCalculator';
import { BalanceEntry, BalanceItem, entriesBetween, monthBalance, MonthBalance } from './BalanceCalculator';
import { addDays, addMonths, diffDays, formatDate, parseDate } from '../utils/dateOnly';

export interface CategoryTotal {
  categoryId: number | null;
  name: string;
  color: string;
  monthlyCents: number;
}

export interface MonthlySummary {
  totalMonthlyCents: number;
  activeCount: number;
  byCategory: CategoryTotal[];
  /** Monatliches Nettoeinkommen (null = nicht angegeben) */
  incomeCents: number | null;
  /** Einkommen minus Fixkosten (null ohne Einkommen) */
  remainingCents: number | null;
}

export interface MonthResult extends MonthBalance {
  incomeCents: number | null;
  /** Einkommen + Auszahlungen - Ausgaben dieses Monats (null ohne Einkommen) */
  availableCents: number | null;
}

export interface UpcomingPayment {
  type: 'EXPENSE' | 'PAYOUT';
  expenseId: number;
  name: string;
  dueDate: string;
  amountCents: number;
}

export interface UpcomingPayout {
  expenseId: number;
  name: string;
  date: string;
  amountCents: number;
  daysUntil: number;
}

export interface ContractDeadline {
  expenseId: number;
  name: string;
  termEnd: string | null;
  cancellationDeadline: string | null;
  daysUntilDeadline: number | null;
}

export class DashboardService {
  constructor(private readonly em: EntityManager, private readonly user: User) {}

  private activeExpenses(): Promise<Expense[]> {
    return this.em.find(Expense, { user: this.user, active: true }, { populate: ['category', 'contract', 'payouts', 'priceChanges'] });
  }

  private static toBalanceItem(e: Expense): BalanceItem {
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

  /** Laufende Fixkosten zum Stichtag (beendete Posten zählen nicht, Preisänderungen schon). */
  async monthlySummary(referenceDate: string): Promise<MonthlySummary> {
    const all = await this.activeExpenses();
    const expenses = all.filter((e) => {
      const end = effectiveEndDate(e.endDate, e.contract ?? null);
      return end === null || end >= referenceDate;
    });
    const groups = new Map<string, CategoryTotal>();
    let total = 0;

    for (const e of expenses) {
      const current = amountAt(e.amountCents, e.priceChanges.getItems(), referenceDate);
      const monthly = monthlyCostCents(current, e.frequency);
      total += monthly;

      let key = 'none';
      let entry: CategoryTotal = { categoryId: null, name: 'Ohne Kategorie', color: '#94a3b8', monthlyCents: 0 };
      if (e.category) {
        key = String(e.category.id);
        entry = { categoryId: e.category.id, name: e.category.name, color: e.category.color, monthlyCents: 0 };
      }
      const existing = groups.get(key);
      if (existing) {
        existing.monthlyCents += monthly;
      } else {
        entry.monthlyCents = monthly;
        groups.set(key, entry);
      }
    }

    const byCategory = [...groups.values()].sort((a, b) => b.monthlyCents - a.monthlyCents);
    const income = this.user.monthlyNetIncomeCents ?? null;
    let remaining: number | null = null;
    if (income !== null) {
      remaining = income - total;
    }
    return { totalMonthlyCents: total, activeCount: expenses.length, byCategory, incomeCents: income, remainingCents: remaining };
  }

  /** Fälligkeiten und Auszahlungen ab Monatsanfang von referenceDate für die nächsten `months` Monate. */
  async upcoming(referenceDate: string, months: number): Promise<UpcomingPayment[]> {
    const ref = parseDate(referenceDate);
    const from = formatDate({ year: ref.year, month: ref.month, day: 1 });
    const to = addDays(addMonths(from, months), -1);
    const items = (await this.activeExpenses()).map(DashboardService.toBalanceItem);
    return entriesBetween(items, from, to).map((e: BalanceEntry) => ({
      type: e.type,
      expenseId: e.expenseId,
      name: e.name,
      dueDate: e.date,
      amountCents: e.amountCents,
    }));
  }

  /** Bilanz eines Monats ('YYYY-MM'): Ausgaben, Auszahlungen, Saldo. */
  async month(month: string): Promise<MonthResult> {
    const items = (await this.activeExpenses()).map(DashboardService.toBalanceItem);
    const balance = monthBalance(items, month);
    const income = this.user.monthlyNetIncomeCents ?? null;
    let available: number | null = null;
    if (income !== null) {
      available = income + balance.netCents;
    }
    return { ...balance, incomeCents: income, availableCents: available };
  }

  /** Noch nicht erhaltene Auszahlungen ab referenceDate. */
  async upcomingPayouts(referenceDate: string): Promise<UpcomingPayout[]> {
    const expenses = await this.activeExpenses();
    const result: UpcomingPayout[] = [];
    for (const e of expenses) {
      for (const p of e.payouts.getItems()) {
        if (!p.received && p.date >= referenceDate) {
          result.push({ expenseId: e.id, name: e.name, date: p.date, amountCents: p.amountCents, daysUntil: diffDays(referenceDate, p.date) });
        }
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Verträge mit Kündigungsfrist, sortiert nach Dringlichkeit. */
  async contractDeadlines(referenceDate: string): Promise<ContractDeadline[]> {
    const expenses = await this.activeExpenses();
    const result: ContractDeadline[] = [];

    for (const e of expenses) {
      if (!e.contract) {
        continue;
      }
      const status = contractStatus(e.contract, referenceDate);
      result.push({
        expenseId: e.id,
        name: e.name,
        termEnd: status.termEnd,
        cancellationDeadline: status.cancellationDeadline,
        daysUntilDeadline: status.daysUntilDeadline,
      });
    }

    return result.sort((a, b) => {
      if (a.cancellationDeadline === null && b.cancellationDeadline === null) {
        return 0;
      } else if (a.cancellationDeadline === null) {
        return 1;
      } else if (b.cancellationDeadline === null) {
        return -1;
      } else {
        return a.cancellationDeadline.localeCompare(b.cancellationDeadline);
      }
    });
  }
}
