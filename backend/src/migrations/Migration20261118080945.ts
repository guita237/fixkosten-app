import { Migration } from '@mikro-orm/migrations';

export class Migration20261118080945 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "price_changes" ("id" serial primary key, "expense_id" int not null, "valid_from" date not null, "amount_cents" int not null, "note" text null);`);
    this.addSql(`alter table "price_changes" add constraint "price_changes_expense_id_valid_from_unique" unique ("expense_id", "valid_from");`);

    this.addSql(`alter table "price_changes" add constraint "price_changes_expense_id_foreign" foreign key ("expense_id") references "expenses" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "users" add column "monthly_net_income_cents" int null;`);

    this.addSql(`alter table "expenses" add column "end_date" date null;`);

    this.addSql(`alter table "contracts" add column "cancelled_on" date null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "price_changes" cascade;`);

    this.addSql(`alter table "users" drop column "monthly_net_income_cents";`);

    this.addSql(`alter table "expenses" drop column "end_date";`);

    this.addSql(`alter table "contracts" drop column "cancelled_on";`);
  }

}
