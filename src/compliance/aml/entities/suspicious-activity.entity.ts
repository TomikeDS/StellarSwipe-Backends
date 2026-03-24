import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SuspiciousActivityStatus {
  OPEN = 'open', // Newly flagged, awaiting review
  UNDER_REVIEW = 'under_review',
  SAR_FILED = 'sar_filed', // Suspicious Activity Report submitted
  DISMISSED = 'dismissed', // Reviewed, determined benign
  ESCALATED = 'escalated', // Requires immediate action
}

export enum SuspiciousActivityReason {
  // Velocity-based
  HIGH_VELOCITY = 'high_velocity', // Too many txs in short window
  RAPID_FUND_MOVEMENT = 'rapid_fund_movement', // Large funds in then out quickly
  // Volume-based
  LARGE_TRANSACTION = 'large_transaction', // Single tx above threshold
  STRUCTURING = 'structuring', // Multiple txs just below reporting limit
  // Pattern-based
  ROUND_TRIP = 'round_trip', // Funds return to origin wallet
  LAYERING = 'layering', // Multiple hops to obscure origin
  SMURFING = 'smurfing', // Same user, multiple small accounts
  // Behavioral
  DORMANT_ACCOUNT_SPIKE = 'dormant_account_spike', // Inactive account suddenly active
  UNUSUAL_HOURS = 'unusual_hours', // Consistent off-hours activity
  GEO_ANOMALY = 'geo_anomaly', // IP location mismatch to profile
}

@Entity('suspicious_activities')
@Index(['userId', 'createdAt'])
@Index(['status'])
export class SuspiciousActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: SuspiciousActivityReason,
  })
  reason!: SuspiciousActivityReason;

  @Column({
    type: 'enum',
    enum: SuspiciousActivityStatus,
    default: SuspiciousActivityStatus.OPEN,
  })
  status!: SuspiciousActivityStatus;

  /** Numeric risk score 0–100 derived from pattern severity */
  @Column({ name: 'risk_score', type: 'int' })
  riskScore!: number;

  /** Human-readable summary of the detected pattern */
  @Column({ type: 'text' })
  description!: string;

  /** Structured evidence: tx IDs, amounts, timestamps, computed metrics */
  @Column({ type: 'jsonb' })
  evidence!: Record<string, unknown>;

  /** IDs of related trade/transaction records */
  @Column({ name: 'related_trade_ids', type: 'simple-array', nullable: true })
  relatedTradeIds?: string[];

  /** Total USD value involved in the flagged activity */
  @Column({
    name: 'total_value_usd',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  totalValueUsd?: string;

  /** Reference number used if a SAR is filed externally */
  @Column({
    name: 'sar_reference',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  sarReference?: string;

  /** Analyst notes added during review */
  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
