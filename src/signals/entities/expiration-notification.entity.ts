import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  EXPIRATION_WARNING = 'EXPIRATION_WARNING',
  GRACE_PERIOD_STARTED = 'GRACE_PERIOD_STARTED',
  POSITION_AUTO_CLOSED = 'POSITION_AUTO_CLOSED',
  SIGNAL_CANCELLED = 'SIGNAL_CANCELLED',
  SIGNAL_EXPIRED = 'SIGNAL_EXPIRED',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
  SMS = 'SMS',
}

@Entity('expiration_notifications')
export class ExpirationNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'position_id', type: 'uuid', nullable: true })
  positionId?: string;

  @Column({ name: 'signal_id', type: 'uuid', nullable: true })
  signalId?: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status!: NotificationStatus;

  @Column({ type: 'enum', enum: NotificationChannel, nullable: true })
  channel?: NotificationChannel;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt?: Date;

  @Column({ name: 'read_at', type: 'timestamp with time zone', nullable: true })
  readAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt?: Date;
}
