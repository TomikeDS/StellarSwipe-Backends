import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('temporary_access_codes')
@Index(['userId', 'expiresAt'])
export class TemporaryAccessCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  /** bcrypt-hashed code — raw code is returned once at creation */
  @Column({ type: 'varchar', length: 255 })
  codeHash: string;

  /** Optional: restrict the temp code to specific IPs or CIDRs */
  @Column({ type: 'text', array: true, default: '{}' })
  allowedIps: string[];

  /** Optional: restrict to specific countries */
  @Column({ type: 'text', array: true, default: '{}' })
  allowedCountries: string[];

  /** Human-readable purpose label, e.g. "Business trip to Tokyo" */
  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  /** Hard expiry — always enforced */
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /** Max number of uses; null = unlimited within expiry window */
  @Column({ type: 'int', nullable: true })
  maxUses: number | null;

  @Column({ type: 'int', default: 0 })
  useCount: number;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
