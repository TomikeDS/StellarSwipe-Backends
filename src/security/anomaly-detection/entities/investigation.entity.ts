import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AnomalySeverity } from '../interfaces/anomaly-config.interface';

export enum InvestigationStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_EVIDENCE = 'PENDING_EVIDENCE',
  CLOSED_CONFIRMED = 'CLOSED_CONFIRMED', // Fraud confirmed
  CLOSED_CLEARED = 'CLOSED_CLEARED',     // No fraud found
  REFERRED = 'REFERRED',                  // Referred to regulators
}

export interface InvestigationTimelineEntry {
  at: string;       // ISO date
  actor: string;    // userId or 'system'
  action: string;
  note?: string;
}

@Entity('security_investigations')
@Index(['primaryUserId', 'status'])
@Index(['status', 'severity'])
export class Investigation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Main subject of the investigation */
  @Column({ name: 'primary_user_id', type: 'uuid' })
  primaryUserId!: string;

  /** Additional user IDs suspected of coordinated activity */
  @Column({ name: 'related_user_ids', type: 'jsonb', default: '[]' })
  relatedUserIds!: string[];

  @Column({
    type: 'enum',
    enum: InvestigationStatus,
    default: InvestigationStatus.OPEN,
  })
  status!: InvestigationStatus;

  @Column({ type: 'enum', enum: AnomalySeverity })
  severity!: AnomalySeverity;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  /** IDs of FraudAlert records grouped under this investigation */
  @Column({ name: 'alert_ids', type: 'jsonb', default: '[]' })
  alertIds!: string[];

  /** Aggregated risk score across all linked alerts (0-100) */
  @Column({ name: 'risk_score', type: 'int', default: 0 })
  riskScore!: number;

  /** Running timeline of actions taken by analysts or the system */
  @Column({ type: 'jsonb', default: '[]' })
  timeline!: InvestigationTimelineEntry[];

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo!: string | null;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy!: string | null;

  @Column({ name: 'closed_at', type: 'timestamp with time zone', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'referral_reference', type: 'varchar', length: 100, nullable: true })
  referralReference!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
