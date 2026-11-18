import { MikroORM } from '@mikro-orm/postgresql';
import config from './mikro-orm.config';

let orm: MikroORM | undefined;

export async function initDb(): Promise<MikroORM> {
  orm = await MikroORM.init(config);
  // Migrationen beim Start automatisch anwenden (wie bei TimeStamp)
  await orm.getMigrator().up();
  return orm;
}

export function getOrm(): MikroORM {
  if (!orm) {
    throw new Error('Datenbank ist noch nicht initialisiert');
  }
  return orm;
}
