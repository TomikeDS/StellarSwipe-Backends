import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSignalVersioningTables1737650000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'signal_versions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'signal_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'provider_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'version_number',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'entry_price',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'target_price',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'stop_loss_price',
            type: 'decimal',
            precision: 18,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'rationale',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'change_summary',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'requires_approval',
            type: 'boolean',
            default: false,
          },
          {
            name: 'approved_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'rejected_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'auto_applied_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['signal_id'],
            referencedTableName: 'signals',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'signal_versions',
      new TableIndex({
        name: 'IDX_signal_versions_signal_id',
        columnNames: ['signal_id'],
      }),
    );

    await queryRunner.createIndex(
      'signal_versions',
      new TableIndex({
        name: 'IDX_signal_versions_signal_id_version',
        columnNames: ['signal_id', 'version_number'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'signal_version_approvals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'signal_version_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'copier_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'auto_applied'],
            default: "'pending'",
          },
          {
            name: 'auto_adjust',
            type: 'boolean',
            default: false,
          },
          {
            name: 'responded_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['signal_version_id'],
            referencedTableName: 'signal_versions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'signal_version_approvals',
      new TableIndex({
        name: 'IDX_signal_version_approvals_version_id',
        columnNames: ['signal_version_id'],
      }),
    );

    await queryRunner.createIndex(
      'signal_version_approvals',
      new TableIndex({
        name: 'IDX_signal_version_approvals_copier_id',
        columnNames: ['copier_id'],
      }),
    );

    await queryRunner.createIndex(
      'signal_version_approvals',
      new TableIndex({
        name: 'IDX_signal_version_approvals_unique',
        columnNames: ['signal_version_id', 'copier_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('signal_version_approvals', true);
    await queryRunner.dropTable('signal_versions', true);
  }
}
