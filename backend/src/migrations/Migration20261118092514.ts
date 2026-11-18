import { Migration } from '@mikro-orm/migrations';

export class Migration20261118092514 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "reminder_logs" ("id" serial primary key, "user_id" int not null, "key" varchar(120) not null, "sent_at" timestamptz not null);`);
    this.addSql(`alter table "reminder_logs" add constraint "reminder_logs_user_id_key_unique" unique ("user_id", "key");`);
    this.addSql(`create table "payments" ("id" serial primary key, "expense_id" int not null, "due_date" date not null, "status" text check ("status" in ('PAID', 'SKIPPED')) not null default 'PAID', "paid_date" date null, "amount_cents" int null, "source" text check ("source" in ('MANUAL', 'CSV')) not null default 'MANUAL', "bank_reference" text null, "note" text null);`);
    this.addSql(`alter table "payments" add constraint "payments_expense_id_due_date_unique" unique ("expense_id", "due_date");`);
    this.addSql(`alter table "reminder_logs" add constraint "reminder_logs_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "payments" add constraint "payments_expense_id_foreign" foreign key ("expense_id") references "expenses" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "users" add column "language" varchar(2) not null default 'de', add column "reminders_enabled" boolean not null default false, add column "reminder_email" varchar(255) null, add column "reminder_days_before" int not null default 7;`);
    this.addSql(`alter table "contracts" add column "consumer_contract" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "reminder_logs" cascade;`);
    this.addSql(`drop table if exists "payments" cascade;`);
    this.addSql(`alter table "users" drop column "language", drop column "reminders_enabled", drop column "reminder_email", drop column "reminder_days_before";`);
    this.addSql(`alter table "contracts" drop column "consumer_contract";`);
  }

}
