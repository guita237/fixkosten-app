import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { Expense } from './Expense';

/** Neuer Betrag einer Ausgabe ab einem Datum (z. B. Mieterhöhung). */
@Entity({ tableName: 'price_changes' })
@Unique({ properties: ['expense', 'validFrom'] })
export class PriceChange {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @ManyToOne(() => Expense, { deleteRule: 'cascade' })
  expense!: Expense;

  @Property({ type: 'date' })
  validFrom!: string;

  @Property({ type: 'integer' })
  amountCents!: number;

  @Property({ type: 'text', nullable: true })
  note?: string | null;
}
