import cron from 'node-cron';
import { MikroORM } from '@mikro-orm/postgresql';
import { User } from '../entities/User';
import { ReminderService } from '../services/ReminderService';
import { getMailer } from '../services/Mailer';
import { today } from '../utils/dateOnly';

/** Läuft für alle Benutzer mit aktivierten Erinnerungen. Ein Fehler bei einem Benutzer stoppt nicht die anderen. */
export async function runRemindersForAll(orm: MikroORM, date: string = today()): Promise<number> {
  const em = orm.em.fork();
  const users = await em.find(User, { remindersEnabled: true });
  let sent = 0;
  for (const user of users) {
    try {
      const result = await new ReminderService(em.fork(), user, getMailer()).run(date);
      if (result.sent) {
        sent++;
      }
    } catch (err) {
      console.error(`[reminders] Fehler bei Benutzer ${user.id}:`, err);
    }
  }
  console.log(`[reminders] ${date}: ${sent} E-Mail(s) an ${users.length} Benutzer mit Erinnerungen`);
  return sent;
}

/** Täglich (Standard 07:00 Europe/Berlin). REMINDERS_CRON=off deaktiviert den Job. */
export function scheduleReminders(orm: MikroORM): void {
  const expression = process.env.REMINDERS_CRON ?? '0 7 * * *';
  if (expression === 'off') {
    console.log('[reminders] Cron deaktiviert');
    return;
  }
  cron.schedule(expression, () => {
    runRemindersForAll(orm).catch((err) => console.error('[reminders] Lauf fehlgeschlagen:', err));
  }, { timezone: process.env.TZ ?? 'Europe/Berlin' });
  console.log(`[reminders] Cron geplant: "${expression}"`);
}
