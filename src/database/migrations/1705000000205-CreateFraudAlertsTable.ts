import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFraudAlertsTable1705000000205 implements MigrationInterface {
  name = 'CreateFraudAlertsTable1705000000205';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // FraudAlert enums
    await queryRunner.query(`
      CREATE TYPE "sec_fraud_alert_status_enum" AS ENUM (
        'OPEN',
        'UNDER_REVIEW',
        'CONFIRMED',
        'DISMISSED',
        'FALSE_POSITIVE',
        'ESCALATED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "sec_fraud_alert_action_enum" AS ENUM (
        'NONE',
        'ACCOUNT_FLAGGED',
        'TRADING_SUSPENDED',
        'ACCOUNT_LOCKED',
        'REPORTED_TO_COMPLIANCE'
      )
    `);

    // Investigation enums
    await queryRunner.query(`
      CREATE TYPE "sec_investigation_status_enum" AS ENUM (
        'OPEN',
        'IN_PROGRESS',
        'PENDING_EVIDENCE',
        'CLOSED_CONFIRMED',
        'CLOSED_CLEARED',
        'REFERRED'
      )
    `);

    // security_fraud_alerts
    await queryRunner.createTable(
      new Table({
        name: 'security_fraud_alerts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'category', type: 'enum', enumName: 'sec_anomaly_category_enum' },
          { name: 'severity', type: 'enum', enumName: 'sec_anomaly_severity_enum' },
          {
            name: 'status',
            type: 'enum',
            enumName: 'sec_fraud_alert_status_enum',
            default: "'OPEN'",
          },
          {
            name: 'action_taken',
            type: 'enum',
            enumName: 'sec_fraud_alert_action_enum',
            default: "'NONE'",
          },
          { name: 'risk_score', type: 'int' },
          { name: 'title', type: 'varchar', length: '500' },
          { name: 'description', type: 'text' },
          { name: 'anomaly_ids', type: 'jsonb', default: "'[]'" },
          { name: 'evidence', type: 'jsonb' },
          {
            name: 'total_value_usd',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: true,
          },
          { name: 'investigation_id', type: 'uuid', isNullable: true },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'resolved_by', type: 'uuid', isNullable: true },
          { name: 'resolved_at', type: 'timestamp with time zone', isNullable: true },
          { name: 'resolution_note', type: 'text', isNullable: true },
          { name: 'notification_sent', type: 'boolean', default: false },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'security_fraud_alerts',
      new TableIndex({
        name: 'IDX_sec_alerts_user_status',
        columnNames: ['user_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'security_fraud_alerts',
      new TableIndex({
        name: 'IDX_sec_alerts_status_severity',
        columnNames: ['status', 'severity'],
      }),
    );

    await queryRunner.createIndex(
      'security_fraud_alerts',
      new TableIndex({
        name: 'IDX_sec_alerts_category_created',
        columnNames: ['category', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'security_fraud_alerts',
      new TableIndex({
        name: 'IDX_sec_alerts_investigation',
        columnNames: ['investigation_id'],
      }),
    );

    // security_investigations
    await queryRunner.createTable(
      new Table({
        name: 'security_investigations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'primary_user_id', type: 'uuid', isNullable: false },
          { name: 'related_user_ids', type: 'jsonb', default: "'[]'" },
          {
            name: 'status',
            type: 'enum',
            enumName: 'sec_investigation_status_enum',
            default: "'OPEN'",
          },
          { name: 'severity', type: 'enum', enumName: 'sec_anomaly_severity_enum' },
          { name: 'title', type: 'varchar', length: '500' },
          { name: 'summary', type: 'text', isNullable: true },
          { name: 'alert_ids', type: 'jsonb', default: "'[]'" },
          { name: 'risk_score', type: 'int', default: 0 },
          { name: 'timeline', type: 'jsonb', default: "'[]'" },
          { name: 'assigned_to', type: 'uuid', isNullable: true },
          { name: 'closed_by', type: 'uuid', isNullable: true },
          { name: 'closed_at', type: 'timestamp with time zone', isNullable: true },
          { name: 'referral_reference', type: 'varchar', length: '100', isNullable: true },
          { name: 'metadata', type: 'jsonb', default: "'{}'" },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'security_investigations',
      new TableIndex({
        name: 'IDX_sec_investigations_user_status',
        columnNames: ['primary_user_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'security_investigations',
      new TableIndex({
        name: 'IDX_sec_investigations_status_severity',
        columnNames: ['status', 'severity'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('security_investigations', true);
    await queryRunner.dropTable('security_fraud_alerts', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "sec_investigation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sec_fraud_alert_action_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sec_fraud_alert_status_enum"`);
  }
}
