/**
 * Add these fields to your existing Signal entity.
 * (This is not a standalone file — patch your existing signal.entity.ts)
 */

import { Column } from 'typeorm';

// Add inside your @Entity() class:

// @Column({ default: 0 })
// shareCount: number;

// Full example patch shown below for reference:

/*
@Entity('signals')
export class Signal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pair: string; // e.g. 'USDC/XLM'

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  exitPrice: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  pnlPercent: number;

  @Column({ enum: ['BUY', 'SELL'], type: 'enum' })
  tradeType: 'BUY' | 'SELL';

  @Column({ default: 0 })
  shareCount: number;          // ← ADD THIS

  @Column({ nullable: true, type: 'timestamp' })
  closedAt: Date;

  @ManyToOne(() => Provider, (p) => p.signals)
  provider: Provider;

  @CreateDateColumn()
  createdAt: Date;
}
*/
