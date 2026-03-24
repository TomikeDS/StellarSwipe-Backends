import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAnomaliesTable1705000000204 implements MigrationInterface {
  name = 'CreateAnomaliesTable1705000000204';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(`
      CREATE TYPE "sec_detector_type_enum" AS ENUM (
        'ISOLATION_FOREST',
        'AUTOENCODER',
        'STATISTICAL_OUTLIER'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "sec_anomaly_category_enum" AS ENUM (
        'WASH_TRADING',
        'MARKET_MANIPULATION',
        'PUMP_AND_DUMP',
        'LAYERING',
        'SPOOFING',
        'UNUSUAL_TRADING_PATTERN',
        'COORDINATED_ACTIVITY',
        'VOLUME_ANOMALY'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "sec_anomaly_severity_enum" AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'security_anomalies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'detector_type', type: 'enum', enumName: 'sec_detector_type_enum' },
          { name: 'category', type: 'enum', enumName: 'sec_anomaly_category_enum' },
          { name: 'severity', type: 'enum', enumName: 'sec_anomaly_severity_enum' },
          { name: 'anomaly_score', type: 'decimal', precision: 5, scale: 4 },
          { name: 'ensemble_score', type: 'decimal', precision: 5, scale: 4 },
          { name: 'feature_vector', type: 'jsonb' },
          { name: 'description', type: 'text' },
          { name: 'evidence', type: 'jsonb' },
          { name: 'feature_contributions', type: 'jsonb', isNullable: true },
          { name: 'related_trade_ids', type: 'jsonb', default: "'[]'" },
          { name: 'related_signal_ids', type: 'jsonb', default: "'[]'" },
          { name: 'fraud_alert_id', type: 'uuid', isNullable: true },
          { name: 'is_false_positive', type: 'boolean', default: false },
          { name: 'reviewed_by', type: 'uuid', isNullable: true },
          { name: 'reviewed_at', type: 'timestamp with time zone', isNullable: true },
          { name: 'review_note', type: 'text', isNullable: true },
          { name: 'detected_at', type: 'timestamp with time zone', isNullable: false },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'security_anomalies',
      new TableIndex({
        name: 'IDX_sec_anomalies_user_detected',
        columnNames: ['user_id', 'detected_at'],
      }),
    );

    await queryRunner.createIndex(
      'security_anomalies',
      new TableIndex({
        name: 'IDX_sec_anomalies_category_severity',
        columnNames: ['category', 'severity'],
      }),
    );

    await queryRunner.createIndex(
      'security_anomalies',
      new TableIndex({
        name: 'IDX_sec_anomalies_false_positive_detected',
        columnNames: ['is_false_positive', 'detected_at'],
      }),
    );

    await queryRunner.createIndex(
      'security_anomalies',
      new TableIndex({
        name: 'IDX_sec_anomalies_fraud_alert',
        columnNames: ['fraud_alert_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('security_anomalies', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "sec_anomaly_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sec_anomaly_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sec_detector_type_enum"`);
  }
}
