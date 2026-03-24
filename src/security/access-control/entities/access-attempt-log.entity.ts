import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AccessAttemptOutcome {
  ALLOWED = 'allowed',
  BLOCKED_IP = 'blocked_ip',
  BLOCKED_GEO = 'blocked_geo',
  BLOCKED_VPN = 'blocked_vpn',
  TEMP_CODE_USED = 'temp_code_used',
}

@Entity('access_attempt_logs')
@Index(['userId', 'createdAt'])
@Index(['outcome', 'createdAt'])
export class AccessAttemptLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string | null;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({
    type: 'enum',
    enum: AccessAttemptOutcome,
  })
  outcome: AccessAttemptOutcome;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  requestPath: string | null;

  @Column({ type: 'boolean', default: false })
  isVpnProxy: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
