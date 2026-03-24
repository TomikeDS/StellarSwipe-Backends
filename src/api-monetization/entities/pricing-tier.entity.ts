import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PricingTierName {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

@Entity('pricing_tiers')
export class PricingTier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: PricingTierName, unique: true })
  @Index()
  name!: PricingTierName;

  @Column({ name: 'monthly_flat_fee', type: 'decimal', precision: 10, scale: 2 })
  monthlyFlatFee!: string;

  @Column({ name: 'included_requests', type: 'int' })
  includedRequests!: number;

  @Column({ name: 'overage_rate', type: 'decimal', precision: 10, scale: 6 })
  overageRate!: string;

  @Column({ name: 'max_rpm', type: 'int' })
  maxRequestsPerMinute!: number;

  @Column({ name: 'max_rpd', type: 'int' })
  maxRequestsPerDay!: number;

  @Column({ type: 'jsonb', default: '[]' })
  features!: string[];

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
