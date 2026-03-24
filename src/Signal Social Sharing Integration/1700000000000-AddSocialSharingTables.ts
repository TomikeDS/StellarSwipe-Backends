import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class AddSocialSharingTables1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. referral_links
    await queryRunner.createTable(
      new Table({
        name: 'referral_links',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'referral_code', type: 'varchar', isUnique: true },
          { name: 'user_id', type: 'uuid' },
          { name: 'signal_id', type: 'uuid' },
          { name: 'click_count', type: 'int', default: 0 },
          { name: 'conversion_count', type: 'int', default: 0 },
          { name: 'last_click_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'referral_links',
      new Index({ name: 'IDX_referral_user_signal', columnNames: ['user_id', 'signal_id'], isUnique: true } as any),
    );

    // 2. share_events
    await queryRunner.createTable(
      new Table({
        name: 'share_events',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'uuid' },
          { name: 'signal_id', type: 'uuid' },
          { name: 'platform', type: 'varchar' },
          { name: 'referral_code', type: 'varchar' },
          { name: 'shared_at', type: 'timestamp' },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // 3. Add share_count to signals
    await queryRunner.query(`ALTER TABLE signals ADD COLUMN IF NOT EXISTS share_count INT DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('share_events', true);
    await queryRunner.dropTable('referral_links', true);
    await queryRunner.query(`ALTER TABLE signals DROP COLUMN IF EXISTS share_count`);
  }
}
