import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('provider_followers')
@Unique(['userId', 'providerId'])
export class ProviderFollower {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @CreateDateColumn({ name: 'followed_at' })
  followedAt: Date;
}
