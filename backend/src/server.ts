import 'reflect-metadata';
import 'dotenv/config';
import { initDb } from './config/db';
import { createApp } from './app';

async function main(): Promise<void> {
  const orm = await initDb();
  const port = Number(process.env.PORT ?? 5000);
  createApp(orm).listen(port, () => {
    console.log(`Fixkosten-API läuft auf Port ${port}`);
  });
}

main().catch((err) => {
  console.error('Start fehlgeschlagen:', err);
  process.exit(1);
});
