import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BillingCycleStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  INVOICED = 'invoiced',
}

@Entity('billing_cycles')
@Index(['userId', 'periodStart'])
export class BillingCycle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'api_key_id' })
  @Index()
  apiKeyId!: string;

  @Column({ name: 'pricing_tier_id' })
  pricingTierId!: string;

  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd!: Date;

  @Column({ name: 'total_requests', type: 'int', default: 0 })
  totalRequests!: number;

  @Column({ name: 'included_requests', type: 'int' })
  includedRequests!: number;

  @Column({ name: 'overage_requests', type: 'int', default: 0 })
  overageRequests!: number;

  @Column({ name: 'flat_fee', type: 'decimal', precision: 10, scale: 2 })
  flatFee!: string;

  @Column({ name: 'overage_cost', type: 'decimal', precision: 10, scale: 6, default: '0' })
  overageCost!: string;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2, default: '0' })
  totalCost!: string;

  @Column({ type: 'enum', enum: BillingCycleStatus, default: BillingCycleStatus.ACTIVE })
  @Index()
  status!: BillingCycleStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
