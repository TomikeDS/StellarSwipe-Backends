import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AnomalyCategory, AnomalySeverity } from '../interfaces/anomaly-config.interface';

export enum FraudAlertStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CONFIRMED = 'CONFIRMED',      // Confirmed fraud — escalate / block
  DISMISSED = 'DISMISSED',      // Reviewed, determined benign
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  ESCALATED = 'ESCALATED',      // Sent to compliance / authorities
}

export enum FraudAlertAction {
  NONE = 'NONE',
  ACCOUNT_FLAGGED = 'ACCOUNT_FLAGGED',
  TRADING_SUSPENDED = 'TRADING_SUSPENDED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  REPORTED_TO_COMPLIANCE = 'REPORTED_TO_COMPLIANCE',
}

@Entity('security_fraud_alerts')
@Index(['userId', 'status'])
@Index(['status', 'severity'])
@Index(['category', 'createdAt'])
@Index(['investigationId'])
export class FraudAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: AnomalyCategory })
  category!: AnomalyCategory;

  @Column({ type: 'enum', enum: AnomalySeverity })
  severity!: AnomalySeverity;

  @Column({
    type: 'enum',
    enum: FraudAlertStatus,
    default: FraudAlertStatus.OPEN,
  })
  status!: FraudAlertStatus;

  @Column({
    name: 'action_taken',
    type: 'enum',
    enum: FraudAlertAction,
    default: FraudAlertAction.NONE,
  })
  actionTaken!: FraudAlertAction;

  /** Composite risk score at time of alert creation (0-100) */
  @Column({ name: 'risk_score', type: 'int' })
  riskScore!: number;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  /** IDs of Anomaly records that triggered this alert */
  @Column({ name: 'anomaly_ids', type: 'jsonb', default: '[]' })
  anomalyIds!: string[];

  /** Aggregated evidence across all constituent anomalies */
  @Column({ type: 'jsonb' })
  evidence!: Record<string, unknown>;

  /** Total USD value across all flagged trades */
  @Column({
    name: 'total_value_usd',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  totalValueUsd!: string | null;

  /** Optional link to an Investigation that groups multiple alerts */
  @Column({ name: 'investigation_id', type: 'uuid', nullable: true })
  investigationId!: string | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo!: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;

  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
