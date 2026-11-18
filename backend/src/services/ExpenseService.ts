import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../entities/User';
import { Category } from '../entities/Category';
import { Expense } from '../entities/Expense';
import { Contract } from '../entities/Contract';
import { Payout } from '../entities/Payout';
import { PriceChange } from '../entities/PriceChange';
import { ContractInputDto, ExpenseInput, PayoutInputDto, PriceChangeInputDto } from '../validation/schemas';
import { amountAt, effectiveEndDate, monthlyCostCents } from './CostCalculator';
import { today } from '../utils/dateOnly';

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export interface ExpenseDto {
  id: number;
  name: string;
  provider: string | null;
  category: { id: number; name: string; color: string } | null;
  amountCents: number; // Grundbetrag ab firstDueDate
  currentAmountCents: number; // heute gültiger Betrag (nach Preisänderungen)
  monthlyCostCents: number; // aus currentAmountCents
  frequency: string;
  firstDueDate: string;
  endDate: string | null;
  effectiveEndDate: string | null; // inkl. gekündigtem Vertrag
  ended: boolean;
  paymentMethod: string | null;
  active: boolean;
  note: string | null;
  contract: ContractInputDto | null;
  payouts: (PayoutInputDto & { id: number })[];
  priceChanges: (PriceChangeInputDto & { id: number })[];
}

export function toExpenseDto(e: Expense, referenceDate: string = today()): ExpenseDto {
  let category: ExpenseDto['category'] = null;
  if (e.category) {
    category = { id: e.category.id, name: e.category.name, color: e.category.color };
  }
  let contract: ContractInputDto | null = null;
  if (e.contract) {
    contract = {
      startDate: e.contract.startDate,
      endDate: e.contract.endDate ?? null,
      noticeValue: e.contract.noticeValue,
      noticeUnit: e.contract.noticeUnit,
      autoRenewMonths: e.contract.autoRenewMonths,
      cancelled: e.contract.cancelled,
      cancelledOn: e.contract.cancelledOn ?? null,
      consumerContract: e.contract.consumerContract,
    };
  }
  const priceChanges = e.priceChanges.getItems().map((c) => ({
    id: c.id,
    validFrom: c.validFrom,
    amountCents: c.amountCents,
    note: c.note ?? null,
  }));
  const currentAmount = amountAt(e.amountCents, priceChanges, referenceDate);
  const endEffective = effectiveEndDate(e.endDate, e.contract ?? null);
  let ended = false;
  if (endEffective !== null && endEffective < referenceDate) {
    ended = true;
  }
  return {
    id: e.id,
    name: e.name,
    provider: e.provider ?? null,
    category,
    amountCents: e.amountCents,
    currentAmountCents: currentAmount,
    monthlyCostCents: monthlyCostCents(currentAmount, e.frequency),
    frequency: e.frequency,
    firstDueDate: e.firstDueDate,
    endDate: e.endDate ?? null,
    effectiveEndDate: endEffective,
    ended,
    paymentMethod: e.paymentMethod ?? null,
    active: e.active,
    note: e.note ?? null,
    contract,
    payouts: e.payouts.getItems().map((p) => ({
      id: p.id,
      date: p.date,
      amountCents: p.amountCents,
      received: p.received,
      note: p.note ?? null,
    })),
    priceChanges,
  };
}

export class ExpenseService {
  constructor(private readonly em: EntityManager, private readonly user: User) {}

  async list(categoryId?: number): Promise<Expense[]> {
    const where: Record<string, unknown> = { user: this.user };
    if (categoryId !== undefined) {
      where.category = categoryId;
    }
    return this.em.find(Expense, where, { populate: ['category', 'contract', 'payouts', 'priceChanges'], orderBy: { name: 'asc' } });
  }

  async get(id: number): Promise<Expense> {
    const expense = await this.em.findOne(Expense, { id, user: this.user }, { populate: ['category', 'contract', 'payouts', 'priceChanges'] });
    if (!expense) {
      throw new NotFoundError(`Ausgabe ${id} nicht gefunden`);
    }
    return expense;
  }

