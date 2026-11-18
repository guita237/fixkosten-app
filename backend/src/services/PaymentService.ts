import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../entities/User';
import { Expense } from '../entities/Expense';
import { Payment, PaymentSource, PaymentStatus } from '../entities/Payment';
import { dueDatesBetween, effectiveEndDate } from './CostCalculator';
import { summarize, trackDues, TrackedDue, TrackingSummary } from './PaymentTracker';
import { toTrackableItem } from './mappers';
import { NotFoundError, ValidationError } from './ExpenseService';
import { addDays, addMonths } from '../utils/dateOnly';
import { PaymentInputDto } from '../validation/schemas';

export interface PaymentMonth {
  month: string;
  items: TrackedDue[];
  summary: TrackingSummary;
}

export class PaymentService {
  constructor(private readonly em: EntityManager, private readonly user: User) {}

  private async loadExpenses(): Promise<Expense[]> {
    return this.em.find(Expense, { user: this.user, active: true }, { populate: ['contract', 'payouts', 'priceChanges', 'payments'] });
  }

  async month(month: string, referenceDate: string): Promise<PaymentMonth> {
    const from = `${month}-01`;
    const to = addDays(addMonths(from, 1), -1);
    const items = (await this.loadExpenses()).map(toTrackableItem);
    const dues = trackDues(items, from, to, referenceDate);
    return { month, items: dues, summary: summarize(dues) };
  }

  /** Offene Fälligkeiten der letzten 6 Monate, die über der Toleranz liegen. */
  async overdue(referenceDate: string): Promise<TrackedDue[]> {
    const items = (await this.loadExpenses()).map(toTrackableItem);
    return trackDues(items, addMonths(referenceDate, -6), referenceDate, referenceDate).filter((d) => d.status === 'OVERDUE');
  }

  async record(expenseId: number, dueDate: string, input: PaymentInputDto, source: PaymentSource = PaymentSource.MANUAL, bankReference: string | null = null): Promise<Payment> {
    const expense = await this.em.findOne(Expense, { id: expenseId, user: this.user }, { populate: ['contract', 'payments'] });
    if (!expense) {
      throw new NotFoundError(`Ausgabe ${expenseId} nicht gefunden`);
    }
    this.assertIsDueDate(expense, dueDate);

    let payment = expense.payments.getItems().find((p) => p.dueDate === dueDate);
    if (!payment) {
      payment = this.em.create(Payment, { expense, dueDate, status: input.status, source });
      expense.payments.add(payment);
    }
    payment.status = input.status;
    payment.source = source;
    payment.bankReference = bankReference;
    payment.note = input.note ?? null;
    if (input.status === PaymentStatus.PAID) {
      payment.paidDate = input.paidDate ?? dueDate;
      payment.amountCents = input.amountCents ?? null;
    } else {
      payment.paidDate = null;
      payment.amountCents = null;
    }
    await this.em.flush();
    return payment;
  }

  async clear(expenseId: number, dueDate: string): Promise<void> {
    const payment = await this.em.findOne(Payment, { expense: { id: expenseId, user: this.user }, dueDate });
    if (!payment) {
      throw new NotFoundError('Keine erfasste Zahlung zu dieser Fälligkeit');
    }
    await this.em.removeAndFlush(payment);
  }

  private assertIsDueDate(expense: Expense, dueDate: string): void {
    const end = effectiveEndDate(expense.endDate, expense.contract ?? null);
    let isDue = dueDatesBetween(expense.firstDueDate, expense.frequency, dueDate, dueDate).length === 1;
    if (end !== null && dueDate > end) {
      isDue = false;
    }
    if (!isDue) {
      throw new ValidationError(`${dueDate} ist keine Fälligkeit von „${expense.name}“`);
    }
  }
}
