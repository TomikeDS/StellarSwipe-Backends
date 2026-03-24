import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Mentorship } from './mentorship.entity';
import { User } from '../../users/entities/user.entity';

@Entity('mentorship_feedbacks')
export class MentorshipFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'mentorship_id', type: 'uuid' })
  mentorshipId!: string;

  @ManyToOne(() => Mentorship, (mentorship) => mentorship.feedbacks)
  @JoinColumn({ name: 'mentorship_id' })
  mentorship!: Mentorship;

  @Column({ name: 'reviewer_id', type: 'uuid' })
  reviewerId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int', default: 0 })
  rating!: number; // 1-5

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