  async create(input: ExpenseInput): Promise<Expense> {
    const expense = this.em.create(Expense, {
      user: this.user,
      name: input.name,
      provider: input.provider ?? null,
      category: await this.resolveCategory(input.categoryId),
      amountCents: input.amountCents,
      frequency: input.frequency,
      firstDueDate: input.firstDueDate,
      endDate: input.endDate ?? null,
      paymentMethod: input.paymentMethod ?? null,
      active: input.active,
      note: input.note ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.applyContract(expense, input.contract);
    this.applyPayouts(expense, input.payouts);
    await this.em.flush();
    return this.get(expense.id);
  }

  async update(id: number, input: ExpenseInput): Promise<Expense> {
    const expense = await this.get(id);
    expense.name = input.name;
    expense.provider = input.provider ?? null;
    expense.category = await this.resolveCategory(input.categoryId);
    expense.amountCents = input.amountCents;
    expense.frequency = input.frequency;
    expense.firstDueDate = input.firstDueDate;
    expense.endDate = input.endDate ?? null;
    expense.paymentMethod = input.paymentMethod ?? null;
    expense.active = input.active;
    expense.note = input.note ?? null;
    this.applyContract(expense, input.contract);
    this.applyPayouts(expense, input.payouts);
    await this.em.flush();
    return this.get(id);
  }

  async remove(id: number): Promise<void> {
    const expense = await this.get(id);
    if (expense.contract) {
      this.em.remove(expense.contract);
    }
    this.em.remove(expense);
    await this.em.flush();
  }

  async addPriceChange(id: number, input: PriceChangeInputDto): Promise<Expense> {
    const expense = await this.get(id);
    if (input.validFrom <= expense.firstDueDate) {
      throw new ValidationError('validFrom muss nach der ersten Fälligkeit liegen (sonst Grundbetrag ändern)');
    }
    // Gleiches Datum: vorhandene Änderung überschreiben
    const existing = expense.priceChanges.getItems().find((c) => c.validFrom === input.validFrom);
    if (existing) {
      existing.amountCents = input.amountCents;
      existing.note = input.note ?? null;
    } else {
      const change = this.em.create(PriceChange, { expense, validFrom: input.validFrom, amountCents: input.amountCents, note: input.note ?? null });
      expense.priceChanges.add(change);
    }
    await this.em.flush();
    return this.get(id);
  }

  async removePriceChange(id: number, changeId: number): Promise<Expense> {
    const expense = await this.get(id);
    const change = expense.priceChanges.getItems().find((c) => c.id === changeId);
    if (!change) {
      throw new NotFoundError(`Preisänderung ${changeId} nicht gefunden`);
    }
    expense.priceChanges.remove(change);
    this.em.remove(change);
    await this.em.flush();
    return this.get(id);
  }

  private applyPayouts(expense: Expense, input?: PayoutInputDto[]): void {
    if (input === undefined) {
      return; // Feld nicht mitgeschickt: Auszahlungen unverändert lassen
    }
    for (const existing of expense.payouts.getItems()) {
      this.em.remove(existing);
    }
    expense.payouts.removeAll();
    for (const p of input) {
      const payout = this.em.create(Payout, {
        expense,
        date: p.date,
        amountCents: p.amountCents,
        received: p.received,
        note: p.note ?? null,
      });
      expense.payouts.add(payout);
    }
  }

  private async resolveCategory(categoryId?: number | null): Promise<Category | null> {
    if (categoryId === undefined || categoryId === null) {
      return null;
    }
    const category = await this.em.findOne(Category, { id: categoryId, user: this.user });
    if (!category) {
      throw new NotFoundError(`Kategorie ${categoryId} nicht gefunden`);
    }
    return category;
  }

  private applyContract(expense: Expense, input?: ContractInputDto | null): void {
    if (input === undefined) {
      return; // Feld nicht mitgeschickt: Vertrag unverändert lassen
    }
    if (input === null) {
      if (expense.contract) {
        this.em.remove(expense.contract);
        expense.contract = null;
      }
      return;
    }
    let contract = expense.contract;
    if (!contract) {
      contract = this.em.create(Contract, { expense, startDate: input.startDate, noticeValue: input.noticeValue, noticeUnit: input.noticeUnit, autoRenewMonths: input.autoRenewMonths, cancelled: input.cancelled, consumerContract: input.consumerContract });
      expense.contract = contract;
    }
    contract.startDate = input.startDate;
    contract.endDate = input.endDate ?? null;
    contract.noticeValue = input.noticeValue;
    contract.noticeUnit = input.noticeUnit;
    contract.autoRenewMonths = input.autoRenewMonths;
    contract.cancelled = input.cancelled;
    contract.cancelledOn = input.cancelledOn ?? null;
    contract.consumerContract = input.consumerContract;
  }
}
