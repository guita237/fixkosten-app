import 'reflect-metadata';
import 'dotenv/config';
import { initDb } from './config/db';
import { createApp } from './app';
import { scheduleReminders } from './jobs/reminderJob';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.AUTH_MODE === 'dev') {
    console.warn('AUTH_MODE=dev wird in Produktion ignoriert – Firebase-Anmeldung ist aktiv.');
  }
  const orm = await initDb();
  const port = Number(process.env.PORT ?? 5000);
  scheduleReminders(orm);
  const server = createApp(orm).listen(port, () => {
    console.log(`Fixkosten-API läuft auf Port ${port}`);
  });

  // docker stop schickt SIGTERM: laufende Anfragen beenden, dann DB-Verbindung schließen
  const shutdown = (signal: string) => {
    console.log(`${signal} erhalten, fahre herunter …`);
    server.close(() => {
      orm.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Start fehlgeschlagen:', err);
  process.exit(1);
});
