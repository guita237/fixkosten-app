import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @Property({ type: 'string' })
  @Unique()
  firebaseUid!: string;

  @Property({ type: 'string' })
  email!: string;

  @Property({ type: 'string', length: 3 })
  currency: string = 'EUR';

  // Monatliches Nettoeinkommen in Cent (optional) für "Verfügbar nach Fixkosten"
  @Property({ type: 'integer', nullable: true })
  monthlyNetIncomeCents?: number | null;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
