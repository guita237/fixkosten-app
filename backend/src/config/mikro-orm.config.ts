import 'reflect-metadata';
import 'dotenv/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { User } from '../entities/User';
import { Category } from '../entities/Category';
import { Expense } from '../entities/Expense';
import { Contract } from '../entities/Contract';
import { Payout } from '../entities/Payout';
import { PriceChange } from '../entities/PriceChange';
import { Payment } from '../entities/Payment';
import { ReminderLog } from '../entities/ReminderLog';

export default defineConfig({
  entities: [User, Category, Expense, Contract, Payout, PriceChange, Payment, ReminderLog],
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'fixkosten',
  password: process.env.DB_PASSWORD ?? 'fixkosten',
  dbName: process.env.DB_NAME ?? 'fixkosten',
  extensions: [Migrator],
  migrations: {
    path: 'dist/migrations',
    pathTs: 'src/migrations',
    transactional: true,
  },
  debug: process.env.NODE_ENV === 'development',
});
