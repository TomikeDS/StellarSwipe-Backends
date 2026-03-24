import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum UpdateApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  AUTO_APPLIED = 'auto_applied',
}

@Entity('signal_versions')
@Index(['signalId', 'versionNumber'])
export class SignalVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'signal_id', type: 'uuid' })
  @Index()
  signalId: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({
    name: 'entry_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  entryPrice: string | null;

  @Column({
    name: 'target_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  targetPrice: string | null;

  @Column({
    name: 'stop_loss_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  stopLossPrice: string | null;

  @Column({ name: 'rationale', type: 'text', nullable: true })
  rationale: string | null;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary: string | null;

  @Column({ name: 'requires_approval', default: false })
  requiresApproval: boolean;

  @Column({ name: 'approved_count', default: 0 })
  approvedCount: number;

  @Column({ name: 'rejected_count', default: 0 })
  rejectedCount: number;

  @Column({ name: 'auto_applied_count', default: 0 })
  autoAppliedCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('signal_version_approvals')
@Index(['signalVersionId', 'copierId'], { unique: true })
export class SignalVersionApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'signal_version_id', type: 'uuid' })
  @Index()
  signalVersionId: string;

  @Column({ name: 'copier_id', type: 'uuid' })
  @Index()
  copierId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: UpdateApprovalStatus,
    default: UpdateApprovalStatus.PENDING,
  })
  status: UpdateApprovalStatus;

  @Column({ name: 'auto_adjust', default: false })
  autoAdjust: boolean;

  @CreateDateColumn({ name: 'responded_at', type: 'timestamp with time zone' })
  respondedAt: Date;
}
