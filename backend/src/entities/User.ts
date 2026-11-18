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

  // Sprache der App und der E-Mails: de | fr | en
  @Property({ type: 'string', length: 2 })
  language: string = 'de';

  // Erinnerungen per E-Mail
  @Property({ type: 'boolean' })
  remindersEnabled: boolean = false;

  // Abweichende Empfängeradresse; null = Login-E-Mail
  @Property({ type: 'string', nullable: true })
  reminderEmail?: string | null;

  // Vorlauf in Tagen für Kündigungsfristen und Auszahlungen
  @Property({ type: 'integer' })
  reminderDaysBefore: number = 7;

  // Auch an nicht als bezahlt markierte Fälligkeiten erinnern (nur sinnvoll mit Zahlungsverfolgung)
  @Property({ type: 'boolean' })
  reminderOverdue: boolean = false;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
