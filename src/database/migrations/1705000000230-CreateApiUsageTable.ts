import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateApiUsageTable1705000000230 implements MigrationInterface {
  name = 'CreateApiUsageTable1705000000230';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "pricing_tier_name_enum" AS ENUM ('free', 'starter', 'professional', 'enterprise')`);
    await queryRunner.query(`CREATE TYPE "billing_cycle_status_enum" AS ENUM ('active', 'closed', 'invoiced')`);

    await queryRunner.createTable(
      new Table({
        name: 'pricing_tiers',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'enum', enumName: 'pricing_tier_name_enum', isUnique: true },
          { name: 'monthly_flat_fee', type: 'decimal', precision: 10, scale: 2 },
          { name: 'included_requests', type: 'int' },
          { name: 'overage_rate', type: 'decimal', precision: 10, scale: 6 },
          { name: 'max_rpm', type: 'int' },
          { name: 'max_rpd', type: 'int' },
          { name: 'features', type: 'jsonb', default: "'[]'" },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'api_usage',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'api_key_id', type: 'varchar' },
          { name: 'user_id', type: 'varchar' },
          { name: 'endpoint', type: 'varchar', length: '255' },
          { name: 'method', type: 'varchar', length: '10' },
          { name: 'status_code', type: 'int' },
          { name: 'response_time_ms', type: 'int' },
          { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
          { name: 'user_agent', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'billing_cycles',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'varchar' },
          { name: 'api_key_id', type: 'varchar' },
          { name: 'pricing_tier_id', type: 'uuid' },
          { name: 'period_start', type: 'timestamp' },
          { name: 'period_end', type: 'timestamp' },
          { name: 'total_requests', type: 'int', default: 0 },
          { name: 'included_requests', type: 'int' },
          { name: 'overage_requests', type: 'int', default: 0 },
          { name: 'flat_fee', type: 'decimal', precision: 10, scale: 2 },
          { name: 'overage_cost', type: 'decimal', precision: 10, scale: 6, default: '0' },
          { name: 'total_cost', type: 'decimal', precision: 10, scale: 2, default: '0' },
          { name: 'status', type: 'enum', enumName: 'billing_cycle_status_enum', default: "'active'" },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.query(`CREATE INDEX "IDX_api_usage_api_key_id" ON "api_usage" ("api_key_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_api_usage_user_id" ON "api_usage" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_api_usage_created_at" ON "api_usage" ("api_key_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_billing_cycles_user_id" ON "billing_cycles" ("user_id", "period_start")`);
    await queryRunner.query(`CREATE INDEX "IDX_billing_cycles_api_key_id" ON "billing_cycles" ("api_key_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_billing_cycles_status" ON "billing_cycles" ("status")`);

    // Seed default pricing tiers
    await queryRunner.query(`
      INSERT INTO pricing_tiers (name, monthly_flat_fee, included_requests, overage_rate, max_rpm, max_rpd, features)
      VALUES
        ('free',         0,      1000,   0.000000, 10,  1000,  '["Basic API access"]'),
        ('starter',      29.00,  10000,  0.001000, 60,  10000, '["Basic API access","Email support"]'),
        ('professional', 99.00,  100000, 0.000500, 300, 100000,'["Full API access","Priority support","Webhooks"]'),
        ('enterprise',   499.00, 1000000,0.000100, 1000,1000000,'["Full API access","Dedicated support","SLA","Custom limits"]')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('billing_cycles');
    await queryRunner.dropTable('api_usage');
    await queryRunner.dropTable('pricing_tiers');
    await queryRunner.query(`DROP TYPE "billing_cycle_status_enum"`);
    await queryRunner.query(`DROP TYPE "pricing_tier_name_enum"`);
  }
}
