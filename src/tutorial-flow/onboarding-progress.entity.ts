import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TutorialStep {
  WELCOME = 'WELCOME',
  BROWSE_SIGNALS = 'BROWSE_SIGNALS',
  UNDERSTAND_METRICS = 'UNDERSTAND_METRICS',
  DEMO_TRADE = 'DEMO_TRADE',
  FIRST_REAL_TRADE = 'FIRST_REAL_TRADE',
  COMPLETED = 'COMPLETED',
}

export enum OnboardingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('onboarding_progress')
export class OnboardingProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: OnboardingStatus,
    default: OnboardingStatus.NOT_STARTED,
  })
  status: OnboardingStatus;

  @Column({
    type: 'enum',
    enum: TutorialStep,
    default: TutorialStep.WELCOME,
  })
  currentStep: TutorialStep;

  @Column({ type: 'jsonb', default: [] })
  completedSteps: TutorialStep[];

  @Column({ type: 'boolean', default: false })
  achievementEarned: boolean;

  @Column({ type: 'boolean', default: false })
  demoModeCompleted: boolean;

  @Column({ type: 'boolean', default: false })
  firstRealTradeCompleted: boolean;

  @Column({ type: 'int', default: 0 })
  progressPercentage: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
