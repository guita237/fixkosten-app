import { Migration } from '@mikro-orm/migrations';

export class Migration20261117093552 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "users" ("id" serial primary key, "firebase_uid" varchar(255) not null, "email" varchar(255) not null, "currency" varchar(3) not null default 'EUR', "created_at" timestamptz not null);`);
    this.addSql(`alter table "users" add constraint "users_firebase_uid_unique" unique ("firebase_uid");`);

    this.addSql(`create table "categories" ("id" serial primary key, "user_id" int not null, "name" varchar(255) not null, "color" varchar(7) not null default '#64748b');`);
    this.addSql(`alter table "categories" add constraint "categories_user_id_name_unique" unique ("user_id", "name");`);

    this.addSql(`create table "expenses" ("id" serial primary key, "user_id" int not null, "category_id" int null, "name" varchar(255) not null, "provider" varchar(255) null, "amount_cents" int not null, "frequency" text check ("frequency" in ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY')) not null default 'MONTHLY', "first_due_date" date not null, "payment_method" varchar(255) null, "active" boolean not null default true, "note" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);

    this.addSql(`create table "contracts" ("id" serial primary key, "expense_id" int not null, "start_date" date not null, "end_date" date null, "notice_value" int not null default 1, "notice_unit" text check ("notice_unit" in ('DAYS', 'WEEKS', 'MONTHS')) not null default 'MONTHS', "auto_renew_months" int not null default 0, "cancelled" boolean not null default false);`);
    this.addSql(`alter table "contracts" add constraint "contracts_expense_id_unique" unique ("expense_id");`);

    this.addSql(`alter table "categories" add constraint "categories_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "expenses" add constraint "expenses_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "expenses" add constraint "expenses_category_id_foreign" foreign key ("category_id") references "categories" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "contracts" add constraint "contracts_expense_id_foreign" foreign key ("expense_id") references "expenses" ("id") on update cascade on delete cascade;`);
  }

}
