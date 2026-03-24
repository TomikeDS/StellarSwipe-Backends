import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_pairs')
export class AssetPair {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'base_asset_id', type: 'uuid' })
  baseAssetId!: string;

  @ManyToOne(() => Asset, (asset) => asset.basePairs, { eager: true })
  @JoinColumn({ name: 'base_asset_id' })
  baseAsset!: Asset;

  @Column({ name: 'counter_asset_id', type: 'uuid' })
  counterAssetId!: string;

  @ManyToOne(() => Asset, (asset) => asset.counterPairs, { eager: true })
  @JoinColumn({ name: 'counter_asset_id' })
  counterAsset!: Asset;

  @Column({ name: 'is_tradable', type: 'boolean', default: true })
  isTradable!: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  lastPrice!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  bidPrice!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  askPrice!: string | null;

  @Column({ type: 'bigint', nullable: true })
  baseVolume24h!: string | null;

  @Column({ type: 'bigint', nullable: true })
  counterVolume24h!: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastPriceUpdate!: Date | null;

  @Column({ type: 'int', default: 0 })
  tradeCount24h!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Get the pair identifier in format BASE/COUNTER
   */
  getPairIdentifier(): string {
    return `${this.baseAsset.getAssetFormat()}/${this.counterAsset.getAssetFormat()}`;
  }
}
