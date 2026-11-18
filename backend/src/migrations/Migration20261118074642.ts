import { Migration } from '@mikro-orm/migrations';

export class Migration20261118074642 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "payouts" ("id" serial primary key, "expense_id" int not null, "date" date not null, "amount_cents" int not null, "received" boolean not null default false, "note" text null);`);

    this.addSql(`alter table "payouts" add constraint "payouts_expense_id_foreign" foreign key ("expense_id") references "expenses" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payouts" cascade;`);
  }

}
