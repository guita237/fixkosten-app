import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Expense } from './Expense';

/**
 * Einmalige Auszahlung zu einer Ausgabe, z. B. der Topf einer Tontine
 * in dem Monat, in dem man an der Reihe ist.
 */
@Entity({ tableName: 'payouts' })
export class Payout {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @ManyToOne(() => Expense, { deleteRule: 'cascade' })
  expense!: Expense;

  // Geplantes Auszahlungsdatum 'YYYY-MM-DD'
  @Property({ type: 'date' })
  date!: string;

  @Property({ type: 'integer' })
  amountCents!: number;

  @Property({ type: 'boolean' })
  received: boolean = false;

  @Property({ type: 'text', nullable: true })
  note?: string | null;
}
