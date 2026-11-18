import { Entity, Enum, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { Expense } from './Expense';

export enum PaymentStatus {
  PAID = 'PAID',
  SKIPPED = 'SKIPPED', // fällt diesen Monat aus (z. B. Mietfreiheit, Tontine pausiert)
}

export enum PaymentSource {
  MANUAL = 'MANUAL',
  CSV = 'CSV',
}

/** Tatsächlich erfasste Zahlung zu einer Fälligkeit. Fehlt der Eintrag, gilt die Fälligkeit als offen. */
@Entity({ tableName: 'payments' })
@Unique({ properties: ['expense', 'dueDate'] })
export class Payment {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @ManyToOne(() => Expense, { deleteRule: 'cascade' })
  expense!: Expense;

  // Fälligkeit, zu der die Zahlung gehört
  @Property({ type: 'date' })
  dueDate!: string;

  @Enum({ items: () => PaymentStatus })
  status: PaymentStatus = PaymentStatus.PAID;

  // Tatsächliches Zahlungsdatum (Buchungstag)
  @Property({ type: 'date', nullable: true })
  paidDate?: string | null;

  // Tatsächlich gezahlter Betrag; null = erwarteter Betrag
  @Property({ type: 'integer', nullable: true })
  amountCents?: number | null;

  @Enum({ items: () => PaymentSource })
  source: PaymentSource = PaymentSource.MANUAL;

  // Bei CSV-Import: Verwendungszweck / Referenz der Buchung
  @Property({ type: 'text', nullable: true })
  bankReference?: string | null;

  @Property({ type: 'text', nullable: true })
  note?: string | null;
}
