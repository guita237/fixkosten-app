import { Migration } from '@mikro-orm/migrations';

export class Migration20261118092723 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "users" add column "reminder_overdue" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "users" drop column "reminder_overdue";`);
  }

}
