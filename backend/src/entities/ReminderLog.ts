import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { User } from './User';

/** Bereits versendete Erinnerungen (verhindert Doppelversand). */
@Entity({ tableName: 'reminder_logs' })
@Unique({ properties: ['user', 'key'] })
export class ReminderLog {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @ManyToOne(() => User, { deleteRule: 'cascade' })
  user!: User;

  @Property({ type: 'string', length: 120 })
  key!: string;

  @Property({ type: 'Date' })
  sentAt: Date = new Date();
}
