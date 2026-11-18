import { Entity, Enum, OneToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Expense } from './Expense';
import { NoticeUnit } from '../enums/Frequency';

@Entity({ tableName: 'contracts' })
export class Contract {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @OneToOne(() => Expense, { owner: true, deleteRule: 'cascade' })
  expense!: Expense;

  @Property({ type: 'date' })
  startDate!: string;

  // Ende der aktuellen (ersten) Laufzeit; null = unbefristet, jederzeit kündbar mit Frist
  @Property({ type: 'date', nullable: true })
  endDate?: string | null;

  // Kündigungsfrist, z. B. 3 MONTHS oder 4 WEEKS
  @Property({ type: 'integer' })
  noticeValue: number = 1;

  @Enum({ items: () => NoticeUnit })
  noticeUnit: NoticeUnit = NoticeUnit.MONTHS;

  // Automatische Verlängerung in Monaten (0 = keine)
  @Property({ type: 'integer' })
  autoRenewMonths: number = 0;

  @Property({ type: 'boolean' })
  cancelled: boolean = false;

  // Verbrauchervertrag: nach Erstlaufzeit monatlich kündbar (§ 309 Nr. 9 BGB)
  @Property({ type: 'boolean' })
  consumerContract: boolean = false;

  // Datum der Kündigung; bestimmt, welche Laufzeitperiode endet
  @Property({ type: 'date', nullable: true })
  cancelledOn?: string | null;
}
