import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('provider_earnings')
export class ProviderEarning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ name: 'signal_id' })
  signalId: string;

  @Column({ name: 'trade_id' })
  tradeId: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column({ length: 10 })
  asset: string;

  /**
   * The original traded amount used to calculate this earning.
   * earning = tradedAmount * 0.001
   */
  @Column({ name: 'traded_amount', type: 'decimal', precision: 20, scale: 8 })
  tradedAmount: number;

  @Column({ name: 'copier_id' })
  copierId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
