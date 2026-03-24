import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  AUTO_CLOSED = 'AUTO_CLOSED',
}

export enum AutoCloseReason {
  USER_MANUAL = 'USER_MANUAL',
  SIGNAL_EXPIRED = 'SIGNAL_EXPIRED',
  SIGNAL_CANCELLED = 'SIGNAL_CANCELLED',
  GRACE_PERIOD_ENDED = 'GRACE_PERIOD_ENDED',
  SIGNAL_CLOSED = 'SIGNAL_CLOSED',
  TARGET_HIT = 'TARGET_HIT',
  STOP_LOSS_HIT = 'STOP_LOSS_HIT',
}

@Entity('copied_positions')
export class CopiedPosition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'signal_id', type: 'uuid' })
  signalId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'copier_id', type: 'uuid', nullable: true })
  copierId?: string;

  @Column({ type: 'enum', enum: PositionStatus, default: PositionStatus.OPEN })
  status!: PositionStatus;

  @Column({ type: 'enum', enum: AutoCloseReason, nullable: true })
  autoCloseReason?: AutoCloseReason;

  @Column({ name: 'pnl_percentage', type: 'decimal', precision: 10, scale: 4, nullable: true })
  pnlPercentage?: string;

  @Column({ name: 'pnl_absolute', type: 'decimal', precision: 18, scale: 8, nullable: true })
  pnlAbsolute?: string;

  @Column({ name: 'closed_at', type: 'timestamp with time zone', nullable: true })
  closedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt?: Date;
}
