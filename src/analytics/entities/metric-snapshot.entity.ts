import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MetricPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('metric_snapshots')
export class MetricSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: MetricPeriod })
  period!: MetricPeriod;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd!: Date;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string;

  @Column({ name: 'dau', type: 'int', default: 0 })
  dailyActiveUsers!: number;

  @Column({ name: 'wau', type: 'int', default: 0 })
  weeklyActiveUsers!: number;

  @Column({ name: 'mau', type: 'int', default: 0 })
  monthlyActiveUsers!: number;

  @Column({ name: 'avg_session_seconds', type: 'numeric', precision: 12, scale: 2, default: 0 })
  avgSessionSeconds!: string;

  @Column({ name: 'swipe_to_trade_conversion', type: 'numeric', precision: 8, scale: 2, default: 0 })
  swipeToTradeConversion!: string;

  @Column({ name: 'revenue_per_user', type: 'numeric', precision: 18, scale: 6, default: 0 })
  revenuePerUser!: string;

  @Column({ name: 'mau_retention', type: 'numeric', precision: 8, scale: 2, default: 0 })
  mauRetention!: string;

  @Column({ name: 'avg_events_per_user', type: 'numeric', precision: 10, scale: 2, default: 0 })
  avgEventsPerUser!: string;

  @Column({ name: 'total_swipes_right', type: 'int', default: 0 })
  totalSwipesRight!: number;

  @Column({ name: 'total_swipes_left', type: 'int', default: 0 })
  totalSwipesLeft!: number;

  @Column({ name: 'total_trades', type: 'int', default: 0 })
  totalTrades!: number;

  @Column({ name: 'total_signal_views', type: 'int', default: 0 })
  totalSignalViews!: number;

  @Column({ name: 'total_revenue', type: 'numeric', precision: 18, scale: 6, default: 0 })
  totalRevenue!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
