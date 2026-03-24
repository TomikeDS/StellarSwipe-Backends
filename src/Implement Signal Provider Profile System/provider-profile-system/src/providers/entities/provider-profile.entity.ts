import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('provider_profiles')
export class ProviderProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  displayName: string;

  @Column({ length: 500 })
  bio: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  twitterHandle: string;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'int', default: 0 })
  totalSignals: number;

  @Column({ type: 'float', default: 0 })
  winRate: number;

  @Column({ type: 'float', default: 0 })
  averagePnL: number;

  @Column({ type: 'int', default: 0 })
  totalCopiers: number;

  @Column({ type: 'int', default: 0 })
  followerCount: number;

  @Column({ type: 'date' })
  memberSince: Date;
}