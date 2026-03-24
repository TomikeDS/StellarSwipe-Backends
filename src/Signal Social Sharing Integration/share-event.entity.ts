import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('share_events')
@Index(['userId', 'signalId'])
export class ShareEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  signalId: string;

  @Column()
  platform: string;

  @Column()
  referralCode: string;

  @Column({ type: 'timestamp' })
  sharedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
