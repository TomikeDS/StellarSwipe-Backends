import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MentorshipFeedback } from './mentorship-feedback.entity';

export enum MentorshipStatus {
  REQUESTED = 'requested',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('mentorships')
export class Mentorship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'mentor_id', type: 'uuid' })
  mentorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'mentor_id' })
  mentor!: User;

  @Column({ name: 'mentee_id', type: 'uuid' })
  menteeId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'mentee_id' })
  mentee!: User;

  @Column({
    type: 'enum',
    enum: MentorshipStatus,
    default: MentorshipStatus.REQUESTED,
  })
  status!: MentorshipStatus;

  @CreateDateColumn({ name: 'start_date' })
  startDate!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'jsonb', default: { signalsReviewed: 0, improvementRate: 0, initialWinRate: 0, currentWinRate: 0, successfulSignals: 0 } })
  metrics!: {
    signalsReviewed: number;
    improvementRate: number;
    initialWinRate: number;
    currentWinRate: number;
    successfulSignals: number;
  };

  @OneToMany(() => MentorshipFeedback, (feedback) => feedback.mentorship)
  feedbacks!: MentorshipFeedback[];
}
