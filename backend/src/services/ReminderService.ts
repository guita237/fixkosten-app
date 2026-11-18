import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../entities/User';
import { ReminderLog } from '../entities/ReminderLog';
import { DashboardService } from './DashboardService';
import { PaymentService } from './PaymentService';
import { buildDigest, buildTestMail, Language, planReminders, Reminder, withoutAlreadySent } from './ReminderPlanner';
import { Mailer } from './Mailer';
import { ValidationError } from './ExpenseService';

export interface ReminderRun {
  to: string | null;
  sent: boolean;
  reminders: Reminder[];
  mailerConfigured: boolean;
}

export class ReminderService {
  constructor(private readonly em: EntityManager, private readonly user: User, private readonly mailer: Mailer) {}

  private recipient(): string | null {
    const to = this.user.reminderEmail ?? this.user.email;
    if (!to) {
      return null;
    }
    return to;
  }

  private language(): Language {
    return this.user.language as Language;
  }

  /** Alle heute fälligen Erinnerungen, die noch nicht verschickt wurden. */
  async pending(today: string): Promise<Reminder[]> {
    const dashboard = new DashboardService(this.em, this.user);
    const payments = new PaymentService(this.em, this.user);
    let overdue: Awaited<ReturnType<PaymentService['overdue']>> = [];
    if (this.user.reminderOverdue) {
      overdue = await payments.overdue(today);
    }
    const planned = planReminders(
      {
        deadlines: await dashboard.contractDeadlines(today),
        payouts: await dashboard.upcomingPayouts(today),
        overdue,
      },
      today,
      this.user.reminderDaysBefore,
    );
    const logs = await this.em.find(ReminderLog, { user: this.user });
    return withoutAlreadySent(planned, new Set(logs.map((l) => l.key)));
  }

  /** Sammelmail mit allen neuen Erinnerungen; danach als gesendet markieren. */
  async run(today: string): Promise<ReminderRun> {
    const reminders = await this.pending(today);
    const to = this.recipient();
    if (reminders.length === 0 || !to) {
      return { to, sent: false, reminders, mailerConfigured: this.mailer.configured };
    }
    const mail = buildDigest(reminders, this.language(), this.user.currency);
    await this.mailer.send(to, mail.subject, mail.text);
    for (const r of reminders) {
      this.em.create(ReminderLog, { user: this.user, key: r.key, sentAt: new Date() });
    }
    await this.em.flush();
    return { to, sent: true, reminders, mailerConfigured: this.mailer.configured };
  }

  async sendTest(): Promise<{ to: string; mailerConfigured: boolean }> {
    const to = this.recipient();
    if (!to) {
      throw new ValidationError('Keine E-Mail-Adresse hinterlegt');
    }
    const mail = buildTestMail(this.language());
    await this.mailer.send(to, mail.subject, mail.text);
    return { to, mailerConfigured: this.mailer.configured };
  }
}
