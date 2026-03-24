import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('reputation_scores')
export class ReputationScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  providerId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  winRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  consistencyScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  retentionRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  stakeBonus: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  avgRating: number;

  @Column({ type: 'int', default: 0 })
  totalSignals: number;

  @Column({ type: 'int', default: 0 })
  winningSignals: number;

  @Column({ type: 'int', default: 0 })
  totalCopiers: number;

  @Column({ type: 'int', default: 0 })
  activeCopiers: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  stakeAmount: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  /** Smoothed score using EMA to reduce volatility */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  smoothedScore: number;

  /** Days since provider first posted a signal */
  @Column({ type: 'int', default: 0 })
  activeDays: number;

  @Column({ type: 'boolean', default: false })
  isNewProvider: boolean;

  @Column({ type: 'timestamp' })
  recordedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
