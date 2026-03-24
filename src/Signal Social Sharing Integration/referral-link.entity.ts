import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('referral_links')
@Index(['userId', 'signalId'], { unique: true })
@Index(['referralCode'], { unique: true })
export class ReferralLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  referralCode: string;

  @Column()
  userId: string;

  @Column()
  signalId: string;

  @Column({ default: 0 })
  clickCount: number;

  @Column({ default: 0 })
  conversionCount: number;

  @Column({ nullable: true, type: 'timestamp' })
  lastClickAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
