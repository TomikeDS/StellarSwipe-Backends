import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateInvoicesTable1705000000231 implements MigrationInterface {
  name = 'CreateInvoicesTable1705000000231';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "invoice_status_enum" AS ENUM ('draft', 'issued', 'paid', 'overdue', 'void')`);

    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'varchar' },
          { name: 'billing_cycle_id', type: 'uuid' },
          { name: 'invoice_number', type: 'varchar', isUnique: true },
          { name: 'amount_due', type: 'decimal', precision: 10, scale: 2 },
          { name: 'amount_paid', type: 'decimal', precision: 10, scale: 2, default: '0' },
          { name: 'status', type: 'enum', enumName: 'invoice_status_enum', default: "'draft'" },
          { name: 'due_date', type: 'timestamp' },
          { name: 'paid_at', type: 'timestamp', isNullable: true },
          { name: 'line_items', type: 'jsonb', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.query(`CREATE INDEX "IDX_invoices_user_id" ON "invoices" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_status" ON "invoices" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_billing_cycle_id" ON "invoices" ("billing_cycle_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('invoices');
    await queryRunner.query(`DROP TYPE "invoice_status_enum"`);
  }
}
