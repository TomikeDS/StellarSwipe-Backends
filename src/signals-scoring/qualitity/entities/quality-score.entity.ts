import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum QualityBadge {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

@Entity('signal_quality_scores')
export class QualityScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  signalId!: string;

  @Column('uuid')
  providerId?: string;

  // Overall Quality Score (0-100)
  @Column('decimal', { precision: 5, scale: 2 })
  overallScore: number = 0;

  // Component Scores (0-100 each)
  @Column('decimal', { precision: 5, scale: 2 })
  accuracyScore: number = 0;

  @Column('decimal', { precision: 5, scale: 2 })
  consistencyScore: number = 0;

  @Column('decimal', { precision: 5, scale: 2 })
  timelinessScore: number = 0;

  @Column('decimal', { precision: 5, scale: 2 })
  marketAlignmentScore: number = 0;

  @Column('decimal', { precision: 5, scale: 2 })
  riskAdjustedScore: number = 0;

  // Historical Metrics
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  historicalAccuracy: number | null = null;

  @Column('int', { default: 0 })
  totalSignalsTracked: number = 0;

  @Column('int', { default: 0 })
  successfulSignals: number = 0;

  @Column('int', { default: 0 })
  failedSignals: number = 0;

  // Risk Metrics
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  sharpeRatio?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  maxDrawdown?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  volatility?: number;

  // Badge
  @Column({
    type: 'enum',
    enum: QualityBadge,
    nullable: true,
  })
  badge: QualityBadge | null = null;

  // Metadata
  @Column('jsonb', { nullable: true })
  metadata: {
    factors?: Record<string, number>;
    warnings?: string[];
    strengths?: string[];
    marketConditions?: string;
  } = {};

  @Column('timestamp')
  calculatedAt: Date = new Date();

  @CreateDateColumn()
  createdAt: Date = new Date();

  @UpdateDateColumn()
  updatedAt: Date = new Date();
}