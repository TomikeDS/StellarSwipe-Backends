import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  DetectorType,
  AnomalyCategory,
  AnomalySeverity,
} from '../interfaces/anomaly-config.interface';

@Entity('security_anomalies')
@Index(['userId', 'detectedAt'])
@Index(['category', 'severity'])
@Index(['isFalsePositive', 'detectedAt'])
@Index(['fraudAlertId'])
export class Anomaly {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Which ML algorithm produced this anomaly */
  @Column({ name: 'detector_type', type: 'enum', enum: DetectorType })
  detectorType!: DetectorType;

  /** The trading-pattern category this anomaly belongs to */
  @Column({ type: 'enum', enum: AnomalyCategory })
  category!: AnomalyCategory;

  @Column({ type: 'enum', enum: AnomalySeverity })
  severity!: AnomalySeverity;

  /**
   * Raw anomaly score from the detector — 0 (normal) to 1 (highly anomalous).
   * Comparable across detector types after normalisation.
   */
  @Column({ name: 'anomaly_score', type: 'decimal', precision: 5, scale: 4 })
  anomalyScore!: number;

  /**
   * Composite ensemble score combining all enabled detectors (0-1).
   */
  @Column({ name: 'ensemble_score', type: 'decimal', precision: 5, scale: 4 })
  ensembleScore!: number;

  /** Normalised feature vector that produced the anomaly */
  @Column({ name: 'feature_vector', type: 'jsonb' })
  featureVector!: number[];

  /** Human-readable explanation of what was detected */
  @Column({ type: 'text' })
  description!: string;

  /** Structured evidence: related trade IDs, amounts, timestamps, signals */
  @Column({ type: 'jsonb' })
  evidence!: Record<string, unknown>;

  /** Which feature(s) drove the anomaly (name → contribution 0-1) */
  @Column({ name: 'feature_contributions', type: 'jsonb', nullable: true })
  featureContributions!: Record<string, number> | null;

  /** IDs of trades that form the pattern */
  @Column({ name: 'related_trade_ids', type: 'jsonb', default: '[]' })
  relatedTradeIds!: string[];

  /** IDs of signals involved (for manipulation detection) */
  @Column({ name: 'related_signal_ids', type: 'jsonb', default: '[]' })
  relatedSignalIds!: string[];

  /** ID of the FraudAlert this was escalated to, if any */
  @Column({ name: 'fraud_alert_id', type: 'uuid', nullable: true })
  fraudAlertId!: string | null;

  @Column({ name: 'is_false_positive', type: 'boolean', default: false })
  isFalsePositive!: boolean;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp with time zone', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;

  @Column({ name: 'detected_at', type: 'timestamp with time zone' })
  detectedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
