import { Collection, Entity, Enum, ManyToOne, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { User } from './User';
import { Category } from './Category';
import { Contract } from './Contract';
import { Payout } from './Payout';
import { PriceChange } from './PriceChange';
import { Payment } from './Payment';
import { Frequency } from '../enums/Frequency';

@Entity({ tableName: 'expenses' })
export class Expense {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @ManyToOne(() => User, { deleteRule: 'cascade' })
  user!: User;

  @ManyToOne(() => Category, { nullable: true, deleteRule: 'set null' })
  category?: Category | null;

  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'string', nullable: true })
  provider?: string | null;

  // Beträge immer in Cent (Integer), nie als Float
  @Property({ type: 'integer' })
  amountCents!: number;

  @Enum({ items: () => Frequency })
  frequency: Frequency = Frequency.MONTHLY;

  // Erste Fälligkeit als reines Datum 'YYYY-MM-DD'
  @Property({ type: 'date' })
  firstDueDate!: string;

  // Letzte mögliche Fälligkeit (inklusive), z. B. Ende einer Tontine-Runde; null = unbegrenzt
  @Property({ type: 'date', nullable: true })
  endDate?: string | null;

  @Property({ type: 'string', nullable: true })
  paymentMethod?: string | null;

  @Property({ type: 'boolean' })
  active: boolean = true;

  @Property({ type: 'text', nullable: true })
  note?: string | null;

  @OneToOne(() => Contract, (contract) => contract.expense, { nullable: true })
  contract?: Contract | null;

  // Auszahlungen (z. B. Tontine-Topf), sortiert nach Datum
  @OneToMany(() => Payout, (payout) => payout.expense, { orderBy: { date: 'asc' } })
  payouts = new Collection<Payout>(this);

  // Betragsänderungen ab einem Datum; amountCents ist der Grundbetrag ab firstDueDate
  @OneToMany(() => PriceChange, (change) => change.expense, { orderBy: { validFrom: 'asc' } })
  priceChanges = new Collection<PriceChange>(this);

  // Erfasste Zahlungen je Fälligkeit (bezahlt / ausgesetzt)
  @OneToMany(() => Payment, (payment) => payment.expense, { orderBy: { dueDate: 'asc' } })
  payments = new Collection<Payment>(this);

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
