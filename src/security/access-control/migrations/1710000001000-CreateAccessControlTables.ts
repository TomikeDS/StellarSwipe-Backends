import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAccessControlTables1710000001000 implements MigrationInterface {
  name = 'CreateAccessControlTables1710000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "access_attempt_outcome_enum" AS ENUM (
        'allowed', 'blocked_ip', 'blocked_geo', 'blocked_vpn', 'temp_code_used'
      )
    `);

    // ip_whitelists
    await queryRunner.createTable(
      new Table({
        name: 'ip_whitelists',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'ipAddresses', type: 'text', isArray: true, default: "'{}'" },
          { name: 'enabled', type: 'boolean', default: false },
          { name: 'labels', type: 'jsonb', default: "'{}'" },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ip_whitelists',
      new TableIndex({
        name: 'IDX_ip_whitelists_userId',
        columnNames: ['userId'],
        isUnique: true,
      }),
    );

    // geo_restrictions
    await queryRunner.createTable(
      new Table({
        name: 'geo_restrictions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          {
            name: 'allowedCountries',
            type: 'text',
            isArray: true,
            default: "'{}'",
          },
          {
            name: 'blockedCountries',
            type: 'text',
            isArray: true,
            default: "'{}'",
          },
          { name: 'enabled', type: 'boolean', default: false },
          { name: 'blockVpnProxy', type: 'boolean', default: false },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'geo_restrictions',
      new TableIndex({
        name: 'IDX_geo_restrictions_userId',
        columnNames: ['userId'],
        isUnique: true,
      }),
    );

    // access_attempt_logs
    await queryRunner.createTable(
      new Table({
        name: 'access_attempt_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid', isNullable: true },
          { name: 'ipAddress', type: 'varchar', length: '45' },
          {
            name: 'countryCode',
            type: 'varchar',
            length: '2',
            isNullable: true,
          },
          { name: 'city', type: 'varchar', length: '255', isNullable: true },
          { name: 'outcome', type: 'access_attempt_outcome_enum' },
          {
            name: 'userAgent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'requestPath',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'isVpnProxy', type: 'boolean', default: false },
          { name: 'metadata', type: 'jsonb', default: "'{}'" },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'access_attempt_logs',
      new TableIndex({
        name: 'IDX_access_logs_userId_createdAt',
        columnNames: ['userId', 'createdAt'],
      }),
    );
    await queryRunner.createIndex(
      'access_attempt_logs',
      new TableIndex({
        name: 'IDX_access_logs_outcome',
        columnNames: ['outcome', 'createdAt'],
      }),
    );

    // temporary_access_codes
    await queryRunner.createTable(
      new Table({
        name: 'temporary_access_codes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'codeHash', type: 'varchar', length: '255' },
          { name: 'allowedIps', type: 'text', isArray: true, default: "'{}'" },
          {
            name: 'allowedCountries',
            type: 'text',
            isArray: true,
            default: "'{}'",
          },
          { name: 'label', type: 'varchar', length: '255', isNullable: true },
          { name: 'expiresAt', type: 'timestamp' },
          { name: 'maxUses', type: 'int', isNullable: true },
          { name: 'useCount', type: 'int', default: 0 },
          { name: 'revoked', type: 'boolean', default: false },
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'temporary_access_codes',
      new TableIndex({
        name: 'IDX_temp_codes_userId_expiresAt',
        columnNames: ['userId', 'expiresAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('temporary_access_codes');
    await queryRunner.dropTable('access_attempt_logs');
    await queryRunner.dropTable('geo_restrictions');
    await queryRunner.dropTable('ip_whitelists');
    await queryRunner.query(`DROP TYPE "access_attempt_outcome_enum"`);
  }
}
